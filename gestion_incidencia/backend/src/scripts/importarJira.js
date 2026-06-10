// scripts/importarJiraSimple.js
// Importa todos los tickets de Jira a la BD sin usar IA (rápido)
// Luego ejecutar: node scripts/reprocesarIA.js para analizar con IA

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

const DOMINIO = process.env.JIRA_DOMINIO;
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_API_TOKEN;
const PROYECTO = process.env.JIRA_PROJECT_KEY;

const JIRA_API_BASE = `https://${DOMINIO}/rest/api/3`;
const CABECERA_AUTH = 'Basic ' + Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64');
const cabeceras = {
    'Authorization': CABECERA_AUTH,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
};

const MAPA_PRIORIDAD_JIRA = {
    'Highest': 'Critica',
    'High': 'Alta',
    'Medium': 'Media',
    'Low': 'Baja',
    'Lowest': 'Baja'
};

async function obtenerTodosLosTicketsJira() {
    let tickets = [];
    let startAt = 0;
    const maxResults = 100;

    while (true) {
        const jql = `project = ${PROYECTO} ORDER BY created ASC`;
        const url = `${JIRA_API_BASE}/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&startAt=${startAt}&fields=summary,description,priority,status,reporter,assignee,created`;
        const resp = await fetch(url, { headers: cabeceras });
        const data = await resp.json();

        if (!resp.ok) {
            console.error('Error al obtener tickets:', data);
            break;
        }

        tickets = tickets.concat(data.issues || []);
        if (tickets.length >= data.total) break;
        startAt += maxResults;
    }
    return tickets;
}

async function incidenciaExisteEnBD(jiraId) {
    const res = await pool.query('SELECT id FROM incidencias WHERE jira_id = $1', [jiraId]);
    return res.rowCount > 0;
}

async function crearIncidenciaSinIA(ticket) {
    const jiraId = ticket.key;
    const titulo = ticket.fields.summary;
    const descripcion = ticket.fields.description?.content?.[0]?.content?.[0]?.text || 'Sin descripción';
    const prioridadJira = ticket.fields.priority?.name || 'Medium';
    const prioridad = MAPA_PRIORIDAD_JIRA[prioridadJira] || 'Media';
    const estado = ticket.fields.status?.name || 'Nueva';
    const reportado_por = ticket.fields.reporter?.displayName || 'Jira';
    const asignado_a = ticket.fields.assignee?.displayName || null;
    const fechaCreacion = ticket.fields.created;

    const slaHoras = { 'Critica': 4, 'Alta': 24, 'Media': 48, 'Baja': 72 }[prioridad] || 48;
    const slaVencimiento = new Date(Date.now() + slaHoras * 3600000).toISOString();

    const cliente = await pool.connect();
    try {
        await cliente.query('BEGIN');

        // Reservar ID y generar código
        const { rows: seqRows } = await cliente.query("SELECT nextval('incidencias_id_seq') AS id");
        const nuevoId = seqRows[0].id;
        const anio = new Date().getFullYear();
        const codigo = `INC-${anio}-${String(nuevoId).padStart(6, '0')}`;

        // Insertar incidencia (sin análisis de IA, categoría por defecto)
        const { rows } = await cliente.query(
            `INSERT INTO incidencias
                (id, codigo, jira_id, titulo, descripcion, estado, prioridad, categoria,
                 reportado_por, asignado_a, equipo, origen, sla_vencimiento, fecha_creacion)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             RETURNING *`,
            [
                nuevoId, codigo, jiraId, titulo, descripcion, estado, prioridad, 'Sin clasificar',
                reportado_por, asignado_a, null, 'Web', slaVencimiento, fechaCreacion
            ]
        );

        const nueva = rows[0];

        // Insertar sugerencia IA con valores por defecto (para que luego reprocesarIA.js la encuentre)
        await cliente.query(
            `INSERT INTO sugerencias_ia
                (incidencia_id, categoria_sugerida, prioridad_sugerida, tiempo_sugerido,
                 descripcion_mejorada, pasos_resolucion, causa_probable, subcategoria,
                 impacto, escalado_recomendado, nivel_escalado, etiquetas)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
                nueva.id,
                'Sin clasificar',   // para que reprocesarIA.js lo detecte
                prioridad,
                'Sin estimar',
                descripcion,
                'Sin pasos sugeridos',
                null, null, null, false, null, []
            ]
        );

        await cliente.query('COMMIT');
        console.log(`Importada: ${codigo} (${jiraId}) - pendiente de IA`);
        return true;
    } catch (err) {
        await cliente.query('ROLLBACK');
        console.error(` Error al importar ${jiraId}:`, err.message);
        return false;
    } finally {
        cliente.release();
    }
}

async function importarTicketsJira() {
    console.log('Obteniendo tickets de Jira...');
    const tickets = await obtenerTodosLosTicketsJira();
    console.log(`Total de tickets en Jira: ${tickets.length}`);

    let importados = 0;
    let yaExistian = 0;
    let errores = 0;

    for (const ticket of tickets) {
        const existe = await incidenciaExisteEnBD(ticket.key);
        if (existe) {
            console.log(` ${ticket.key} ya existe, saltando.`);
            yaExistian++;
            continue;
        }

        const ok = await crearIncidenciaSinIA(ticket);
        if (ok) importados++;
        else errores++;
    }

    console.log('\n Resumen de importación:');
    console.log(`   - Importadas (sin IA): ${importados}`);
    console.log(`   - Ya existían: ${yaExistian}`);
    console.log(`   - Errores: ${errores}`);
    console.log('\nAhora ejecuta: node scripts/reprocesarIA.js para analizar con IA las incidencias pendientes.');
    await pool.end();
}

importarTicketsJira().catch(err => {
    console.error('Error inesperado:', err);
    process.exit(1);
});
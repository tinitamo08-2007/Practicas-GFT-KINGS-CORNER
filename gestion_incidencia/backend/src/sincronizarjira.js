// ============================================================
// ARCHIVO: scripts/sincronizarJira.js
// FUNCION: Borra de Jira los tickets que NO existen en la BD.
//          Mantiene solo los tickets que coinciden con jira_id
//          registrados en la tabla incidencias.
//
// Como ejecutarlo:
//   node scripts/sincronizarJira.js
// ============================================================

require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

const DOMINIO  = process.env.JIRA_DOMINIO;
const EMAIL    = process.env.JIRA_EMAIL;
const TOKEN    = process.env.JIRA_API_TOKEN;
const PROYECTO = process.env.JIRA_PROJECT_KEY;

const JIRA_API_BASE = `https://${DOMINIO}/rest/api/3`;
const CABECERA_AUTH = 'Basic ' + Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64');
const cabeceras = {
    'Authorization': CABECERA_AUTH,
    'Content-Type':  'application/json',
    'Accept':        'application/json'
};

async function obtenerTicketsJira() {
    let tickets = [];
    let startAt = 0;
    const maxResults = 100;

    while (true) {
        const jql = `project = ${PROYECTO} ORDER BY created DESC`;
        const url = `${JIRA_API_BASE}/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&startAt=${startAt}&fields=summary`;
        const resp = await fetch(url, { headers: cabeceras });
        const data = await resp.json();
        if (!resp.ok) { console.error('Error Jira:', data); break; }
        tickets = tickets.concat(data.issues || []);
        if (tickets.length >= data.total) break;
        startAt += maxResults;
    }
    return tickets;
}

async function borrarTicket(key) {
    const resp = await fetch(`${JIRA_API_BASE}/issue/${key}`, {
        method: 'DELETE',
        headers: cabeceras
    });
    return resp.status === 204;
}

async function sincronizar() {
    // 1. Obtenemos los jira_id que existen en nuestra BD
    const { rows } = await pool.query('SELECT jira_id FROM incidencias WHERE jira_id IS NOT NULL');
    const idsEnBD = new Set(rows.map(r => r.jira_id));
    console.log(`BD: ${idsEnBD.size} tickets registrados (${[...idsEnBD][0]} ... ${[...idsEnBD][idsEnBD.size-1]})`);

    // 2. Obtenemos todos los tickets de Jira
    console.log('Obteniendo tickets de Jira...');
    const ticketsJira = await obtenerTicketsJira();
    console.log(`Jira: ${ticketsJira.length} tickets encontrados`);

    // 3. Filtramos los que NO están en la BD
    const aBorrar = ticketsJira.filter(t => !idsEnBD.has(t.key));
    console.log(`Tickets a borrar: ${aBorrar.length}`);

    if (aBorrar.length === 0) {
        console.log('Jira ya está sincronizado con la BD.');
        await pool.end();
        return;
    }

    // 4. Borramos solo los que no corresponden
    let borrados = 0;
    let fallidos = 0;

    for (const ticket of aBorrar) {
        const ok = await borrarTicket(ticket.key);
        if (ok) {
            console.log(`Borrado: ${ticket.key} - ${ticket.fields.summary}`);
            borrados++;
        } else {
            console.error(`Error al borrar: ${ticket.key}`);
            fallidos++;
        }
        await new Promise(r => setTimeout(r, 300));
    }

    console.log('');
    console.log(`Proceso completado: ${borrados} borrados, ${fallidos} fallidos.`);
    console.log(`Jira ahora tiene ${ticketsJira.length - borrados} tickets, igual que la BD.`);
    await pool.end();
}

sincronizar().catch(err => {
    console.error('Error inesperado:', err);
    process.exit(1);
});
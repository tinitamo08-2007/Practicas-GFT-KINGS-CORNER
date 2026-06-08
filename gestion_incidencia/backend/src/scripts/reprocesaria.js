// ============================================================
// FUNCION: Reprocesa con Groq las incidencias que quedaron
//          con categoria "Sin clasificar" por limite de peticiones.
//
// Como ejecutarlo:
//   node scripts/reprocesarIA.js
// ============================================================

require('dotenv').config();

const { Pool }           = require('pg');
const { analizarIncidencia } = require('../services/Iaservice');

const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

// Espera N milisegundos
const esperar = (ms) => new Promise(r => setTimeout(r, ms));

async function reprocesar() {
    // Buscamos todas las sugerencias con categoria "Sin clasificar"
    const { rows: pendientes } = await pool.query(`
        SELECT i.id, i.titulo, i.descripcion, i.prioridad, i.categoria,
               i.reportado_por, i.equipo, i.origen
        FROM incidencias i
        JOIN sugerencias_ia s ON s.incidencia_id = i.id
        WHERE s.categoria_sugerida = 'Sin clasificar'
        ORDER BY i.id ASC
    `);

    console.log(`Incidencias pendientes de analizar: ${pendientes.length}`);

    if (pendientes.length === 0) {
        console.log('Todo esta procesado correctamente.');
        await pool.end();
        return;
    }

    let ok = 0;
    let fallidos = 0;

    for (let i = 0; i < pendientes.length; i++) {
        const inc = pendientes[i];
        console.log(`[${i + 1}/${pendientes.length}] Analizando: "${inc.titulo}"`);

        // Esperamos 4 segundos entre cada peticion para no superar el limite de Groq
        if (i > 0) await esperar(4000);

        const analisis = await analizarIncidencia(inc);

        if (!analisis) {
            console.log(`  -> Groq fallo, esperando 60 segundos antes de reintentar...`);
            await esperar(60000);

            // Reintento
            const reintento = await analizarIncidencia(inc);
            if (!reintento) {
                console.log(`  -> Reintento fallido, saltando esta incidencia.`);
                fallidos++;
                continue;
            }

            // Reintento exitoso
            await guardarSugerencia(inc.id, reintento, inc);
            ok++;
            continue;
        }

        await guardarSugerencia(inc.id, analisis, inc);
        ok++;
    }

    console.log('');
    console.log(`Proceso completado: ${ok} analizadas, ${fallidos} fallidas.`);
    await pool.end();
}

async function guardarSugerencia(incidenciaId, analisis, inc) {
    await pool.query(
        `UPDATE sugerencias_ia SET
            categoria_sugerida   = $1,
            prioridad_sugerida   = $2,
            tiempo_sugerido      = $3,
            descripcion_mejorada = $4,
            pasos_resolucion     = $5,
            causa_probable       = $6,
            subcategoria         = $7,
            impacto              = $8,
            escalado_recomendado = $9,
            nivel_escalado       = $10,
            etiquetas            = $11
         WHERE incidencia_id = $12`,
        [
            analisis.categoria_sugerida   || 'Sin clasificar',
            analisis.prioridad_sugerida   || inc.prioridad,
            analisis.tiempo_sugerido      || 'Sin estimar',
            analisis.descripcion_mejorada || inc.descripcion,
            analisis.pasos_resolucion     || 'Sin pasos sugeridos',
            analisis.causa_probable       || null,
            analisis.subcategoria         || null,
            analisis.impacto              || null,
            analisis.escalado_recomendado ?? false,
            analisis.nivel_escalado       || null,
            analisis.etiquetas            || [],
            incidenciaId
        ]
    );

    // Actualizamos tambien la categoria en la tabla incidencias
    await pool.query(
        'UPDATE incidencias SET categoria = $1 WHERE id = $2',
        [analisis.categoria_sugerida || 'Sin clasificar', incidenciaId]
    );

    console.log(`  -> OK: ${analisis.categoria_sugerida} | ${analisis.prioridad_sugerida} | ${analisis.tiempo_sugerido}`);
}

reprocesar().catch(err => {
    console.error('Error inesperado:', err);
    process.exit(1);
});
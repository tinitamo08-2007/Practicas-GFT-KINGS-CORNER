// ============================================================
// FUNCION: Recibir eventos de Jira y guardarlos en la BD.
//          Cuando llega un ticket nuevo de Jira, lo guardamos
//          y lanzamos el analisis de IA en segundo plano.
// ============================================================

const pool                                               = require('../db/pool');
const { analizarIncidencia }                             = require('../services/Iaservice');
const { actualizarEstadoEnJira, anadirComentarioEnJira } = require('../services/Jiraservice');

// Mapa de prioridades de Jira a nuestro formato interno
const MAPA_PRIORIDAD_JIRA = {
    'Highest': 'Critica',
    'High':    'Alta',
    'Medium':  'Media',
    'Low':     'Baja',
    'Lowest':  'Baja'
};

// Espera N milisegundos — sirve para no superar el limite de Groq
// Groq permite 30 peticiones/minuto en el tier gratuito
const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms));


// ============================================================
// POST /api/webhooks/jira
// Jira llama a esta URL cuando crea o modifica un ticket.
// Flujo:
//   1. Extraemos los datos del payload de Jira
//   2. Si ya existe en BD -> UPDATE y salimos (sin IA)
//   3. Si es nueva -> esperamos 2s, llamamos a la IA
//   4. Reservamos el ID y generamos el codigo ANTES del INSERT
//   5. Transaccion atomica: INSERT incidencia + INSERT sugerencia
//   6. COMMIT o ROLLBACK segun el resultado
// ============================================================
const recibirEventoJira = async (req, res) => {
    try {
        const payload = req.body;

        console.log('Webhook: Evento recibido de Jira:', payload?.webhookEvent || 'sin tipo');

        // Extraemos los datos del payload de Jira
        const jiraId        = payload?.issue?.key                                                    || null;
        const titulo        = payload?.issue?.fields?.summary                                        || 'Sin titulo';
        const descripcion   = payload?.issue?.fields?.description?.content?.[0]?.content?.[0]?.text || 'Sin descripcion';
        const prioridadJira = payload?.issue?.fields?.priority?.name                                || 'Medium';
        const estado        = payload?.issue?.fields?.status?.name                                   || 'Nueva';
        const prioridad     = MAPA_PRIORIDAD_JIRA[prioridadJira] || 'Media';

        // Comprobamos si ya tenemos esta incidencia en la BD
        const { rows: existentes } = await pool.query(
            'SELECT * FROM incidencias WHERE jira_id = $1', [jiraId]
        );

        if (jiraId && existentes.length > 0) {
            // Ya existe: solo actualizamos los campos que pueden cambiar en Jira
            await pool.query(
                `UPDATE incidencias
                 SET titulo = $1, descripcion = $2, estado = $3, fecha_actualizacion = NOW()
                 WHERE jira_id = $4`,
                [titulo, descripcion, estado, jiraId]
            );
            console.log(`Webhook: Incidencia ${jiraId} actualizada desde Jira.`);
            return res.json({ mensaje: `Incidencia ${jiraId} actualizada.` });
        }

        // ── Es nueva ──────────────────────────────────────────────

        // Delay de 4 segundos para respetar el limite de Groq (30 req/min)
        await esperar(4000);

        const datosParaIA = {
            titulo,
            descripcion,
            categoria:     'Sin clasificar',
            prioridad,
            reportado_por: payload?.issue?.fields?.reporter?.displayName || 'Jira',
            equipo:        null,
            origen:        'Web'
        };

        console.log(`Webhook: Analizando con IA el ticket Jira ${jiraId}...`);
        const analisis = await analizarIncidencia(datosParaIA);

        const categoriaFinal = analisis?.categoria_sugerida || 'Sin clasificar';
        const slaMs          = { 'Critica': 4, 'Alta': 24, 'Media': 48, 'Baja': 72 }[prioridad] || 48;
        const slaVencimiento = new Date(Date.now() + slaMs * 3600000).toISOString();

        // ── Transaccion atomica ───────────────────────────────────
        const cliente = await pool.connect();

        try {
            await cliente.query('BEGIN');

            // Reservamos el ID antes del INSERT para poder generar
            // el codigo legible dentro de la misma transaccion
            // evitando el error NOT NULL en la columna "codigo"
            const { rows: seqRows } = await cliente.query(
                "SELECT nextval('public.incidencias_id_seq') AS id"
            );
            const nuevoId = seqRows[0].id;
            const codigo  = `INC-${new Date().getFullYear()}-${String(nuevoId).padStart(6, '0')}`;

            const { rows } = await cliente.query(
                `INSERT INTO incidencias
                    (id, codigo, titulo, descripcion, estado, prioridad, categoria,
                     reportado_por, asignado_a, equipo, origen, jira_id, sla_vencimiento)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                 RETURNING *`,
                [
                    nuevoId,
                    codigo,
                    titulo,
                    descripcion,
                    estado,
                    prioridad,
                    categoriaFinal,
                    payload?.issue?.fields?.reporter?.displayName || 'Jira',
                    payload?.issue?.fields?.assignee?.displayName || null,
                    null,
                    'Web',
                    jiraId,
                    slaVencimiento
                ]
            );

            const nueva = rows[0];

            // INSERT sugerencia en la misma transaccion
            const { rows: filasSugerencia } = await cliente.query(
                `INSERT INTO sugerencias_ia
                    (incidencia_id, categoria_sugerida, prioridad_sugerida,
                     tiempo_sugerido, descripcion_mejorada, pasos_resolucion,
                     causa_probable, subcategoria, impacto,
                     escalado_recomendado, nivel_escalado, etiquetas)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                 RETURNING *`,
                [
                    nueva.id,
                    analisis?.categoria_sugerida   || 'Sin clasificar',
                    analisis?.prioridad_sugerida   || prioridad,
                    analisis?.tiempo_sugerido      || 'Sin estimar',
                    analisis?.descripcion_mejorada || descripcion,
                    analisis?.pasos_resolucion     || 'Sin pasos sugeridos',
                    analisis?.causa_probable       || null,
                    analisis?.subcategoria         || null,
                    analisis?.impacto              || null,
                    analisis?.escalado_recomendado ?? false,
                    analisis?.nivel_escalado       || null,
                    analisis?.etiquetas            || []
                ]
            );

            await cliente.query('COMMIT');

            console.log(`Webhook: ${codigo} (Jira: ${jiraId}) guardada correctamente.`);

            res.status(201).json({
                mensaje:       'Incidencia de Jira registrada con analisis de IA.',
                incidencia:    nueva,
                sugerencia_ia: filasSugerencia[0]
            });

        } catch (errTransaccion) {
            await cliente.query('ROLLBACK');
            console.error('Webhook: ROLLBACK — error en la transaccion:', errTransaccion.message);
            res.status(500).json({ error: 'Error al registrar la incidencia. La operacion fue revertida.' });
        } finally {
            cliente.release();
        }

    } catch (err) {
        console.error('Error al procesar evento de Jira:', err.message);
        res.status(500).json({ error: 'Error al procesar el evento de Jira.' });
    }
};


// ============================================================
// POST /api/webhooks/sincronizar/:id
// Sincroniza el estado de una incidencia nuestra hacia Jira
// ============================================================
const sincronizarHaciaJira = async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        const { rows } = await pool.query(
            'SELECT id, jira_id, estado, codigo FROM incidencias WHERE id = $1', [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: `No existe una incidencia con id ${id}.` });
        }

        const incidencia = rows[0];

        if (!incidencia.jira_id) {
            return res.status(400).json({ error: 'Esta incidencia no tiene un ticket asociado en Jira.' });
        }

        const exito = await actualizarEstadoEnJira(incidencia.jira_id, incidencia.estado);

        if (!exito) {
            return res.status(502).json({
                error: 'No se pudo actualizar el estado en Jira. Revisa los logs del servidor.'
            });
        }

        res.json({ mensaje: `Incidencia ${incidencia.jira_id} sincronizada con Jira correctamente.` });

    } catch (err) {
        console.error('Error al sincronizar con Jira:', err.message);
        res.status(500).json({ error: 'Error al sincronizar con Jira.' });
    }
};


module.exports = { recibirEventoJira, sincronizarHaciaJira };
// ============================================================
// FUNCION: Recibir eventos de Jira y guardarlos en la BD.
//          Cuando llega un ticket nuevo de Jira, lo guardamos
//          y lanzamos el analisis de IA en segundo plano.
// ============================================================

const pool                                               = require('../db/pool');
const { analizarIncidencia }                             = require('../services/Iaservice');
const { actualizarEstadoEnJira, anadirComentarioEnJira } = require('../services/Jiraservice');

// Mapa de prioridades de Jira a nuestro formato interno
// Jira usa nombres en ingles, nosotros usamos los nombres en español
const MAPA_PRIORIDAD_JIRA = {
    'Highest': 'Critica',
    'High':    'Alta',
    'Medium':  'Media',
    'Low':     'Baja',
    'Lowest':  'Baja'
};


// ============================================================
// POST /api/webhooks/jira
// Jira llama a esta URL cuando crea o modifica un ticket
// ============================================================
const recibirEventoJira = async (req, res) => {
    try {
        const payload = req.body;

        console.log('Webhook: Evento recibido de Jira:', payload?.webhookEvent || 'sin tipo');

        // Extraemos los datos del formato que usa Jira en su webhook
        const jiraId      = payload?.issue?.key                                                    || null;
        const titulo      = payload?.issue?.fields?.summary                                        || 'Sin titulo';
        const descripcion = payload?.issue?.fields?.description?.content?.[0]?.content?.[0]?.text || 'Sin descripcion';
        const prioridadJira = payload?.issue?.fields?.priority?.name                              || 'Medium';
        const estado      = payload?.issue?.fields?.status?.name                                   || 'Nueva';

        // Convertimos la prioridad de Jira a nuestra prioridad interna
        const prioridad = MAPA_PRIORIDAD_JIRA[prioridadJira] || 'Media';

        // Comprobamos si ya tenemos esta incidencia en la BD
        // La columna jira_id tiene UNIQUE en la BD, no pueden repetirse
        const { rows: existentes } = await pool.query(
            'SELECT * FROM incidencias WHERE jira_id = $1', [jiraId]
        );

        if (jiraId && existentes.length > 0) {
            // Ya existe: actualizamos solo los campos que pueden cambiar en Jira
            await pool.query(
                `UPDATE incidencias
                 SET titulo = $1, descripcion = $2, estado = $3, fecha_actualizacion = NOW()
                 WHERE jira_id = $4`,
                [titulo, descripcion, estado, jiraId]
            );
            console.log(`Webhook: Incidencia ${jiraId} actualizada desde Jira.`);
            return res.json({ mensaje: `Incidencia ${jiraId} actualizada.` });
        }

        // No existe: la creamos en la BD
        // Los campos NOT NULL que Jira no manda los rellenamos con valores por defecto
        const { rows } = await pool.query(
            `INSERT INTO incidencias
                (titulo, descripcion, estado, prioridad, categoria,
                 reportado_por, asignado_a, equipo, origen, jira_id, sla_vencimiento)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [
                titulo,
                descripcion,
                estado,
                prioridad,
                'Sin clasificar',   // la IA lo clasificara en segundo plano
                payload?.issue?.fields?.reporter?.displayName || 'Jira',
                payload?.issue?.fields?.assignee?.displayName || null,
                null,
                'Web',
                jiraId,
                // Calculamos el SLA segun la prioridad que vino de Jira
                new Date(Date.now() + ({ 'Critica': 4, 'Alta': 24, 'Media': 48, 'Baja': 72 }[prioridad] || 48) * 3600000).toISOString()
            ]
        );

        const nueva = rows[0];

        // Generamos y guardamos el codigo legible
        const codigo = `INC-${new Date().getFullYear()}-${String(nueva.id).padStart(6, '0')}`;
        await pool.query('UPDATE incidencias SET codigo = $1 WHERE id = $2', [codigo, nueva.id]);
        nueva.codigo = codigo;

        // Lanzamos la IA en segundo plano, igual que en incidenciasController.crear
        analizarIncidencia(nueva)
            .then(async (analisis) => {
                if (!analisis) return;
                try {
                    await pool.query(
                        `INSERT INTO sugerencias_ia
                            (incidencia_id, categoria_sugerida, prioridad_sugerida,
                             tiempo_sugerido, descripcion_mejorada, pasos_resolucion,
                             causa_probable, subcategoria, impacto,
                             escalado_recomendado, nivel_escalado, etiquetas)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                        [
                            nueva.id,
                            analisis.categoria_sugerida   || 'Sin clasificar',
                            analisis.prioridad_sugerida   || 'Media',
                            analisis.tiempo_sugerido      || 'Sin estimar',
                            analisis.descripcion_mejorada || nueva.descripcion,
                            analisis.pasos_resolucion     || 'Sin pasos sugeridos',
                            analisis.causa_probable       || null,
                            analisis.subcategoria         || null,
                            analisis.impacto              || null,
                            analisis.escalado_recomendado ?? false,
                            analisis.nivel_escalado       || null,
                            analisis.etiquetas            || []
                        ]
                    );

                    // Actualizamos la categoria con lo que dijo la IA
                    await pool.query(
                        'UPDATE incidencias SET categoria = $1 WHERE id = $2',
                        [analisis.categoria_sugerida || 'Sin clasificar', nueva.id]
                    );

                    console.log(`IA: Sugerencia guardada para incidencia de Jira ${jiraId}`);
                } catch (errGuardado) {
                    console.error('Error guardando sugerencia IA desde webhook:', errGuardado.message);
                }
            })
            .catch(err => console.error('Error en IA para webhook:', err.message));

        res.status(201).json({ mensaje: 'Incidencia de Jira registrada.', incidencia: nueva });

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
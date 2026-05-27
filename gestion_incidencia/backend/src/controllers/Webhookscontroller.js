// ============================================================
// ARCHIVO: src/controllers/webhooksController.js
// CAMBIOS: Ahora puede sincronizar estado de vuelta a Jira
//          y llama a la IA al recibir un ticket nuevo de Jira
// ============================================================

const incidencias = require('../db/Mockincidencias');
const { analizarIncidencia }   = require('../services/Iaservice');
const { actualizarEstadoEnJira, anadirComentarioEnJira } = require('../services/Jiraservice');

let proximoIdWebhook = 101;


// ============================================================
// POST /api/webhooks/jira
// Jira llama a esta URL cuando crea o modifica un ticket
// ============================================================
const recibirEventoJira = async (req, res) => {
    try {
        const payload = req.body;

        console.log('Evento recibido de Jira:', payload?.webhookEvent || 'sin tipo');

        // Extraemos los datos del formato de Jira
        const jiraId      = payload?.issue?.key                    || null;
        const titulo      = payload?.issue?.fields?.summary        || 'Sin titulo';
        const descripcion = payload?.issue?.fields?.description?.content?.[0]?.content?.[0]?.text || '';
        const prioridad   = payload?.issue?.fields?.priority?.name || 'Media';
        const estado      = payload?.issue?.fields?.status?.name   || 'Nueva';

        // Comprobamos si ya tenemos esta incidencia
        const indiceExistente = incidencias.findIndex(inc => inc.jira_id === jiraId);

        if (jiraId && indiceExistente !== -1) {
            // Ya existe: actualizamos con los datos nuevos de Jira
            incidencias[indiceExistente] = {
                ...incidencias[indiceExistente],
                titulo,
                descripcion,
                estado,
                fecha_actualizacion: new Date().toISOString()
            };

            console.log(`Incidencia ${jiraId} actualizada desde Jira.`);
            return res.json({ mensaje: `Incidencia ${jiraId} actualizada.` });
        }

        // No existe: la creamos nueva
        const ahora  = new Date().toISOString();
        const nuevaId = proximoIdWebhook;

        const nueva = {
            id:                  nuevaId,
            codigo:              `INC-${new Date().getFullYear()}-${String(nuevaId).padStart(6, '0')}`,
            jira_id:             jiraId,
            titulo, descripcion, estado, prioridad,
            categoria:           null,
            reportado_por:       payload?.issue?.fields?.reporter?.displayName || null,
            asignado_a:          payload?.issue?.fields?.assignee?.displayName || null,
            equipo:              null,
            origen:              'Web',
            causa:               null,
            solucion:            null,
            fecha_creacion:      ahora,
            fecha_actualizacion: ahora,
            fecha_cierre:        null,
            sla_vencimiento:     null,
            ia_procesada:        false
        };

        incidencias.push(nueva);
        proximoIdWebhook++;

        // Llamamos a la IA en segundo plano (igual que en crear)
        analizarIncidencia(nueva)
            .then(analisis => {
                if (analisis) {
                    console.log(`IA proceso incidencia de Jira ${jiraId}`);
                    // Aqui guardaremos la sugerencia cuando tengamos BD
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
// Sincroniza el estado de una incidencia nuestra hacia Jira.
// Lo usa el tecnico cuando actualiza el estado en nuestro panel
// y quiere que Jira tambien se actualice.
// ============================================================
const sincronizarHaciaJira = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const incidencia = incidencias.find(inc => inc.id === id);

        if (!incidencia) {
            return res.status(404).json({ error: `No existe una incidencia con id ${id}.` });
        }

        if (!incidencia.jira_id) {
            return res.status(400).json({ error: 'Esta incidencia no tiene un ticket asociado en Jira.' });
        }

        // Intentamos actualizar el estado en Jira
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
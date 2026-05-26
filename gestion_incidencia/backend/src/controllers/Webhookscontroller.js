// ============================================================
// FUNCION: Recibir notificaciones automaticas de Jira.
//          Por ahora guarda en el array en memoria.
// ============================================================

const incidencias = require('../db/Mockincidencias');

// Importamos las funciones auxiliares del otro controller
// para no repetir codigo (calcularSLA y generarCodigo)
const { crear } = require('./incidenciasController');

let proximoIdWebhook = 101; // IDs separados para los que vengan de Jira


// ============================================================
// POST /api/webhooks/jira
// Jira llama a esta URL automaticamente cuando crea o cambia un ticket
// ============================================================
const recibirEventoJira = (req, res) => {
    try {
        const payload = req.body;

        // Mostramos lo que llego de Jira en la consola del servidor
        console.log('Evento recibido de Jira:', JSON.stringify(payload, null, 2));

        // Extraemos los campos del formato que usa Jira
        const jiraId      = payload?.issue?.key                    || null;
        const titulo      = payload?.issue?.fields?.summary        || 'Sin titulo';
        const descripcion = payload?.issue?.fields?.description    || '';
        const prioridad   = payload?.issue?.fields?.priority?.name || 'Media';
        const estado      = payload?.issue?.fields?.status?.name   || 'Nueva';

        // Buscamos si esta incidencia ya existe en nuestro array
        const indiceExistente = incidencias.findIndex(inc => inc.jira_id === jiraId);

        if (jiraId && indiceExistente !== -1) {
            // Si ya existe, actualizamos los campos que manda Jira
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

        // Si no existe, la creamos nueva en el array
        const ahora = new Date().toISOString();
        const nueva = {
            id:                  proximoIdWebhook,
            codigo:              `INC-${new Date().getFullYear()}-${String(proximoIdWebhook).padStart(6, '0')}`,
            jira_id:             jiraId,
            titulo,
            descripcion,
            estado,
            prioridad,
            categoria:           null,
            reportado_por:       null,
            asignado_a:          null,
            equipo:              null,
            origen:              'Web',
            causa:               null,
            solucion:            null,
            fecha_creacion:      ahora,
            fecha_actualizacion: ahora,
            fecha_cierre:        null,
            sla_vencimiento:     null  // La IA lo calculara cuando este lista
        };

        incidencias.push(nueva);
        proximoIdWebhook++;

        // Aqui llamaremos a LangGraph cuando este disponible
        // LangGraph es externo (no esta en Docker), se llama por HTTP:
        //
        // const respuestaIA = await fetch('http://url-de-langgraph/analizar', {
        //     method: 'POST',
        //     body: JSON.stringify(nueva)
        // });
        //
        // Por ahora dejamos este comentario para cuando lo integremos.

        res.status(201).json({ mensaje: 'Incidencia registrada desde Jira.', incidencia: nueva });

    } catch (err) {
        console.error('Error al procesar evento de Jira:', err.message);
        res.status(500).json({ error: 'Error al procesar el evento de Jira.' });
    }
};


module.exports = { recibirEventoJira };
// ============================================================
// FUNCION: Todas las llamadas a la API de Jira van aqui.
//
//          El resto del codigo (controllers, routes) nunca
//          llama a Jira directamente. Solo usa este archivo.
//          Asi, si cambia la API de Jira, solo tocamos este archivo.
//
// AUTENTICACION:
//   Jira Cloud usa "Basic Auth".
//   Se codifica "email:api_token" en Base64 y se manda en cada peticion.
//   El token se genera en: https://id.atlassian.com/manage-profile/security/api-tokens
// ============================================================


// ── Construimos la cabecera de autenticacion ──────────────────
// Buffer.from().toString('base64') convierte texto a Base64
// Ejemplo: "user@mail.com:mitoken" -> "dXNlckBtYWlsLmNvbTptaXRva2Vu"
const construirCabecerasJira = () => {
    const credenciales = `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`;
    const base64       = Buffer.from(credenciales).toString('base64');

    return {
        'Authorization': `Basic ${base64}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json'
    };
};

// URL base de la API de Jira (siempre v3 para Jira Cloud)
const urlBase = () => `https://${process.env.JIRA_DOMINIO}/rest/api/3`;

// FUNCION: obtenerIncidenciasDeJira
// Trae los tickets del proyecto desde Jira usando JQL.
//
// JQL es el lenguaje de busqueda de Jira. Ejemplos:
//   project = GFT ORDER BY created DESC
//   project = GFT AND status = "In Progress"

const obtenerIncidenciasDeJira = async () => {
    try {
        // JQL: traemos todos los tickets del proyecto ordenados por fecha
        const jql        = `project = ${process.env.JIRA_PROJECT_KEY} ORDER BY created DESC`;
        const maxResults = 50;

        const url      = `${urlBase()}/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}`;
        const respuesta = await fetch(url, { headers: construirCabecerasJira() });

        // Si Jira devuelve error, lo capturamos con un mensaje
        if (!respuesta.ok) {
            const error = await respuesta.json();
            console.error('Error de Jira al obtener incidencias:', respuesta.status, error);
            return null;
        }

        const datos = await respuesta.json();

        // Transformamos el formato de Jira a nuestro formato interno
        // Jira devuelve muchos campos que no necesitamos, nos quedamos con los utiles
        const incidencias = datos.issues.map(ticket => ({
            jira_id:      ticket.key,                              // Ej: GFT-42
            titulo:       ticket.fields.summary,
            descripcion:  ticket.fields.description?.content?.[0]?.content?.[0]?.text || '',
            estado:       ticket.fields.status?.name || 'Nueva',
            prioridad:    ticket.fields.priority?.name || 'Media',
            reportado_por: ticket.fields.reporter?.displayName || null,
            asignado_a:   ticket.fields.assignee?.displayName || null,
            fecha_creacion: ticket.fields.created
        }));

        return incidencias;

    } catch (err) {
        // Si hay un error de red (Jira no responde, sin internet, etc.)
        console.error('Error de red al conectar con Jira:', err.message);
        return null;
    }
};

// FUNCION: crearTicketEnJira
// Crea un ticket nuevo en Jira a partir de una incidencia nuestra.
//
// El campo "description" en Jira v3 usa un formato especial llamado
// Atlassian Document Format (ADF), no texto plano. 

const crearTicketEnJira = async (incidencia) => {
    try {
        // Mapeamos nuestra prioridad al formato que entiende Jira
        const mapaPrioridad = {
            'Critica': 'Highest',
            'Alta':    'High',
            'Media':   'Medium',
            'Baja':    'Low'
        };

        // Cuerpo de la peticion en el formato que exige Jira API v3
        const cuerpo = {
            fields: {
                project:  { key: process.env.JIRA_PROJECT_KEY },
                summary:  incidencia.titulo,
                priority: { name: mapaPrioridad[incidencia.prioridad] || 'Medium' },
                issuetype: { name: 'Bug' }, // Cambiarlo segun vuestros tipos en Jira

                // Descripcion en formato ADF (obligatorio en Jira API v3)
                description: {
                    type:    'doc',
                    version: 1,
                    content: [
                        {
                            type:    'paragraph',
                            content: [{ type: 'text', text: incidencia.descripcion || '' }]
                        }
                    ]
                }
            }
        };

        const respuesta = await fetch(`${urlBase()}/issue`, {
            method:  'POST',
            headers: construirCabecerasJira(),
            body:    JSON.stringify(cuerpo)
        });

        if (!respuesta.ok) {
            const error = await respuesta.json();
            console.error('Error de Jira al crear ticket:', respuesta.status, error);
            return null;
        }

        const ticketCreado = await respuesta.json();
        console.log(`Ticket creado en Jira: ${ticketCreado.key}`);

        // Devolvemos la clave del ticket (ej: "GFT-42")
        return ticketCreado.key;

    } catch (err) {
        console.error('Error de red al crear ticket en Jira:', err.message);
        return null;
    }
};


// FUNCION: actualizarEstadoEnJira
// Cambia el estado de un ticket en Jira (transicion).
//
// En Jira, cambiar el estado no es un PUT normal.
// Hay que hacer una "transicion" con el ID de esa transicion.
// Primero hay que pedir las transiciones disponibles y luego aplicar una.

const actualizarEstadoEnJira = async (jiraId, nuevoEstado) => {
    try {
        // Paso 1: pedimos que transiciones estan disponibles para este ticket
        const urlTransiciones = `${urlBase()}/issue/${jiraId}/transitions`;
        const respTransiciones = await fetch(urlTransiciones, { headers: construirCabecerasJira() });

        if (!respTransiciones.ok) {
            console.error('Error al obtener transiciones de Jira:', respTransiciones.status);
            return false;
        }

        const datosTransiciones = await respTransiciones.json();

        // Mapeamos nuestros estados al nombre que usa Jira
        const mapaEstados = {
            'En progreso': 'In Progress',
            'Resuelta':    'Done',
            'Cerrada':     'Done',
            'Cancelada':   'Cancelled'
        };

        const nombreJira = mapaEstados[nuevoEstado];
        if (!nombreJira) {
            // Si el estado no tiene equivalente en Jira, no hacemos nada
            return false;
        }

        // Buscamos la transicion que coincida con el estado que queremos
        const transicion = datosTransiciones.transitions.find(
            t => t.name.toLowerCase() === nombreJira.toLowerCase()
        );

        if (!transicion) {
            console.error(`No se encontro la transicion "${nombreJira}" en Jira para ${jiraId}`);
            return false;
        }

        // Paso 2: aplicamos la transicion
        const respuesta = await fetch(urlTransiciones, {
            method:  'POST',
            headers: construirCabecerasJira(),
            body:    JSON.stringify({ transition: { id: transicion.id } })
        });

        if (!respuesta.ok) {
            console.error('Error al aplicar transicion en Jira:', respuesta.status);
            return false;
        }

        console.log(`Estado de ${jiraId} actualizado en Jira a "${nuevoEstado}"`);
        return true;

    } catch (err) {
        console.error('Error de red al actualizar estado en Jira:', err.message);
        return false;
    }
};


// FUNCION: anadirComentarioEnJira
// Anade un comentario en un ticket de Jira.
// Lo usamos cuando el tecnico acepta o rechaza una sugerencia de IA.

const anadirComentarioEnJira = async (jiraId, texto) => {
    try {
        const cuerpo = {
            body: {
                type:    'doc',
                version: 1,
                content: [
                    {
                        type:    'paragraph',
                        content: [{ type: 'text', text: texto }]
                    }
                ]
            }
        };

        const respuesta = await fetch(`${urlBase()}/issue/${jiraId}/comment`, {
            method:  'POST',
            headers: construirCabecerasJira(),
            body:    JSON.stringify(cuerpo)
        });

        if (!respuesta.ok) {
            console.error('Error al anadir comentario en Jira:', respuesta.status);
            return false;
        }

        return true;

    } catch (err) {
        console.error('Error de red al anadir comentario en Jira:', err.message);
        return false;
    }
};


module.exports = {
    obtenerIncidenciasDeJira,
    crearTicketEnJira,
    actualizarEstadoEnJira,
    anadirComentarioEnJira
};
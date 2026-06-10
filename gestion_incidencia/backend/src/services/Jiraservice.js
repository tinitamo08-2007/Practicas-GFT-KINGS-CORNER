// ============================================================
// FUNCION: Todas las llamadas a la API de Jira van aqui.
//
// URLs correctas de la API de Jira v3:
//   Buscar tickets:  GET  /rest/api/3/search?jql=...
//   Crear ticket:    POST /rest/api/3/issue
//   Transiciones:    GET/POST /rest/api/3/issue/{key}/transitions
//   Comentarios:     POST /rest/api/3/issue/{key}/comment
// ============================================================


// Construye los headers de autenticacion para cada peticion.
// Jira Cloud usa "Basic Auth": se codifica "email:token" en Base64.
const construirCabecerasJira = () => {
    const credenciales = `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`;
    const base64       = Buffer.from(credenciales).toString('base64');
    return {
        'Authorization': `Basic ${base64}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json'
    };
};

// URL base de la API de Jira.
// IMPORTANTE: es solo la raiz, cada funcion anade su ruta especifica.
const urlBase = () => `https://${process.env.JIRA_DOMINIO}/rest/api/3`;

// ============================================================
// FUNCION: obtenerIncidenciasDeJira
// Trae los tickets del proyecto desde Jira.
// JQL es el lenguaje de busqueda de Jira. 
// ============================================================
const obtenerIncidenciasDeJira = async () => {
    try {
        const jql        = `project = ${process.env.JIRA_PROJECT_KEY} ORDER BY created DESC`;
        const maxResults = 100;

        // La URL de busqueda es /rest/api/3/search?jql=...
        const url = `${urlBase()}/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}`;

        const respuesta = await fetch(url, { headers: construirCabecerasJira() });

        if (!respuesta.ok) {
            const error = await respuesta.json();
            console.error('Error de Jira al obtener incidencias:', respuesta.status, error);
            return null;
        }

        const datos = await respuesta.json();

        // Transformamos el formato de Jira al nuestro
        const incidencias = datos.issues.map(ticket => ({
            jira_id:       ticket.key,
            titulo:        ticket.fields.summary,
            descripcion:   ticket.fields.description?.content?.[0]?.content?.[0]?.text || '',
            estado:        ticket.fields.status?.name    || 'Por hacer',
            prioridad:     ticket.fields.priority?.name  || 'Media',
            reportado_por: ticket.fields.reporter?.displayName || null,
            asignado_a:    ticket.fields.assignee?.displayName || null,
            fecha_creacion: ticket.fields.created
        }));

        return incidencias;

    } catch (err) {
        console.error('Error de red al conectar con Jira:', err.message);
        return null;
    }
};


// ============================================================
// FUNCION: crearTicketEnJira
// Crea un ticket nuevo en Jira a partir de una incidencia nuestra.
// La descripcion en Jira v3 usa formato ADF (Atlassian Document Format).
// ============================================================
const crearTicketEnJira = async (incidencia) => {
    try {
        const mapaPrioridad = {
            'Critica': 'Highest',
            'Alta':    'High',
            'Media':   'Medium',
            'Baja':    'Low'
        };

        const cuerpo = {
            fields: {
                project:   { key: process.env.JIRA_PROJECT_KEY },
                summary:   incidencia.titulo,
                priority:  { name: mapaPrioridad[incidencia.prioridad] || 'Medium' },
                issuetype: { name: 'Bug' },
                // Descripcion en formato ADF obligatorio en Jira API v3
                description: {
                    type:    'doc',
                    version: 1,
                    content: [{
                        type:    'paragraph',
                        content: [{ type: 'text', text: incidencia.descripcion || '' }]
                    }]
                }
            }
        };

        // La URL para crear tickets es /rest/api/3/issue
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
        return ticketCreado.key;

    } catch (err) {
        console.error('Error de red al crear ticket en Jira:', err.message);
        return null;
    }
};


// ============================================================
// FUNCION: actualizarEstadoEnJira
// Cambia el estado de un ticket en Jira.
// En Jira, cambiar el estado se hace con "transiciones", no con PUT.
// Hay que pedir las transiciones disponibles y luego aplicar la correcta.
//
// ESTADOS VALIDOS EN ESTE PROYECTO:
//   'Por hacer'   -> ticket recien creado o sin iniciar
//   'En curso'    -> se esta trabajando en el ticket
//   'En revision' -> pendiente de validacion
//   'Finalizado'  -> ticket completado o cancelado
// ============================================================
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

        // Mapeamos nuestros estados directamente a los estados de Jira.
        // Los nombres coinciden exactamente con los configurados en el proyecto
        // (verificado con GET /rest/api/3/issue/{key}/transitions):
        //   11 -> Por hacer
        //   21 -> En curso
        //   31 -> En revision
        //   41 -> Finalizado
        const mapaEstados = {
            'Por hacer':   'Por hacer',
            'En curso':    'En curso',
            'En revisión': 'En revisión',
            'Finalizado':  'Finalizado'
        };

        const nombreJira = mapaEstados[nuevoEstado];
        if (!nombreJira) {
            console.error(`Estado "${nuevoEstado}" no reconocido. Estados validos: ${Object.keys(mapaEstados).join(', ')}`);
            return false;
        }

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


// ============================================================
// FUNCION: anadirComentarioEnJira
// Anade un comentario en un ticket de Jira.
// ============================================================
const anadirComentarioEnJira = async (jiraId, texto) => {
    try {
        const cuerpo = {
            body: {
                type:    'doc',
                version: 1,
                content: [{
                    type:    'paragraph',
                    content: [{ type: 'text', text: texto }]
                }]
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
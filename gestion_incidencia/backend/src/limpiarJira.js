// ============================================================
// ARCHIVO: scripts/limpiarJira.js
// FUNCION: Borrar todos los tickets del proyecto GFT en Jira
//          y limpiar la base de datos local.
//
// Como ejecutarlo:
//   node scripts/limpiarJira.js
// ============================================================

require('dotenv').config();

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

// Obtiene todos los tickets del proyecto
async function obtenerTodosLosTickets() {
    let tickets = [];
    let startAt = 0;
    const maxResults = 100;

    while (true) {
        const jql = `project = ${PROYECTO} ORDER BY created DESC`;
        const url = `${JIRA_API_BASE}/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&startAt=${startAt}&fields=summary`;

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

// Borra un ticket por su key (ej: GFT-101)
async function borrarTicket(key) {
    const url  = `${JIRA_API_BASE}/issue/${key}`;
    const resp = await fetch(url, { method: 'DELETE', headers: cabeceras });

    if (resp.status === 204) {
        console.log(`Borrado: ${key}`);
        return true;
    } else {
        const data = await resp.text();
        console.error(`Error al borrar ${key}:`, data.substring(0, 100));
        return false;
    }
}

async function limpiarJira() {
    console.log(`Obteniendo tickets del proyecto ${PROYECTO}...`);
    const tickets = await obtenerTodosLosTickets();
    console.log(`Encontrados: ${tickets.length} tickets`);

    if (tickets.length === 0) {
        console.log('No hay tickets que borrar.');
        return;
    }

    let borrados = 0;
    let fallidos = 0;

    for (const ticket of tickets) {
        const ok = await borrarTicket(ticket.key);
        if (ok) borrados++; else fallidos++;
        // Pequeña pausa para no superar el rate limit de Jira
        await new Promise(r => setTimeout(r, 300));
    }

    console.log('');
    console.log(`Proceso completado: ${borrados} borrados, ${fallidos} fallidos.`);
}

limpiarJira().catch(err => {
    console.error('Error inesperado:', err);
    process.exit(1);
});
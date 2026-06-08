// ============================================================
// ARCHIVO: scripts/limpiarJiraRango.js
// FUNCION: Borra de Jira todos los tickets EXCEPTO los que
//          están en el rango GFT-226 a GFT-325.
// ============================================================

const DOMINIO  = 'proyectogft.atlassian.net';
const EMAIL    = 'gmendoza@steam.thehubfp.es';
const TOKEN    = 'ATATT3xFfGF0An2kuYVkMgxJFJYoVJjTWbQCJ2jkZYA8P6c5HgUKa-VLRCmEU3Rjtq9n9E-OSvqAYo0OPxx2ORnLRNoEuiSlF1rCDMqJiZJKyIJ2ICc6b7sEVQdzXbXJbEdtYtMVYGCWrNjbuakE_gEQC0YDIHb7S7OmAG3M72aDOMavLTKiVp4=601EEA23';
const PROYECTO = 'GFT';

const RANGO_MIN = 226;
const RANGO_MAX = 325;

const JIRA_API_BASE = `https://${DOMINIO}/rest/api/3`;
const CABECERA_AUTH = 'Basic ' + Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64');
const cabeceras = {
    'Authorization': CABECERA_AUTH,
    'Content-Type':  'application/json',
    'Accept':        'application/json'
};

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
            console.error('Error al obtener tickets:', JSON.stringify(data).substring(0, 200));
            break;
        }

        const issues = data.issues || [];
        tickets = tickets.concat(issues);
        console.log(`  Obtenidos ${tickets.length} tickets...`);

        // Si devuelve menos de maxResults, es la ultima pagina
        if (issues.length < maxResults) break;
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

function debeConservar(key) {
    const numero = parseInt(key.split('-')[1]);
    return numero >= RANGO_MIN && numero <= RANGO_MAX;
}

async function limpiar() {
    console.log(`Obteniendo todos los tickets del proyecto ${PROYECTO}...`);
    const todos = await obtenerTodosLosTickets();
    console.log(`Total en Jira: ${todos.length} tickets`);

    const conservar = todos.filter(t => debeConservar(t.key));
    const borrar    = todos.filter(t => !debeConservar(t.key));

    console.log(`Tickets a conservar (GFT-${RANGO_MIN} a GFT-${RANGO_MAX}): ${conservar.length}`);
    console.log(`Tickets a borrar: ${borrar.length}`);
    console.log('');

    if (borrar.length === 0) {
        console.log('No hay tickets fuera del rango. Jira ya esta limpio.');
        return;
    }

    let borrados = 0;
    let fallidos = 0;

    for (const ticket of borrar) {
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
    console.log(`Jira ahora tiene ${conservar.length} tickets (GFT-${RANGO_MIN} a GFT-${RANGO_MAX}).`);
}

limpiar().catch(err => {
    console.error('Error inesperado:', err);
    process.exit(1);
});
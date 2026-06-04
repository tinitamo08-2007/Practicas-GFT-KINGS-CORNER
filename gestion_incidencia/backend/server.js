// ============================================================
// ARCHIVO: server.js
// FUNCION: Punto de entrada del backend.
//          Carga el .env, registra las rutas y arranca el servidor.
//          Antes de arrancar, prueba que la BD responde.
// ============================================================

// dotenv debe ser la primera linea para que todos los modulos
// puedan leer process.env desde el principio
require('dotenv').config();
const pool    = require('./src/db/pool');
const express = require('express');
const cors    = require('cors');


const app  = express();
const PORT = process.env.PORT || 3000;

// cors() permite que el frontend Angular (en otro puerto) llame a esta API
app.use(cors());

// express.json() convierte el body de las peticiones POST/PUT a objeto JS
app.use(express.json());

// Importamos las rutas
const rutasIncidencias = require('./src/routes/incidencias');
const rutasWebhooks    = require('./src/routes/webhooks');

// Ruta de prueba basica
app.get('/api/prueba', (req, res) => {
    res.json({ mensaje: 'El servidor esta funcionando correctamente.' });
});

// Ruta de prueba para verificar que Jira responde
// Borrala cuando ya no la necesites
app.get('/api/test-jira', async (req, res) => {
    const { obtenerIncidenciasDeJira } = require('./src/services/Jiraservice');
    const resultado = await obtenerIncidenciasDeJira();
    if (resultado) {
        res.json({ ok: true, total: resultado.length, tickets: resultado });
    } else {
        res.status(500).json({ ok: false, mensaje: 'Fallo la conexion con Jira. Revisa los logs.' });
    }
});

// Registramos las rutas
app.use('/api/incidencias', rutasIncidencias);
app.use('/api/webhooks',    rutasWebhooks);


// ── Arranque del servidor ────────────────────────────────────
// Antes de empezar a escuchar peticiones, comprobamos que la BD
// esta activa con una consulta simple. Si falla, no arrancamos.
pool.query('SELECT 1')
    .then(() => {
        console.log('BD: Conexion a PostgreSQL establecida correctamente.');

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Servidor corriendo en el puerto ${PORT}`);
            console.log(`IA configurada:   ${process.env.IA_PROVEEDOR || 'no configurado'}`);
            console.log(`Jira configurado: ${process.env.JIRA_DOMINIO || 'no configurado'}`);
            console.log(`Prueba:       http://localhost:${PORT}/api/prueba`);
            console.log(`Incidencias:  http://localhost:${PORT}/api/incidencias`);
            console.log(`Webhook Jira: http://localhost:${PORT}/api/webhooks/jira`);
        });
    })
    .catch((err) => {
        console.error('No se pudo conectar a PostgreSQL:', err.message);
        console.error('Comprueba que PostgreSQL esta corriendo y que los datos del .env son correctos.');
        process.exit(1); // Cierra el proceso con codigo de error
    });
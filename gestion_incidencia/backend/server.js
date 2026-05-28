// ============================================================
// FUNCION: Punto de entrada del backend.
//          Por ahora sin base de datos. Cuando la tengamos,
//          volvemos a anadir el pool de PostgreSQL aqui.
// Es lo primero que se ejecuta cuando haces npm start. 
// Su unica funcion es arrancar el servidor, cargar las variables del .env, y decirle a Express que rutas existen. 
// ============================================================

// servicios de Jira e IA
// necesitan leer process.env cuando se cargan.
require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Importamos las rutas 
const rutasIncidencias = require('./src/routes/incidencias');
const rutasWebhooks    = require('./src/routes/webhooks');


//  Ruta de prueba
app.get('/api/prueba', (req, res) => {
    res.json({ mensaje: 'El servidor esta funcionando correctamente.' });
});

//  Registramos las rutas
// Todo lo que empiece por /api/incidencias va al router de incidencias
// Todo lo que empiece por /api/webhooks va al router de webhooks
app.use('/api/incidencias', rutasIncidencias);
app.use('/api/webhooks',    rutasWebhooks);


// ── Arrancamos el servidor ───────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
    console.log(`Proveedor IA configurado: ${process.env.IA_PROVEEDOR || 'no configurado'}`);
    console.log(`Dominio Jira configurado: ${process.env.JIRA_DOMINIO || 'no configurado'}`);
    console.log(`Prueba:       http://localhost:${PORT}/api/prueba`);
    console.log(`Incidencias:  http://localhost:${PORT}/api/incidencias`);
    console.log(`Webhook Jira: http://localhost:${PORT}/api/webhooks/jira`);
});
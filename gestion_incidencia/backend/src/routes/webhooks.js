// ============================================================
// ARCHIVO: src/routes/webhooks.js
// FUNCION: Ruta para recibir eventos de Jira.
// ============================================================

const express = require('express');
const router  = express.Router();

const { recibirEventoJira } = require('../controllers/Webhookscontroller');

// POST /api/webhooks/jira
// Esta URL la configuramos en Jira para que nos avise de cambios
router.post('/jira', recibirEventoJira);

module.exports = router;
// ============================================================
// CAMBIOS: Se añade ruta para sincronizar hacia Jira
// ============================================================

const express = require('express');
const router  = express.Router();

const { recibirEventoJira, sincronizarHaciaJira } = require('../controllers/Webhookscontroller');

// POST /api/webhooks/jira              -> Jira nos avisa de cambios
router.post('/jira', recibirEventoJira);

// POST /api/webhooks/sincronizar/5     -> nosotros actualizamos Jira
router.post('/sincronizar/:id', sincronizarHaciaJira);

module.exports = router;
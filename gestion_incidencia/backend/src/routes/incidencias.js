// ============================================================
// ARCHIVO: src/routes/incidencias.js
// CAMBIOS: Se añaden dos rutas nuevas para la sugerencia de IA
// ============================================================

const express = require('express');
const router  = express.Router();

const {
    obtenerTodas,
    obtenerPorId,
    crear,
    actualizar,
    eliminar,
    obtenerSugerencia,
    revisarSugerencia
} = require('../controllers/incidenciasController');

// GET    /api/incidencias              -> lista todas
router.get('/',    obtenerTodas);

// GET    /api/incidencias/5            -> detalle con sugerencia incluida
router.get('/:id', obtenerPorId);

// POST   /api/incidencias              -> crear (lanza IA en segundo plano)
router.post('/',   crear);

// PUT    /api/incidencias/5            -> actualizar
router.put('/:id', actualizar);

// DELETE /api/incidencias/5            -> eliminar
router.delete('/:id', eliminar);

// GET    /api/incidencias/5/sugerencia -> consultar si la IA ya proceso esta incidencia
router.get('/:id/sugerencia', obtenerSugerencia);

// PATCH  /api/incidencias/5/sugerencia -> tecnico acepta o rechaza la sugerencia
router.patch('/:id/sugerencia', revisarSugerencia);

module.exports = router;
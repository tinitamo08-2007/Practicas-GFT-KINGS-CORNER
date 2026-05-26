// ============================================================
// FUNCION: Conectar cada URL con su funcion del controller..
// ============================================================

const express = require('express');
const router  = express.Router();

const {
    obtenerTodas,
    obtenerPorId,
    crear,
    actualizar,
    eliminar
} = require('../controllers/incidenciasController');

// GET    /api/incidencias        --> todas las incidencias
router.get('/',    obtenerTodas);

// GET    /api/incidencias/5      --> una incidencia por id
router.get('/:id', obtenerPorId);

// POST   /api/incidencias        --> crear una nueva
router.post('/',   crear);

// PUT    /api/incidencias/5      --> actualizar la incidencia con id 5
router.put('/:id', actualizar);

// DELETE /api/incidencias/5      --> eliminar la incidencia con id 5
router.delete('/:id', eliminar);

module.exports = router;
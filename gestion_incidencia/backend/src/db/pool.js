// ============================================================
// FUNCION: Crear la conexion a PostgreSQL y exportarla.
//
// Un "pool" es un grupo de conexiones abiertas que se reutilizan
// en lugar de abrir y cerrar una nueva conexion en cada peticion.
// La libreria "pg" lo maneja sola, nosotros solo lo configuramos.
//
// Cualquier archivo que necesite hacer consultas a la BD
// solo tiene que hacer: const pool = require('../db/pool')
// ============================================================

const { Pool } = require('pg');

// Creamos el pool con los datos del archivo
const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'bace_incidencias',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres_contraseña'
});

// Si hay un error inesperado en la conexion (por ejemplo la BD se cae),
// lo mostramos en consola sin que el servidor se caiga entero
pool.on('error', (err) => {
    console.error('Error inesperado en la conexion a PostgreSQL:', err.message);
});

module.exports = pool;
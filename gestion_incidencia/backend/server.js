const express = require('express');
const cors = require('cors');
const { Pool } = require('pg'); // Importamos la librería de Postgres

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// CONEXIÓN A LA BASE DE DATOS DOCKER
const pool = new Pool({
    user: 'postgres',
    host: 'mi_postgres', // Docker reconoce este nombre automáticamente
    database: 'base_incidencias',
    password: 'postgres_contraseña', // La misma del docker-compose
    port: 5432,
});

// FUNCIÓN PARA CREAR TABLA DE PRUEBA
const iniciarBaseDeDatos = async () => {
    try {
        // Creamos una tabla llamada "reportes" si no existe
        await pool.query(`
            CREATE TABLE IF NOT EXISTS reportes (
                id SERIAL PRIMARY KEY,
                titulo VARCHAR(100) NOT NULL,
                estado VARCHAR(20) NOT NULL
            );
        `);
        
        // Metemos un dato de prueba si la tabla está vacía
        const res = await pool.query('SELECT COUNT(*) FROM reportes');
        if (parseInt(res.rows[0].count) === 0) {
            await pool.query("INSERT INTO reportes (titulo, estado) VALUES ('Error de conexión en login', 'Abierto')");
            console.log('Fila de prueba insertada en la base de datos.');
        }

        console.log('Conexión con PostgreSQL exitosa y base de datos lista.');
    } catch (err) {
        console.error('Error al conectar con PostgreSQL:', err.message);
    }
};

// Iniciamos la verificación
iniciarBaseDeDatos();

// Ruta de la API cambiada para leer de la Base de Datos
app.get('/api/prueba', async (req, res) => {
    try {
        const resultado = await pool.query('SELECT * FROM reportes LIMIT 1');
        const reporte = resultado.rows[0];
        
        res.json({ 
            mensaje: `¡Hola! Datos reales de la DB -> ID: ${reporte.id} | Incidencia: ${reporte.titulo} | Estado: ${reporte.estado}` 
        });
    } catch (err) {
        res.status(500).json({ mensaje: "Error al leer la base de datos", error: err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Backend corriendo en el puerto ${PORT}`);
});

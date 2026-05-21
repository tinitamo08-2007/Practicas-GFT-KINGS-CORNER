const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Permisos para que Angular entre sin problemas
app.use(cors());

// Ruta que entrega el JSON de prueba
app.get('/api/prueba', (req, res) => {
    res.json({ 
        mensaje: "¡Hola desde el Backend de Node! El cerebro está funcionando." 
    });
});

// Arrancamos el servidor de forma global para Docker
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Backend corriendo en el puerto ${PORT}`);
});

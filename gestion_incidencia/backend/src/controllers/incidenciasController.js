// ============================================================
// FUNCION: Logica de cada operacion sobre las incidencias.
//          Ahora trabaja con el array en memoria en lugar de
//          la base de datos. Cuando tengamos PostgreSQL, solo
//          hay que cambiar este archivo.
//CAMBIOS RESPECTO A LA VERSION ANTERIOR:
//   - Al crear una incidencia, se llama a la IA automaticamente
//   - Las sugerencias de la IA se guardan en el array "sugerencias"
//   - Se anade endpoint para ver la sugerencia de una incidencia
// ============================================================

// Importamos los datos de prueba
const incidencias = require('../db/Mockincidencias');
const { analizaarIncidencia } = require('../services//Iaservice');

// Contador para los IDs nuevos que se vayan creando
// Empieza en 51 porque el mock ya tiene del 1 al 50
let proximoId = 51;

// Array separado para guardar las sugerencias de la IA
// Cuando haya BD, esto pasara a la tabla sugerencias_ia
const sugerencias = [];


// ----------------------------------------------------------
// calcularSLA:
// Recibe la prioridad y devuelve la fecha limite de resolucion
// ----------------------------------------------------------
const calcularSLA = (prioridad) => {
    const horas = {
        'Critica': 4,
        'Alta':    24,
        'Media':   48,
        'Baja':    72
    };

    const horasLimite = horas[prioridad] || 48;
    const ahora = new Date();
    const vencimiento = new Date(ahora.getTime() + horasLimite * 60 * 60 * 1000);

    return vencimiento.toISOString();
};

// ----------------------------------------------------------
//  generarCodigo
// Genera el codigo visible.
// ----------------------------------------------------------
const generarCodigo = (id) => {
    const anio = new Date().getFullYear();
    const numero = String(id).padStart(6, '0');
    return `INC-${anio}-${numero}`;
};


// Valores permitidos para validaciones
const ESTADOS_VALIDOS    = ['Nueva', 'Asignada', 'En progreso', 'Pendiente', 'Resuelta', 'Cerrada', 'Cancelada'];
const PRIORIDADES_VALIDAS = ['Critica', 'Alta', 'Media', 'Baja'];
const ORIGENES_VALIDOS   = ['Email', 'Web', 'Telefono'];


// ============================================================
// GET /api/incidencias
// Devuelve todas las incidencias
// ============================================================
const obtenerTodas = (req, res) => {
    // Devolvemos una copia del array ordenada por fecha de creacion descendente
    const ordenadas = [...incidencias].sort((a, b) => {
        return new Date(b.fecha_creacion) - new Date(a.fecha_creacion);
    });

    res.json(ordenadas);
};

// ============================================================
// GET /api/incidencias/:id
// Devuelve una incidencia por su ID
// ============================================================
const obtenerPorId = (req, res) => {
    // Convertimos a numero porque req.params.id llega como string
    const id = parseInt(req.params.id);

    // Array.find() busca el primer elemento que cumpla la condicion
    const incidencia = incidencias.find(inc => inc.id === id);

    if (!incidencia) {
        return res.status(404).json({ error: `No existe una incidencia con id ${id}.` });
    }
      // Incluimos la sugerencia de IA si existe
    const sugerencia = sugerencias.find(s => s.incidencia_id === id) || null;

    res.json({...incidencia, sugerencia_ia: sugerencia});
};


// ============================================================
// POST /api/incidencias
// Crea una incidencia nueva y la anade al array
// ============================================================
const crear = (req, res) => {
    const {
        titulo,
        descripcion,
        prioridad    = 'Media',
        categoria,
        estado       = 'Nueva',
        reportado_por,
        asignado_a,
        equipo,
        origen,
        causa,
        solucion,
        jira_id
    } = req.body;

    // Validacion: titulo obligatorio
    if (!titulo) {
        return res.status(400).json({ error: 'El campo titulo es obligatorio.' });
    }

    // Validaciones de valores permitidos
    if (!PRIORIDADES_VALIDAS.includes(prioridad)) {
        return res.status(400).json({
            error: `Prioridad no valida. Valores aceptados: ${PRIORIDADES_VALIDAS.join(', ')}`
        });
    }

    if (!ESTADOS_VALIDOS.includes(estado)) {
        return res.status(400).json({
            error: `Estado no valido. Valores aceptados: ${ESTADOS_VALIDOS.join(', ')}`
        });
    }

    if (origen && !ORIGENES_VALIDOS.includes(origen)) {
        return res.status(400).json({
            error: `Origen no valido. Valores aceptados: ${ORIGENES_VALIDOS.join(', ')}`
        });
    }

    const ahora = new Date().toISOString();

    // Construimos el objeto nuevo con todos los campos del modelo
    const nueva = {
        id:                  proximoId,
        codigo:              generarCodigo(proximoId),
        jira_id:             jira_id || null,
        titulo,
        descripcion:         descripcion || null,
        estado,
        prioridad,
        categoria:           categoria || null,
        reportado_por:       reportado_por || null,
        asignado_a:          asignado_a || null,
        equipo:              equipo || null,
        origen:              origen || null,
        causa:               causa || null,
        solucion:            solucion || null,
        fecha_creacion:      ahora,
        fecha_actualizacion: ahora,
        fecha_cierre:        null,
        sla_vencimiento:     calcularSLA(prioridad),
        ia_procesada:        false  // indica si la IA ya analizo esta incidencia
    };

    // Anyadimos al array y aumentamos el contador de IDs
    incidencias.push(nueva);
    proximoId++;

    res.status(201).json(nueva);
};


// ============================================================
// PUT /api/incidencias/:id
// Actualiza los campos que lleguen en el body
// ============================================================
const actualizar = (req, res) => {
    const id = parseInt(req.params.id);

    // findIndex devuelve la posicion del elemento en el array, o -1 si no existe
    const indice = incidencias.findIndex(inc => inc.id === id);

    if (indice === -1) {
        return res.status(404).json({ error: `No existe una incidencia con id ${id}.` });
    }

    const {
        titulo, descripcion, estado, prioridad,
        categoria, reportado_por, asignado_a,
        equipo, origen, causa, solucion
    } = req.body;

    // Validaciones si mandan esos campos
    if (estado && !ESTADOS_VALIDOS.includes(estado)) {
        return res.status(400).json({
            error: `Estado no valido. Valores aceptados: ${ESTADOS_VALIDOS.join(', ')}`
        });
    }

    if (prioridad && !PRIORIDADES_VALIDAS.includes(prioridad)) {
        return res.status(400).json({
            error: `Prioridad no valida. Valores aceptados: ${PRIORIDADES_VALIDAS.join(', ')}`
        });
    }

    // Tomamos la incidencia actual y le aplicamos los cambios
    // El operador ... (spread) copia todos los campos existentes
    const actual = incidencias[indice];

    // Solo actualizamos los campos que llegaron (si llega undefined, mantenemos el valor actual)
    const actualizada = {
        ...actual,
        titulo:              titulo        || actual.titulo,
        descripcion:         descripcion   !== undefined ? descripcion   : actual.descripcion,
        estado:              estado        || actual.estado,
        prioridad:           prioridad     || actual.prioridad,
        categoria:           categoria     !== undefined ? categoria     : actual.categoria,
        reportado_por:       reportado_por !== undefined ? reportado_por : actual.reportado_por,
        asignado_a:          asignado_a    !== undefined ? asignado_a    : actual.asignado_a,
        equipo:              equipo        !== undefined ? equipo        : actual.equipo,
        origen:              origen        !== undefined ? origen        : actual.origen,
        causa:               causa         !== undefined ? causa         : actual.causa,
        solucion:            solucion      !== undefined ? solucion      : actual.solucion,
        fecha_actualizacion: new Date().toISOString(),

        // Si cambia la prioridad, recalculamos el SLA
        sla_vencimiento: prioridad ? calcularSLA(prioridad) : actual.sla_vencimiento,

        // Si el estado pasa a Cerrada o Resuelta, guardamos la fecha de cierre
        fecha_cierre: (estado === 'Cerrada' || estado === 'Resuelta')
            ? new Date().toISOString()
            : actual.fecha_cierre
    };

    // Reemplazamos el elemento en el array
    incidencias[indice] = actualizada;

    res.json(actualizada);
};


// ============================================================
// DELETE /api/incidencias/:id
// Elimina una incidencia del array
// ============================================================
const eliminar = (req, res) => {
    const id = parseInt(req.params.id);
    const indice = incidencias.findIndex(inc => inc.id === id);

    if (indice === -1) {
        return res.status(404).json({ error: `No existe una incidencia con id ${id}.` });
    }

    // splice(indice, 1) elimina 1 elemento en esa posicion
    const eliminada = incidencias.splice(indice, 1)[0];

    res.json({ mensaje: `Incidencia ${eliminada.codigo} eliminada correctamente.` });
};


module.exports = { obtenerTodas, obtenerPorId, crear, actualizar, eliminar };
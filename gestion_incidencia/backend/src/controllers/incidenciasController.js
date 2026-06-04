// ============================================================
// ARCHIVO: src/controllers/incidenciasController.js
// FUNCION: Logica de cada operacion sobre las incidencias.
//          Version con PostgreSQL: usa pool.query() para todas
//          las operaciones en lugar del array en memoria.
//
// IMPORTANTE: el esquema real de la BD tiene estos campos NOT NULL
// (no pueden estar vacios): titulo, descripcion, estado, prioridad,
// categoria, reportado_por, origen, sla_vencimiento.
// Por eso usamos valores por defecto cuando algo no llega.
// ============================================================

const pool                   = require('../db/pool');
const { analizarIncidencia } = require('../services/Iaservice');

// Valores permitidos para validar antes de guardar en la BD
const ESTADOS_VALIDOS     = ['Nueva', 'Asignada', 'En progreso', 'Pendiente', 'Resuelta', 'Cerrada', 'Cancelada'];
const PRIORIDADES_VALIDAS = ['Critica', 'Alta', 'Media', 'Baja'];
const ORIGENES_VALIDOS    = ['Email', 'Web', 'Telefono'];


// ── Funciones auxiliares ──────────────────────────────────────

// calcularSLA: devuelve la fecha limite segun la prioridad
const calcularSLA = (prioridad) => {
    const horas = { 'Critica': 4, 'Alta': 24, 'Media': 48, 'Baja': 72 };
    const horasLimite = horas[prioridad] || 48;
    return new Date(Date.now() + horasLimite * 60 * 60 * 1000).toISOString();
};

// generarCodigo: convierte el ID numerico en codigo legible
// Ejemplo: id=51 -> "INC-2026-000051"
const generarCodigo = (id) => {
    const anio   = new Date().getFullYear();
    const numero = String(id).padStart(6, '0');
    return `INC-${anio}-${numero}`;
};


// ============================================================
// GET /api/incidencias
// Devuelve todas las incidencias ordenadas por fecha
// ============================================================
const obtenerTodas = async (req, res) => {
    try {
        // pool.query devuelve { rows: [...] } con todos los resultados
        const { rows } = await pool.query(
            'SELECT * FROM incidencias ORDER BY fecha_creacion DESC'
        );
        res.json(rows);
    } catch (err) {
        console.error('Error al obtener incidencias:', err.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};


// ============================================================
// GET /api/incidencias/:id
// Devuelve una incidencia con su sugerencia de IA si existe
// ============================================================
const obtenerPorId = async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        const { rows: encontradas } = await pool.query(
            'SELECT * FROM incidencias WHERE id = $1', [id]
        );

        // Si el array esta vacio, la incidencia no existe
        if (encontradas.length === 0) {
            return res.status(404).json({ error: `No existe una incidencia con id ${id}.` });
        }

        // Buscamos la sugerencia de IA para esta incidencia
        const { rows: sugerencias } = await pool.query(
            'SELECT * FROM sugerencias_ia WHERE incidencia_id = $1', [id]
        );

        // Devolvemos la incidencia con el campo sugerencia_ia incluido
        res.json({ ...encontradas[0], sugerencia_ia: sugerencias[0] || null });

    } catch (err) {
        console.error('Error al obtener incidencia:', err.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};


// ============================================================
// POST /api/incidencias
// Crea una incidencia nueva y lanza el analisis de IA en segundo plano
// ============================================================
const crear = async (req, res) => {
    try {
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

        // Validaciones
        if (!titulo) {
            return res.status(400).json({ error: 'El campo titulo es obligatorio.' });
        }
        if (!PRIORIDADES_VALIDAS.includes(prioridad)) {
            return res.status(400).json({ error: `Prioridad no valida. Valores aceptados: ${PRIORIDADES_VALIDAS.join(', ')}` });
        }
        if (!ESTADOS_VALIDOS.includes(estado)) {
            return res.status(400).json({ error: `Estado no valido. Valores aceptados: ${ESTADOS_VALIDOS.join(', ')}` });
        }
        if (origen && !ORIGENES_VALIDOS.includes(origen)) {
            return res.status(400).json({ error: `Origen no valido. Valores aceptados: ${ORIGENES_VALIDOS.join(', ')}` });
        }

        // RETURNING * devuelve la fila recien insertada incluyendo el id generado por SERIAL
        // Los campos NOT NULL que pueden llegar vacios los rellenamos con valores por defecto
        const { rows } = await pool.query(
            `INSERT INTO incidencias
                (titulo, descripcion, prioridad, categoria, estado,
                 reportado_por, asignado_a, equipo, origen,
                 causa, solucion, jira_id, sla_vencimiento)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING *`,
            [
                titulo,
                descripcion   || 'Sin descripcion',     // NOT NULL en la BD
                prioridad,
                categoria     || 'Sin clasificar',       // NOT NULL en la BD
                estado,
                reportado_por || 'Desconocido',          // NOT NULL en la BD
                asignado_a    || null,
                equipo        || null,
                origen        || 'Web',                  // NOT NULL en la BD
                causa         || null,
                solucion      || null,
                jira_id       || null,
                calcularSLA(prioridad)                   // NOT NULL en la BD
            ]
        );

        const nueva = rows[0];

        // Generamos el codigo legible con el ID que PostgreSQL asigno
        const codigo = generarCodigo(nueva.id);
        await pool.query('UPDATE incidencias SET codigo = $1 WHERE id = $2', [codigo, nueva.id]);
        nueva.codigo = codigo;

        // Respondemos al cliente de inmediato sin esperar a la IA
        res.status(201).json(nueva);

        // Llamamos a la IA en segundo plano.
        // No usamos "await" aqui para que el cliente ya tenga su respuesta
        // mientras la IA trabaja. Cuando termina, guardamos el resultado en la BD.
        analizarIncidencia(nueva)
            .then(async (analisis) => {
                if (!analisis) return;

                try {
                    // Guardamos el analisis en la tabla sugerencias_ia
                    // etiquetas es TEXT[] en la BD, pasamos el array de JS directamente
                    await pool.query(
                        `INSERT INTO sugerencias_ia
                            (incidencia_id, categoria_sugerida, prioridad_sugerida,
                             tiempo_sugerido, descripcion_mejorada, pasos_resolucion,
                             causa_probable, subcategoria, impacto,
                             escalado_recomendado, nivel_escalado, etiquetas)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                        [
                            nueva.id,
                            analisis.categoria_sugerida   || 'Sin clasificar',
                            analisis.prioridad_sugerida   || 'Media',
                            analisis.tiempo_sugerido      || 'Sin estimar',
                            analisis.descripcion_mejorada || nueva.descripcion,
                            analisis.pasos_resolucion     || 'Sin pasos sugeridos',
                            analisis.causa_probable       || null,
                            analisis.subcategoria         || null,
                            analisis.impacto              || null,
                            analisis.escalado_recomendado ?? false,
                            analisis.nivel_escalado       || null,
                            analisis.etiquetas            || []   // array vacio si no hay etiquetas
                        ]
                    );
                    console.log(`IA: sugerencia guardada para ${nueva.codigo}`);
                } catch (errGuardado) {
                    console.error('Error guardando sugerencia de IA en BD:', errGuardado.message);
                }
            })
            .catch(err => console.error('Error inesperado en el proceso de IA:', err.message));

    } catch (err) {
        console.error('Error al crear incidencia:', err.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};


// ============================================================
// PUT /api/incidencias/:id
// Actualiza los campos que lleguen en el body
// ============================================================
const actualizar = async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        // Primero obtenemos el estado actual de la incidencia
        const { rows: existentes } = await pool.query(
            'SELECT * FROM incidencias WHERE id = $1', [id]
        );

        if (existentes.length === 0) {
            return res.status(404).json({ error: `No existe una incidencia con id ${id}.` });
        }

        const actual = existentes[0];
        const body   = req.body;

        // Validaciones solo si esos campos llegan en el body
        if (body.estado && !ESTADOS_VALIDOS.includes(body.estado)) {
            return res.status(400).json({ error: `Estado no valido. Valores aceptados: ${ESTADOS_VALIDOS.join(', ')}` });
        }
        if (body.prioridad && !PRIORIDADES_VALIDAS.includes(body.prioridad)) {
            return res.status(400).json({ error: `Prioridad no valida. Valores aceptados: ${PRIORIDADES_VALIDAS.join(', ')}` });
        }

        // Si el campo llega en el body lo usamos, si no mantenemos el valor actual
        // Usamos !== undefined para los campos que pueden ser string vacio o null
        const titulo        = body.titulo        || actual.titulo;
        const descripcion   = body.descripcion   !== undefined ? body.descripcion   : actual.descripcion;
        const estado        = body.estado        || actual.estado;
        const prioridad     = body.prioridad     || actual.prioridad;
        const categoria     = body.categoria     !== undefined ? body.categoria     : actual.categoria;
        const reportado_por = body.reportado_por !== undefined ? body.reportado_por : actual.reportado_por;
        const asignado_a    = body.asignado_a    !== undefined ? body.asignado_a    : actual.asignado_a;
        const equipo        = body.equipo        !== undefined ? body.equipo        : actual.equipo;
        const origen        = body.origen        !== undefined ? body.origen        : actual.origen;
        const causa         = body.causa         !== undefined ? body.causa         : actual.causa;
        const solucion      = body.solucion      !== undefined ? body.solucion      : actual.solucion;

        // Si cambia la prioridad recalculamos el SLA
        const sla_vencimiento = body.prioridad ? calcularSLA(body.prioridad) : actual.sla_vencimiento;

        // Si el estado pasa a Cerrada o Resuelta por primera vez, guardamos la fecha
        const fecha_cierre = (estado === 'Cerrada' || estado === 'Resuelta') && !actual.fecha_cierre
            ? new Date().toISOString()
            : actual.fecha_cierre;

        const { rows } = await pool.query(
            `UPDATE incidencias SET
                titulo              = $1,
                descripcion         = $2,
                estado              = $3,
                prioridad           = $4,
                categoria           = $5,
                reportado_por       = $6,
                asignado_a          = $7,
                equipo              = $8,
                origen              = $9,
                causa               = $10,
                solucion            = $11,
                sla_vencimiento     = $12,
                fecha_cierre        = $13,
                fecha_actualizacion = NOW()
             WHERE id = $14
             RETURNING *`,
            [titulo, descripcion, estado, prioridad, categoria,
             reportado_por, asignado_a, equipo, origen, causa, solucion,
             sla_vencimiento, fecha_cierre, id]
        );

        // Si el tecnico acepta la sugerencia, aplicamos los campos sugeridos
        if (body.aceptar_sugerencia === true) {
            const { rows: sugerencias } = await pool.query(
                'SELECT * FROM sugerencias_ia WHERE incidencia_id = $1', [id]
            );
            if (sugerencias.length > 0) {
                const sug = sugerencias[0];
                await pool.query(
                    `UPDATE incidencias SET
                        categoria   = $1,
                        prioridad   = $2,
                        descripcion = $3,
                        fecha_actualizacion = NOW()
                     WHERE id = $4`,
                    [sug.categoria_sugerida, sug.prioridad_sugerida, sug.descripcion_mejorada, id]
                );
                await pool.query(
                    'UPDATE sugerencias_ia SET aceptada = true WHERE incidencia_id = $1', [id]
                );
            }
        }

        res.json(rows[0]);

    } catch (err) {
        console.error('Error al actualizar incidencia:', err.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};


// ============================================================
// DELETE /api/incidencias/:id
// Elimina una incidencia de la BD
// ============================================================
const eliminar = async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        // RETURNING nos devuelve el codigo para mostrarlo en el mensaje
        const { rows } = await pool.query(
            'DELETE FROM incidencias WHERE id = $1 RETURNING codigo', [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: `No existe una incidencia con id ${id}.` });
        }

        res.json({ mensaje: `Incidencia ${rows[0].codigo} eliminada correctamente.` });

    } catch (err) {
        console.error('Error al eliminar incidencia:', err.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};


// ============================================================
// GET /api/incidencias/:id/sugerencia
// Consulta si la IA ya genero la sugerencia para esta incidencia
// ============================================================
const obtenerSugerencia = async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        // Comprobamos que la incidencia existe
        const { rows: inc } = await pool.query(
            'SELECT id FROM incidencias WHERE id = $1', [id]
        );
        if (inc.length === 0) {
            return res.status(404).json({ error: `No existe una incidencia con id ${id}.` });
        }

        const { rows: sugerencias } = await pool.query(
            'SELECT * FROM sugerencias_ia WHERE incidencia_id = $1', [id]
        );

        if (sugerencias.length === 0) {
            return res.json({
                procesada: false,
                mensaje: 'La IA todavia no ha generado una sugerencia para esta incidencia.'
            });
        }

        res.json({ procesada: true, sugerencia: sugerencias[0] });

    } catch (err) {
        console.error('Error al obtener sugerencia:', err.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};


// ============================================================
// PATCH /api/incidencias/:id/sugerencia
// El tecnico acepta o rechaza la sugerencia de la IA
// ============================================================
const revisarSugerencia = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { aceptada, motivo_rechazo } = req.body;

        if (aceptada === undefined) {
            return res.status(400).json({ error: 'Debes indicar si la sugerencia fue aceptada (true o false).' });
        }

        const { rows } = await pool.query(
            `UPDATE sugerencias_ia
             SET aceptada = $1, motivo_rechazo = $2
             WHERE incidencia_id = $3
             RETURNING *`,
            [aceptada, motivo_rechazo || null, id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: `No hay sugerencia de IA para la incidencia ${id}.` });
        }

        // Si el tecnico acepta, aplicamos los campos sugeridos a la incidencia
        if (aceptada) {
            const sug = rows[0];
            await pool.query(
                `UPDATE incidencias SET
                    categoria   = $1,
                    prioridad   = $2,
                    descripcion = $3,
                    fecha_actualizacion = NOW()
                 WHERE id = $4`,
                [sug.categoria_sugerida, sug.prioridad_sugerida, sug.descripcion_mejorada, id]
            );
        }

        res.json({
            mensaje:    aceptada ? 'Sugerencia aceptada y aplicada.' : 'Sugerencia rechazada.',
            sugerencia: rows[0]
        });

    } catch (err) {
        console.error('Error al revisar sugerencia:', err.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};


module.exports = {
    obtenerTodas,
    obtenerPorId,
    crear,
    actualizar,
    eliminar,
    obtenerSugerencia,
    revisarSugerencia
};
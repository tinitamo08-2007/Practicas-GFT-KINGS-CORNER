
// FUNCION: Llamar a la IA de Groq para analizar una incidencia.
//
// Groq es un proveedor gratuito de IA. Funciona igual que
// OpenAI pero usando sus propios modelos (Llama, Gemma).
//
// Flujo del archivo:
//   1. Recibe una incidencia (titulo, descripcion, etc.)
//   2. Construye un mensaje para la IA explicandole que analice
//   3. Llama a la API de Groq por HTTP
//   4. Recibe el JSON con el analisis
//   5. Valida que el JSON tenga todos los campos esperados
//   6. Devuelve el analisis o null si algo fallo
// ============================================================


// URL de la API de Groq. Es compatible con el formato de OpenAI,
// por eso el cuerpo de la peticion es identico al de OpenAI.
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';


// ============================================================
// FUNCION: analizarIncidencia
//
// Recibe un objeto incidencia con estos campos:
//   - titulo       (obligatorio)
//   - descripcion  (opcional)
//   - categoria    (opcional)
//   - prioridad    (opcional)
//
// Devuelve un objeto con:
//   - categoria_sugerida    ('hardware' | 'software' | 'red' | 'accesos')
//   - prioridad_sugerida    ('Critica' | 'Alta' | 'Media' | 'Baja')
//   - tiempo_sugerido       (ej: '2 horas', '30 minutos', '1 dia')
//   - descripcion_mejorada  (la descripcion reescrita de forma tecnica y clara)
//   - pasos_resolucion      (pasos numerados separados por saltos de linea)
//
// Devuelve null si algo falla (sin romper el servidor).
// ============================================================
const analizarIncidencia = async (incidencia) => {
    try {

        // Comprobamos que la API key esta configurada antes de hacer nada.
        // Si no esta, avisamos en consola y salimos. Esto evita errores raros
        // mas adelante cuando la peticion falle con 401.
        if (!process.env.IA_API_KEY) {
            console.error('iaService: No hay IA_API_KEY en el .env. La IA no funcionara.');
            return null;
        }

        if (!process.env.IA_MODELO) {
            console.error('iaService: No hay IA_MODELO en el .env. Ejemplo: llama-3.3-70b-versatile');
            return null;
        }

        // ── Construimos los mensajes para la IA ──────────────────
        //
        // La API de Groq funciona con un array de mensajes, igual que un chat.
        // Hay dos roles principales:
        //   - 'system': instrucciones generales que definen el comportamiento de la IA
        //   - 'user':   el mensaje concreto que mandamos en esta peticion
        //
        // Buenas practicas:
        //   - En 'system' le decimos exactamente que formato queremos (JSON)
        //   - Le damos el esquema exacto con los campos y valores posibles
        //   - Le decimos que no ponga nada fuera del JSON (sin saludos, sin explicaciones)
        const mensajes = [
            {
                role: 'system',
                content: `Eres un analista senior de soporte tecnico IT con 15 años de experiencia en entornos empresariales.
Tu especialidad es clasificar, priorizar y resolver incidencias de forma precisa y rapida.
 
Recibes incidencias que pueden estar escritas en español o en ingles. Detecta el idioma automaticamente.
Responde SIEMPRE en español, independientemente del idioma de la incidencia.
 
Tu tarea es analizar cada incidencia teniendo en cuenta:
- El impacto en el negocio (cuantos usuarios o sistemas afecta)
- La urgencia real (si el servicio esta caido o solo degradado)
- El tipo de problema (hardware, software, red o accesos)
- La experiencia acumulada de casos similares
 
Devuelve SIEMPRE un JSON valido con exactamente estos campos.
No incluyas texto antes ni despues del JSON.
No uses bloques de codigo markdown ni caracteres extra.
 
Esquema exacto que debes devolver:
{
  "idioma_detectado":     "es" | "en",
  "categoria_sugerida":   "hardware" | "software" | "red" | "accesos",
  "subcategoria":         string (ejemplos: "impresora", "VPN", "Active Directory", "base de datos", "navegador"),
  "prioridad_sugerida":   "Critica" | "Alta" | "Media" | "Baja",
  "impacto":              "individual" | "departamento" | "empresa",
  "tiempo_sugerido":      string (tiempo estimado de resolucion, ejemplo: "2 horas", "30 minutos", "1 dia"),
  "descripcion_mejorada": string (la descripcion original reescrita en lenguaje tecnico claro, en español),
  "causa_probable":       string (hipotesis tecnica mas probable del origen del problema),
  "pasos_resolucion":     string (minimo 4 pasos numerados, concretos y accionables, separados por salto de linea),
  "escalado_recomendado": true | false,
  "nivel_escalado":       "N1" | "N2" | "N3" | null (null si escalado_recomendado es false),
  "etiquetas":            array de strings (palabras clave tecnicas, maximo 5, ejemplo: ["red", "DNS", "Windows 11"])
}
 
Criterios de prioridad que debes aplicar:
- Critica: servicio completamente caido, afecta a toda la empresa o a sistemas de produccion
- Alta: servicio muy degradado, afecta a un departamento completo o a un proceso critico de negocio
- Media: el usuario puede trabajar pero con dificultades, afecta a una persona o funcion no critica
- Baja: problema estetico, mejora, o consulta que no impide trabajar
 
Criterios de escalado:
- N1: el problema se puede resolver con guia remota sin acceso al equipo
- N2: requiere acceso remoto al equipo o intervencion del administrador del sistema
- N3: requiere presencia fisica, cambio de hardware, o intervencion de un proveedor externo`
            },
            {
                role: 'user',
                content: `Analiza esta incidencia de soporte IT y devuelve el JSON:
 
Titulo: ${incidencia.titulo}
Descripcion: ${incidencia.descripcion || 'Sin descripcion'}
Categoria actual: ${incidencia.categoria || 'Sin clasificar'}
Prioridad actual: ${incidencia.prioridad || 'Sin prioridad'}
Reportado por: ${incidencia.reportado_por || 'Desconocido'}
Equipo afectado: ${incidencia.equipo || 'No especificado'}
Origen del reporte: ${incidencia.origen || 'No especificado'}`
            }
        ];

        // ── Construimos los headers de la peticion ────────────────
        //
        // Authorization: Groq usa autenticacion Bearer.
        // Es decir, mandamos la API key en la cabecera con el prefijo "Bearer ".
        // Content-Type: le decimos que el cuerpo es JSON.
        const cabeceras = {
            'Authorization': `Bearer ${process.env.IA_API_KEY}`,
            'Content-Type': 'application/json'
        };

        // ── Construimos el cuerpo de la peticion ──────────────────
        //
        // model:           el modelo de Groq que esta en el .env
        // messages:        los mensajes que acabamos de construir
        // response_format: le forzamos a responder solo con JSON
        //                  (Llama 3.3 en Groq lo soporta)
        // max_tokens:      maximo de tokens en la respuesta (800 es suficiente)
        // temperature:     0.2 = respuestas consistentes y predecibles.
        //                  Cuanto mas alto (max 2), mas creativa e impredecible
        //                  es la IA. Para analisis tecnicos lo queremos bajo.
        const cuerpo = {
            model: process.env.IA_MODELO,
            messages: mensajes,
            response_format: { type: 'json_object' },
            max_tokens: 800,
            temperature: 0.2
        };

        console.log(`iaService: Analizando incidencia "${incidencia.titulo}" con Groq...`);

        // ── Hacemos la peticion HTTP a Groq ───────────────────────
        //
        // fetch() es la funcion nativa de Node.js para hacer peticiones HTTP.
        // Le pasamos la URL, el metodo POST, los headers y el cuerpo.
        // Usamos await porque es una operacion asincrona (tarda unos segundos).
        const respuesta = await fetch(GROQ_URL, {
            method: 'POST',
            headers: cabeceras,
            body: JSON.stringify(cuerpo)
        });

        // ── Manejamos los errores de la API ───────────────────────
        //
        // La API devuelve codigos HTTP para indicar si algo fallo:
        //   401 = la API key es incorrecta o ha expirado
        //   429 = has superado el limite de peticiones del tier gratuito
        //         (30 peticiones/minuto, 14.400/dia con Groq)
        //   otros errores los mostramos con el codigo exacto
        if (respuesta.status === 401) {
            console.error('iaService: API Key invalida. Revisa IA_API_KEY en tu .env');
            return null;
        }

        if (respuesta.status === 429) {
            console.error('iaService: Limite de peticiones alcanzado. Espera un minuto e intentalo de nuevo.');
            return null;
        }

        if (!respuesta.ok) {
            // respuesta.ok es false cuando el codigo HTTP no esta entre 200-299
            const textoError = await respuesta.text();
            console.error(`iaService: Error ${respuesta.status} de Groq:`, textoError);
            return null;
        }

        // ── Procesamos la respuesta ───────────────────────────────
        //
        // Groq devuelve un objeto con esta estructura:
        // {
        //   choices: [
        //     {
        //       message: {
        //         content: "{ ...el JSON que pedimos... }"
        //       }
        //     }
        //   ]
        // }
        //
        // El contenido llega como string, no como objeto.
        // Por eso luego hacemos JSON.parse().
        const datos = await respuesta.json();
        const contenidoTexto = datos.choices?.[0]?.message?.content;

        // Si por alguna razon la respuesta no tiene contenido, salimos
        if (!contenidoTexto) {
            console.error('iaService: Groq devolvio una respuesta sin contenido.');
            return null;
        }

        // ── Parseamos el JSON con precaucion ─────────────────────
        //
        // Aunque le pedimos solo JSON, a veces la IA anade caracteres
        // extra como ``` o "json". Los limpiamos antes de parsear.
        try {
            const textoLimpio = contenidoTexto
                .replace(/```json/g, '')  // elimina el inicio de bloque markdown
                .replace(/```/g, '')  // elimina el cierre de bloque markdown
                .trim();                   // elimina espacios y saltos al inicio y final

            const analisis = JSON.parse(textoLimpio);

            // Verificamos que el JSON tenga todos los campos que necesitamos.
            // Si la IA omitio alguno, preferimos devolver null a tener datos incompletos.
            const camposRequeridos = [
                'categoria_sugerida',
                'prioridad_sugerida',
                'tiempo_sugerido',
                'descripcion_mejorada',
                'pasos_resolucion'
            ];

            const camposFaltantes = camposRequeridos.filter(campo => !analisis[campo]);

            if (camposFaltantes.length > 0) {
                console.error('iaService: Al JSON le faltan estos campos:', camposFaltantes);
                return null;
            }

            console.log('iaService: Analisis recibido correctamente.');
            return analisis;

        } catch (errorParseo) {
            // JSON.parse fallo porque el texto no es un JSON valido
            console.error('iaService: No se pudo parsear la respuesta de Groq:', contenidoTexto);
            return null;
        }

    } catch (err) {
        // Este catch captura errores de red: sin internet, URL incorrecta, etc.
        console.error('iaService: Error de red al llamar a Groq:', err.message);
        return null;
    }
};


module.exports = { analizarIncidencia };
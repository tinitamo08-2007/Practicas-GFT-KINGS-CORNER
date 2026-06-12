# Backend — Sistema de Gestión de Incidencias con IA y Jira

Backend en **Node.js + Express + PostgreSQL** para la gestión de incidencias de soporte IT, con análisis automático mediante IA (Groq) y sincronización bidireccional con **Jira**.

---

## 1. Stack y dependencias

- **Node.js** + **Express** — servidor HTTP y enrutado de la API REST.
- **PostgreSQL** (vía librería `pg`) — base de datos principal.
- **Groq API** (compatible con OpenAI) — análisis automático de incidencias mediante un LLM (Llama / Gemma).
- **Jira Cloud API v3** — sincronización de incidencias como tickets.
- **cors**, **dotenv** — utilidades estándar de configuración.

---

## 2. Estructura del proyecto

```
├── server.js                     # Punto de entrada
├── src/
│   ├── db/
│   │   └── pool.js                # Conexión (pool) a PostgreSQL
│   ├── routes/
│   │   ├── incidencias.js         # Rutas /api/incidencias
│   │   └── webhooks.js            # Rutas /api/webhooks
│   ├── controllers/
│   │   ├── incidenciasController.js
│   │   └── Webhookscontroller.js
│   └── services/
│       ├── Iaservice.js           # Llamadas a Groq (IA)
│       └── Jiraservice.js         # Llamadas a la API de Jira
├── scripts/
│   ├── importarJira.js            # Importa tickets de Jira a la BD
│   ├── reprocesaria.js             # Reprocesa incidencias "Sin clasificar" con IA
│   ├── limpiarJira.js             # Borra todos los tickets del proyecto en Jira
│   └── sincronizarjira.js         # Borra de Jira los tickets que no existen en la BD
└── db/
    ├── 01-schema.sql              # Esquema de la base de datos
    └── 02-data.sql                # Datos iniciales (vacío)
```

---

## 3. Variables de entorno (`.env`)

| Variable | Descripción |
|---|---|
| `PORT` | Puerto en el que arranca el servidor (por defecto `3000`, busca automáticamente uno libre si está ocupado) |
| `DB_HOST` | Host de PostgreSQL (por defecto `localhost`) |
| `DB_PORT` | Puerto de PostgreSQL (por defecto `5432`) |
| `DB_NAME` | Nombre de la base de datos (por defecto `base_incidencias`) |
| `DB_USER` | Usuario de PostgreSQL (por defecto `postgres`) |
| `DB_PASSWORD` | Contraseña de PostgreSQL |
| `IA_API_KEY` | API Key de Groq |
| `IA_MODELO` | Modelo de Groq a usar (ej. `llama-3.3-70b-versatile`) |
| `IA_PROVEEDOR` | Solo informativo, se muestra en consola al arrancar |
| `JIRA_DOMINIO` | Dominio de Jira Cloud (ej. `tuempresa.atlassian.net`) |
| `JIRA_EMAIL` | Email de la cuenta de Jira usada para autenticación |
| `JIRA_API_TOKEN` | Token de API de Jira |
| `JIRA_PROJECT_KEY` | Clave del proyecto en Jira (ej. `GFT`) |

---

## 4. Base de datos

### Tabla `incidencias`
Almacena cada incidencia de soporte. Campos principales:

- `id` (PK, autoincremental), `codigo` (único, formato `INC-AAAA-000001`, generado por trigger o reservado manualmente con `nextval`).
- `jira_id` (único, opcional) — clave del ticket asociado en Jira.
- `titulo`, `descripcion`, `estado` (default `'Nueva'`), `prioridad`, `categoria`.
- `reportado_por`, `asignado_a`, `equipo`, `origen`.
- `causa`, `solucion` (campos de cierre).
- `fecha_creacion`, `fecha_actualizacion`, `fecha_cierre`, `sla_vencimiento`.

Un **trigger** (`trg_asignar_codigo`) genera automáticamente el `codigo` a partir del `id` y la fecha de creación si no se especifica.

### Tabla `sugerencias_ia`
Guarda el análisis generado por la IA para cada incidencia (relación 1:1 vía `incidencia_id`, con `ON DELETE CASCADE`):

- `categoria_sugerida`, `subcategoria`, `prioridad_sugerida`, `impacto`.
- `tiempo_sugerido`, `descripcion_mejorada`, `causa_probable`, `pasos_resolucion`.
- `escalado_recomendado`, `nivel_escalado` (`N1`/`N2`/`N3`/`null`), `etiquetas` (array).
- `aceptada`, `motivo_rechazo` — usados cuando el técnico revisa la sugerencia.

---

## 5. Conexión a la base de datos (`pool.js`)

Crea y exporta un **pool de conexiones** de `pg` configurado mediante variables de entorno. Cualquier módulo puede usarlo con:

```js
const pool = require('../db/pool');
```

Incluye un listener `pool.on('error', ...)` para que un fallo de conexión no derribe el servidor.

---

## 6. API REST

### 6.1 Rutas de incidencias (`/api/incidencias`)

| Método | Ruta | Función | Descripción |
|---|---|---|---|
| GET | `/` | `obtenerTodas` | Lista todas las incidencias |
| GET | `/:id` | `obtenerPorId` | Detalle de una incidencia, incluyendo su sugerencia de IA |
| POST | `/` | `crear` | Crea una incidencia y lanza el análisis de IA en segundo plano |
| PUT | `/:id` | `actualizar` | Actualiza una incidencia existente |
| DELETE | `/:id` | `eliminar` | Elimina una incidencia |
| GET | `/:id/sugerencia` | `obtenerSugerencia` | Consulta si la IA ya procesó la incidencia |
| PATCH | `/:id/sugerencia` | `revisarSugerencia` | El técnico acepta o rechaza la sugerencia de IA |

> Nota: la lógica detallada de estas funciones vive en `controllers/incidenciasController.js` (no incluido en este resumen, pero sigue el mismo patrón que el controlador de webhooks: transacciones atómicas, reserva de `id`/`codigo` antes del `INSERT`, y registro de la sugerencia en `sugerencias_ia`).

### 6.2 Rutas de webhooks (`/api/webhooks`)

| Método | Ruta | Función | Descripción |
|---|---|---|---|
| POST | `/jira` | `recibirEventoJira` | Endpoint que Jira llama cuando crea o actualiza un ticket |
| POST | `/sincronizar/:id` | `sincronizarHaciaJira` | Empuja el estado actual de una incidencia hacia su ticket en Jira |

#### `recibirEventoJira` — flujo detallado

1. Extrae del payload de Jira: `jira_id`, `titulo`, `descripcion`, `prioridad` (mapeada con `MAPA_PRIORIDAD_JIRA`), `estado`.
2. **Si la incidencia ya existe** (mismo `jira_id`): hace un `UPDATE` simple de `titulo`, `descripcion`, `estado` y `fecha_actualizacion`, y responde — **sin llamar a la IA**.
3. **Si es nueva**:
   - Espera 4 segundos (para respetar el límite de 30 req/min del tier gratuito de Groq).
   - Llama a `analizarIncidencia` (servicio de IA) para clasificarla.
   - Calcula el `sla_vencimiento` según la prioridad (Crítica: 4h, Alta: 24h, Media: 48h, Baja: 72h).
   - Abre una **transacción atómica**:
     - Reserva un `id` con `nextval('incidencias_id_seq')` para poder generar el `codigo` (`INC-AAAA-NNNNNN`) antes del `INSERT`.
     - Inserta en `incidencias`.
     - Inserta el análisis de IA en `sugerencias_ia`.
     - `COMMIT` si todo va bien, `ROLLBACK` si algo falla.

#### `sincronizarHaciaJira` — flujo detallado

1. Busca la incidencia por `id` en la BD.
2. Comprueba que tiene un `jira_id` asociado.
3. Llama a `actualizarEstadoEnJira` para aplicar la transición de estado correspondiente en Jira.

---

## 7. Servicio de IA (`Iaservice.js`)

Función principal: **`analizarIncidencia(incidencia)`**.

- Usa la API de Groq (`https://api.groq.com/openai/v1/chat/completions`), compatible con el formato de chat de OpenAI.
- Requiere `IA_API_KEY` e `IA_MODELO` configurados; si faltan, devuelve `null` sin lanzar error.
- Construye un prompt de sistema que define el rol ("analista senior de soporte IT") y exige una respuesta **JSON estricta** con el siguiente esquema:

```json
{
  "idioma_detectado": "es | en",
  "categoria_sugerida": "hardware | software | red | accesos",
  "subcategoria": "string",
  "prioridad_sugerida": "Critica | Alta | Media | Baja",
  "impacto": "individual | departamento | empresa",
  "tiempo_sugerido": "string",
  "descripcion_mejorada": "string",
  "causa_probable": "string",
  "pasos_resolucion": "string (mín. 4 pasos)",
  "escalado_recomendado": true/false,
  "nivel_escalado": "N1 | N2 | N3 | null",
  "etiquetas": ["string", "..."]
}
```

- Maneja explícitamente los códigos de error de Groq:
  - `401` → API key inválida.
  - `429` → límite de peticiones alcanzado (30/min, 14.400/día en tier gratuito).
  - Otros errores HTTP → se loguean con el código y el cuerpo de respuesta.
- Limpia posibles bloques ```` ```json ```` antes de parsear la respuesta.
- Valida que estén presentes los campos obligatorios (`categoria_sugerida`, `prioridad_sugerida`, `tiempo_sugerido`, `descripcion_mejorada`, `pasos_resolucion`); si falta alguno, devuelve `null`.
- En caso de cualquier error (red, parseo, validación) devuelve `null` **sin romper el servidor**.

---

## 8. Servicio de Jira (`Jiraservice.js`)

Todas las llamadas a la API de Jira (v3) están centralizadas aquí. Usa autenticación **Basic Auth** (`email:token` en Base64) construida en `construirCabecerasJira()`.

| Función | Descripción |
|---|---|
| `obtenerIncidenciasDeJira()` | Trae los tickets del proyecto (`JIRA_PROJECT_KEY`) vía JQL y los transforma al formato interno (`jira_id`, `titulo`, `descripcion`, `estado`, `prioridad`, `reportado_por`, `asignado_a`, `fecha_creacion`) |
| `crearTicketEnJira(incidencia)` | Crea un ticket de tipo `Bug` en Jira a partir de una incidencia interna; convierte la descripción a formato **ADF** (Atlassian Document Format) y mapea la prioridad interna a la de Jira (`Critica→Highest`, `Alta→High`, `Media→Medium`, `Baja→Low`) |
| `actualizarEstadoEnJira(jiraId, nuevoEstado)` | Obtiene las transiciones disponibles del ticket y aplica la que coincide con el estado interno (`Por hacer`, `En curso`, `En revisión`, `Finalizado`) |
| `anadirComentarioEnJira(jiraId, texto)` | Añade un comentario (en formato ADF) a un ticket |

Mapa de prioridades Jira → interno (usado en webhooks e importación):

```js
{ 'Highest': 'Critica', 'High': 'Alta', 'Medium': 'Media', 'Low': 'Baja', 'Lowest': 'Baja' }
```

---

## 9. Scripts auxiliares (`/scripts`)

Estos scripts se ejecutan manualmente con `node scripts/<archivo>.js` y crean su **propia conexión a PostgreSQL** (no usan `src/db/pool.js`).

### `importarJira.js`
- Descarga tickets del proyecto de Jira (hasta 100, paginando con `startAt`).
- Para cada ticket que **no exista** ya en la BD (por `jira_id`):
  - Reserva `id` y genera `codigo`.
  - Inserta la incidencia **sin pasar por la IA** (categoría `'Sin clasificar'`, prioridad mapeada desde Jira).
  - Inserta una fila base en `sugerencias_ia` con valores por defecto (`'Sin clasificar'`, `'Sin estimar'`, `'Sin pasos sugeridos'`, etc.) en la misma transacción.
- Al final imprime un resumen (importadas / ya existían / errores) y sugiere ejecutar `reprocesaria.js`.

### `reprocesaria.js`
- Busca todas las incidencias cuya sugerencia tenga `categoria_sugerida = 'Sin clasificar'` (normalmente las importadas con `importarJira.js`).
- Para cada una, llama a `analizarIncidencia` con un retardo de 4s entre peticiones.
- Si Groq falla, espera 60s y reintenta una vez; si vuelve a fallar, la marca como fallida y continúa.
- Guarda el resultado actualizando `sugerencias_ia` y la columna `categoria` de `incidencias`.
- Imprime un resumen final (analizadas / fallidas).

### `limpiarJira.js`
- Obtiene **todos** los tickets del proyecto en Jira y los borra uno a uno (con una pausa de 300ms entre borrados para respetar el rate limit).
- No toca la base de datos local. Pensado para "resetear" el proyecto de Jira por completo.

### `sincronizarjira.js`
- Obtiene los `jira_id` existentes en la BD local.
- Obtiene todos los tickets actuales de Jira.
- Calcula la diferencia: tickets de Jira que **no** están registrados en la BD.
- Borra esos tickets "huérfanos" de Jira, dejando Jira sincronizado 1:1 con la BD local.

---

## 10. Arranque del servidor (`server.js`)

1. Carga `.env` (debe ser lo primero del archivo).
2. Configura Express con `cors()` y `express.json()`.
3. Registra rutas:
   - `GET /api/prueba` — healthcheck simple.
   - `GET /api/test-jira` — prueba la conexión con Jira llamando a `obtenerIncidenciasDeJira`.
   - `/api/incidencias` y `/api/webhooks`.
4. Antes de escuchar peticiones, ejecuta `SELECT 1` contra PostgreSQL:
   - Si falla, muestra el error y termina el proceso (`process.exit(1)`).
   - Si tiene éxito, busca un puerto libre a partir de `PORT` (hasta 10 intentos consecutivos) usando `net.createServer()`, y arranca el servidor mostrando en consola las URLs principales y el estado de configuración de IA y Jira.

---

## 11. Flujo general del sistema

```
Jira  ──(webhook)──▶  POST /api/webhooks/jira
                          │
                          ├─ ¿jira_id ya existe? ──▶ UPDATE simple (sin IA)
                          │
                          └─ nuevo ──▶ esperar 4s ──▶ Groq (IA) ──▶ transacción:
                                                                       INSERT incidencias
                                                                       INSERT sugerencias_ia

Frontend ──▶ POST /api/incidencias        ──▶ crea + IA en segundo plano
Frontend ──▶ GET  /api/incidencias/:id    ──▶ incidencia + sugerencia IA
Frontend ──▶ PATCH /api/incidencias/:id/sugerencia ──▶ aceptar/rechazar sugerencia

Frontend ──▶ POST /api/webhooks/sincronizar/:id ──▶ aplica el estado actual en Jira
```

---

## 12. Notas y consideraciones

- El **límite de Groq** (30 peticiones/minuto en tier gratuito) condiciona varios retardos (`esperar(4000)`) en webhooks y en `reprocesaria.js`.
- El **`codigo`** de cada incidencia (`INC-AAAA-NNNNNN`) puede generarse de dos formas: por el trigger SQL `asignar_codigo_incidencia`, o manualmente reservando el `id` con `nextval` antes del `INSERT` (usado en `Webhookscontroller.js` e `importarJira.js`) — ambos métodos producen el mismo formato.
- Los scripts de Jira (`limpiarJira.js`, `sincronizarjira.js`, `importarJira.js`) son **destructivos o masivos**: conviene usarlos con cuidado y revisar `JIRA_PROJECT_KEY` antes de ejecutarlos.
- `sugerencias_ia` tiene **Row Level Security (RLS)** habilitada en el esquema; conviene revisar las políticas de acceso configuradas en PostgreSQL si se añaden nuevos roles de conexión.
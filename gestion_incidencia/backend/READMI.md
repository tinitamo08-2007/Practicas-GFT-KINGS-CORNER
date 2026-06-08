# Backend - Sistema de Gestion de Incidencias IT
### GFT Kings Corner - Practicas 2026

---

## Que hace este backend

Este servidor recibe tickets de soporte desde Jira, los guarda en una base de datos PostgreSQL y los analiza automaticamente con inteligencia artificial (Groq). El resultado del analisis queda guardado para que los tecnicos puedan consultarlo desde el frontend Angular.

---

## Requisitos antes de arrancar

- Node.js v18 o superior
- PostgreSQL instalado y corriendo
- Una base de datos creada llamada `base_incidencias`
- Una cuenta en Jira Cloud con un proyecto llamado GFT
- Una cuenta en Groq con una API key gratuita

---

## Instalacion

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar la plantilla de variables de entorno
cp .env.example .env

# 3. Rellenar el .env con los datos reales (ver seccion siguiente)

# 4. Arrancar el servidor
npm start
```

---

## Configuracion del archivo .env

```
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=base_incidencias
DB_USER=postgres
DB_PASSWORD=tu_contrasena_de_postgres

JIRA_DOMINIO=proyectogft.atlassian.net
JIRA_EMAIL=tu@email.com
JIRA_API_TOKEN=tu_token_de_jira
JIRA_PROJECT_KEY=GFT

IA_API_KEY=tu_api_key_de_groq
IA_MODELO=llama-3.3-70b-versatile
```

El token de Jira se genera en: https://id.atlassian.com/manage-profile/security/api-tokens  
La API key de Groq se genera en: https://console.groq.com/keys

---

## Estructura de carpetas

```
backend/
├── server.js                          Punto de entrada. Arranca todo.
├── package.json                       Dependencias del proyecto
├── .env                               Variables privadas (no subir a git)
├── .env.example                       Plantilla del .env (si va a git)
├── .gitignore                         Archivos que no van a git
│
├── src/
│   ├── db/
│   │   └── pool.js                    Conexion a PostgreSQL
│   │
│   ├── controllers/
│   │   ├── incidenciasController.js   Logica del CRUD de incidencias
│   │   └── Webhookscontroller.js      Recibe y procesa eventos de Jira
│   │
│   ├── routes/
│   │   ├── incidencias.js             URLs del CRUD
│   │   └── webhooks.js                URLs del webhook
│   │
│   └── services/
│       ├── Iaservice.js               Llamadas a Groq (IA)
│       └── Jiraservice.js             Llamadas a la API de Jira
│
└── scripts/
    ├── populateJira.js                Crea tickets de prueba en Jira
    ├── sincronizarjira.js             Sincroniza Jira con la BD
    ├── reprocesaria.js                Reprocesa incidencias sin analizar
    └── limpiarjirarango.js            Borra tickets de Jira fuera del rango
```

---

## Endpoints disponibles

Una vez arrancado el servidor, estos son todos los endpoints:

### Incidencias

| Metodo | URL | Que hace |
|--------|-----|----------|
| GET | /api/incidencias | Lista todas las incidencias |
| GET | /api/incidencias/:id | Devuelve una incidencia con su sugerencia de IA |
| POST | /api/incidencias | Crea una incidencia nueva y lanza la IA |
| PUT | /api/incidencias/:id | Actualiza los campos de una incidencia |
| DELETE | /api/incidencias/:id | Elimina una incidencia |
| GET | /api/incidencias/:id/sugerencia | Consulta la sugerencia de IA de esa incidencia |
| PATCH | /api/incidencias/:id/sugerencia | El tecnico acepta o rechaza la sugerencia |

### Webhooks

| Metodo | URL | Que hace |
|--------|-----|----------|
| POST | /api/webhooks/jira | Recibe eventos de Jira automaticamente |
| POST | /api/webhooks/sincronizar/:id | Actualiza el estado de un ticket en Jira |

### Comprobacion

| Metodo | URL | Que hace |
|--------|-----|----------|
| GET | /api/prueba | Comprueba que el servidor esta corriendo |
| GET | /api/test-jira | Comprueba que la conexion con Jira funciona |

---

## Explicacion de cada archivo

### server.js

Es lo primero que se ejecuta cuando haces `npm start`. Su trabajo es cargar el `.env`, comprobar que PostgreSQL responde, registrar las rutas y arrancar el servidor en el puerto 3000. Si PostgreSQL no responde, el servidor no arranca y muestra el error en consola.

---

### src/db/pool.js

Crea la conexion a PostgreSQL usando la libreria `pg`. Un pool es un grupo de conexiones abiertas que se reutilizan en lugar de abrir y cerrar una nueva por cada consulta, lo que es mucho mas eficiente. Todos los controllers importan el pool desde aqui con `require('../db/pool')`.

**Aviso:** el valor por defecto del nombre de la BD tiene una errata: `bace_incidencias`. Si el `.env` esta bien configurado esto no afecta, pero conviene corregirlo a `base_incidencias`.

---

### src/controllers/incidenciasController.js

Contiene la logica de todas las operaciones sobre incidencias. Cada funcion recibe la peticion del frontend, hace la consulta a PostgreSQL y devuelve la respuesta.

- `obtenerTodas`: hace un SELECT ordenado por fecha y devuelve el array.
- `obtenerPorId`: hace un LEFT JOIN entre incidencias y sugerencias_ia para devolver todo junto en una sola llamada.
- `crear`: inserta la incidencia en dos pasos porque necesita el ID de PostgreSQL para generar el codigo legible (INC-2026-000001). Despues lanza la IA en segundo plano sin bloquear la respuesta al frontend.
- `actualizar`: usa COALESCE para actualizar solo los campos que llegan, manteniendo el resto igual. Si el estado cambia a Cerrada o Resuelta, guarda la fecha de cierre automaticamente.
- `eliminar`: borra la incidencia. La sugerencia de IA se borra sola por CASCADE.
- `obtenerSugerencia`: el frontend llama a esto cuando el tecnico pulsa el boton de IA. Devuelve la sugerencia si ya esta lista o un mensaje de que la IA aun esta procesando.
- `revisarSugerencia`: el tecnico acepta o rechaza la sugerencia. Si la acepta, actualiza la categoria, prioridad y descripcion de la incidencia con los valores que propuso la IA.

---

### src/controllers/Webhookscontroller.js

Recibe los eventos que Jira envia automaticamente cuando alguien crea o modifica un ticket.

Cuando llega un ticket nuevo, el flujo es:
1. Espera 4 segundos para no superar el limite de Groq (30 peticiones por minuto).
2. Llama a la IA con los datos del ticket.
3. Reserva el proximo ID de la secuencia de PostgreSQL para poder generar el codigo antes de insertar.
4. Abre una transaccion: inserta la incidencia y la sugerencia de IA en el mismo bloque atomico. Si algo falla, hace ROLLBACK y nada queda a medias.
5. Si todo va bien, hace COMMIT y responde a Jira con 201.

Cuando llega una actualizacion de un ticket que ya existe, solo actualiza titulo, descripcion y estado sin llamar a la IA de nuevo.

También tiene `sincronizarHaciaJira` que actualiza el estado de un ticket en Jira cuando el tecnico lo cierra desde nuestro panel.

---

### src/routes/incidencias.js y src/routes/webhooks.js

Estos archivos no tienen logica. Solo conectan cada URL con su funcion del controller. Son el mapa que Express usa para saber que funcion ejecutar cuando llega cada peticion.

---

### src/services/Iaservice.js

Hace las llamadas HTTP a la API de Groq. Recibe una incidencia, construye el prompt con instrucciones precisas para que Groq devuelva siempre un JSON con el mismo formato, y valida que el JSON tenga todos los campos necesarios antes de devolverlo.

Si Groq devuelve un error 401 significa que la API key es incorrecta. Si devuelve 429 significa que se alcanzo el limite de peticiones del tier gratuito (30 por minuto, 14400 por dia). En ambos casos devuelve null sin romper el servidor.

Los campos que devuelve la IA son: categoria sugerida, subcategoria, prioridad sugerida, impacto, tiempo estimado de resolucion, descripcion mejorada, causa probable, pasos de resolucion, si recomienda escalar y a que nivel, y etiquetas.

---

### src/services/Jiraservice.js

Hace todas las llamadas a la API REST v3 de Jira. Usa autenticacion Basic Auth codificando el email y el token en Base64.

- `obtenerIncidenciasDeJira`: usa JQL para traer los tickets del proyecto. Usa el endpoint `/search/jql` (el antiguo `/search` fue eliminado por Jira en 2025).
- `crearTicketEnJira`: crea un ticket nuevo. La descripcion debe ir en formato ADF (Atlassian Document Format), no en texto plano.
- `actualizarEstadoEnJira`: cambiar el estado en Jira no es un PUT normal. Hay que pedir primero las transiciones disponibles y luego aplicar la correcta por su ID.
- `anadirComentarioEnJira`: añade un comentario en un ticket. Se usa cuando el tecnico acepta o rechaza una sugerencia.

---

## Scripts de mantenimiento

Los scripts estan en la carpeta `scripts/` y se ejecutan manualmente desde la terminal cuando se necesitan.

### populateJira.js

Crea tickets de prueba en Jira para poder probar el sistema sin datos reales. Se ejecuta una sola vez al inicio del proyecto.

```bash
node scripts/populateJira.js
```

### sincronizarjira.js

Compara los tickets que hay en Jira con los que hay en la BD y borra de Jira los que no tienen correspondencia en la BD. Util para limpiar tickets huerfanos.

```bash
node scripts/sincronizarjira.js
```

### reprocesaria.js

Busca en la BD las incidencias que quedaron con categoria "Sin clasificar" porque Groq fallo o alcanzo el limite de peticiones durante la carga inicial. Las reprocesa de una en una con una espera de 4 segundos entre cada una para no superar el limite de la API.

```bash
node scripts/reprocesaria.js
```

### limpiarjirarango.js

Borra de Jira todos los tickets que esten fuera del rango GFT-226 a GFT-325. Util para limpiar tickets de prueba anteriores. Tiene las credenciales hardcodeadas en el archivo por lo que solo se usa localmente y nunca debe subirse a git con datos reales.

```bash
node scripts/limpiarjirarango.js
```

---

## Como probar el flujo completo

Con el servidor arrancado, simula un evento de Jira desde Postman:

**Metodo:** POST  
**URL:** http://localhost:3000/api/webhooks/jira  
**Body (JSON):**

```json
{
  "webhookEvent": "jira:issue_created",
  "issue": {
    "key": "GFT-1",
    "fields": {
      "summary": "El usuario no puede iniciar sesion en el portal",
      "description": {
        "content": [{ "content": [{ "text": "El usuario recibe error 403 al intentar acceder." }] }]
      },
      "priority": { "name": "High" },
      "status": { "name": "Nueva" },
      "reporter": { "displayName": "Laura Gomez" },
      "assignee": null
    }
  }
}
```

Si el servidor responde con 201 y los datos de la incidencia, el flujo funciona. Despues de unos segundos puedes consultar la sugerencia de IA en:

```
GET http://localhost:3000/api/incidencias/1/sugerencia
```

---

## Errores comunes

**No se pudo conectar a PostgreSQL**  
La base de datos no existe o los datos del `.env` son incorrectos. Comprueba que PostgreSQL esta corriendo y que `DB_NAME`, `DB_USER` y `DB_PASSWORD` son correctos.

**Error 401 de Groq**  
La API key de Groq es incorrecta o ha expirado. Genera una nueva en https://console.groq.com/keys

**Error 410 al llamar a Jira**  
Estas usando el endpoint antiguo `/search` que fue eliminado. Debe ser `/search/jql`.

**EADDRINUSE: address already in use 0.0.0.0:3000**  
El puerto 3000 ya esta ocupado por otro proceso. Matalo con `pkill -f "node server.js"` y vuelve a arrancar.

**pool.js conecta a `bace_incidencias` en lugar de `base_incidencias`**  
Hay una errata en el valor por defecto de `pool.js`. Si el `.env` tiene `DB_NAME=base_incidencias` correctamente escrito, esto no afecta. Si no tienes `.env`, corrige la errata en `pool.js`.

---

## Dependencias

| Paquete | Version | Para que se usa |
|---------|---------|-----------------|
| express | ^5.2.1 | Framework del servidor web |
| cors | ^2.8.6 | Permite peticiones desde el frontend Angular |
| dotenv | ^16.4.5 | Carga las variables del .env |
| pg | ^8.21.0 | Conexion a PostgreSQL |
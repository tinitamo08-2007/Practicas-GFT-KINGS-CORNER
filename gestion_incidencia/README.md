# Sistema de Gestión e Incidentes - Guía de Despliegue Rápido (Docker)

Este proyecto contiene la arquitectura base para la plataforma de triaje y gestión de incidentes distribuida en tres contenedores independientes utilizando Docker Compose:
1. **Frontend**: Aplicación en Angular (Puerto 4200)
2. **Backend**: API REST en Node.js + Express (Puerto 3000)
3. **Base de Datos**: PostgreSQL 15 (Puerto 5432 / Persistente)

---

## 🚀 1. Encender la Arquitectura (Desde cero)

Para levantar todos los contenedores por primera vez o reanudar el proyecto, ejecuta:

`docker compose up -d`

*Nota: El parámetro "-d" hace que los contenedores corran en segundo plano.*

---

## 🧠 2. Levantar y Ejecutar el Backend (Node.js)

1. **Entrar al contenedor del Backend:**
   `docker exec -it mi_backend bash`

2. **Instalar dependencias necesarias (Solo la primera vez):**
   `npm install express cors pg`

3. **Iniciar el servidor Node:**
   `node server.js`

4. **Salir del contenedor:**
   `exit`

---

## 💻 3. Levantar y Ejecutar el Frontend (Angular)

1. **Entrar al contenedor de Angular:**
   `docker exec -it mi_frontend bash`

2. **Iniciar el servidor de desarrollo de Angular:**
   `ng serve --host 0.0.0.0`

3. **Salir del contenedor:**
   `exit`

---

## 🔎 4. Comprobación del Entorno (URLs)

* **Frontend (Interfaz de Usuario):** http://localhost:4200
* **Backend (API JSON de prueba):** http://localhost:3000/api/prueba

---

## 📊 5. Comandos Útiles de Control

* **Ver el estado de los contenedores activos:** `docker ps`
* **Ver los logs de un contenedor en tiempo real:** `docker logs -f mi_backend`

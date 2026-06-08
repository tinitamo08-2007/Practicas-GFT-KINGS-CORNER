#!/bin/sh
# start.sh — carga el .env y arranca el servidor
# Ejecutar dentro del contenedor: sh start.sh
 
echo "Cargando variables de entorno..."
export $(cat .env | grep -v '^#' | xargs)
 
# DB_HOST siempre apunta al nombre del servicio Docker
export DB_HOST=base_de_datos
export DB_NAME=base_incidencias
 
echo "DB_HOST=$DB_HOST"
echo "DB_NAME=$DB_NAME"
echo "JIRA_DOMINIO=$JIRA_DOMINIO"
 
echo "Instalando dependencias..."
npm install
 
echo "Arrancando servidor..."
node server.js
 
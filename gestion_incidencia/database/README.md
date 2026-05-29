# Base de Datos - Gestión de Incidencias

## Cómo restaurar la base de datos

```bash
# Restaurar esquema + datos
docker exec -i mi_postgres psql -U postgres -d base_incidencias < database/scripts/01-schema.sql
docker exec -i mi_postgres psql -U postgres -d base_incidencias < database/scripts/02-data.sql

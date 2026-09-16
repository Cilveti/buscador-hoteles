# Instalación reproducible para otro agente

**Implementación en validación. No declarar una instalación terminada hasta completar los ensayos de esta guía.**

## 1. Auditar el destino

1. Leer `AGENTS.md`, comprobar remoto, cuenta efectiva (`gh api user`) y cambios pendientes.
2. Confirmar que es el buscador ficticio o un fork compatible. Para otro producto hay que adaptar comandos, rutas y aceptaciones, no solo cambiar el nombre del repo.
3. Leer `factory/config.ts`, `factory/policy.ts`, `factory/ci/` y los workflows. Conservar la separación entre controlador, modelo, candidato y publicador.
4. Instalar Bun 1.4.2 y Docker. La imagen fija las bases por digest; PostgreSQL está fijado a 17.11 mediante PGDG. La clave pública de firma está en `factory/ci/postgresql.asc`; su fuente es https://www.postgresql.org/media/keys/ACCC4CF8.asc. Si PGDG retira esa revisión del paquete, actualizar el pin deliberadamente y repetir baseline, no sustituirlo por una versión flotante.

## 2. Configurar

- `factory/config.ts`: repo, rama base, operadores y modelos.
- `factory/sonar-project.properties`: organización y proyecto SonarQube reales.
- Los pins de Bun/OpenCode/Playwright están también en workflows, action local, imagen y `factory/dependencies.ts`. Si se cambian versiones, actualizar todas esas referencias y repetir baseline. No usar `latest` para el worker.
- Si la rama base no es `main`, adaptar triggers de baseline y `sonar.pullrequest.base`.
- Elegir el modelo según la credencial del proveedor; `opencode-go/...` requiere OpenCode Go. La key del proveedor no se convierte en una suscripción nueva por configurar el workflow.

## 3. Comprobar sin modelos

```bash
bun test factory
bun factory/checks/dependencies.integration.ts
bunx --no-install tsc --noEmit -p factory/tsconfig.json
bun factory/setup.ts
```

En un checkout desechable, ejecutar la baseline aislada descrita en README. Instalar dependencias Linux dentro del contenedor; no copiar `node_modules` del ordenador. Validar los YAML con actionlint.

## 4. Preparar GitHub

Publicar la infraestructura por el cauce autorizado hasta que esté en la rama por defecto. No incluir cambios ajenos ni secretos.

```bash
bun factory/setup.ts --apply
```

Esta operación idempotente crea etiquetas y la rama `factory-state`. No lanza modelos, copia credenciales ni cambia permisos de Actions.

El propietario habilita la creación de PR desde Actions, si está desactivada. Solo después de autorización explícita puede el agente ejecutar:

```bash
bun factory/setup.ts --apply --enable-prs
```

Configurar desde una entrada segura, sin imprimir valores:

| Nombre | Tipo | Función |
|---|---|---|
| `OPENCODE_API_KEY` | Secret | Implementador y revisor |
| `SONAR_TOKEN` | Secret | Análisis Sonar, en otro job |
| `SONAR_HOST_URL` | Variable opcional | Por defecto `https://sonarcloud.io` |

La conexión Sonar debe admitir **análisis de PR privadas**. La documentación del 16-09-2026 incluye PR dirigidas a la rama principal en Free, hasta 50k líneas privadas y cinco miembros. Confirmar el plan efectivo de la organización.

Tras importar el repo, desactivar Automatic Analysis en Sonar si se usa este scanner de CI, configurar organización/proyecto y `SONAR_TOKEN`, y ejecutar `Factory Sonar main` desde Actions. Las PR se comparan con el análisis de su rama destino: hace falta una referencia de `main` actualizada. El workflow vuelve a analizarla cuando cambia el producto. Un análisis fallido debe revisarse; no cambiar el gate para fingir éxito. La configuración inicial no importa cobertura LCOV: no presentar métricas de cobertura como comprobadas.

Fuentes: [planes](https://docs.sonarsource.com/sonarqube-cloud/administering-sonarcloud/managing-subscription/subscription-plans), [comparación de PR](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/pull-request-analysis).

Validar el plan real; no contratar ni activar pagos por inferencia sin autorización. Un fallo de conexión no se presenta como quality gate verde.

Si el plan del repositorio admite protección de ramas, exigir `Factory / acceptance`, `Factory / quality` y revisión humana. Sin esa protección, el workflow evita hacer merge pero un usuario con escritura puede saltarse el proceso: no prometer una prohibición impuesta por GitHub.

Antes de etiquetar una tarea, ejecutar `bun factory/setup.ts --check-ready`. Falla si faltan los dos secretos o el permiso de PR. No invoca el modelo y no prueba por sí solo la validez de la cuenta Sonar.

## 5. Preparar Penpot

Seguir [Penpot paso a paso](PENPOT.md) y `factory/designs/README.md`. Probar la consulta real de archivo/componentes y conservar una exportación identificada. CI consume el snapshot, no el ordenador del diseñador. No introducir la clave MCP en el repositorio.

## 6. Ensayar y guardar evidencia

1. Baseline sin modelo verde en Actions.
2. Una issue pequeña con aceptación clara y `factory:basic`; añadir `factory:ready` una vez.
3. Comprobar estado persistido, código propuesto, pruebas reales, review independiente, Sonar y draft PR.
4. Ensayar una corrección; conservar fallo original y feedback del siguiente intento. No afirmar escalado real si el tercer modelo no se ejecutó.
5. Ensayar una petición de permiso: verificar que el job termina, que un actor no autorizado no reanuda, y que el propietario puede aprobar/rechazar la solicitud exacta.
6. Ensayar cancelación y evento duplicado. Una cancelación aceptada debe impedir la publicación. Si la reserva de publicación ya ganó, el sistema debe rechazar la cancelación y señalar que hay que inspeccionar la propuesta. Ningún evento debe reiniciar el contador.
7. Registrar URLs, commits, hash del parche/diseño, modelos, duración y costes disponibles. Desconocido no significa cero.

La prueba acaba con propuestas revisables. No hacer merge/despliegue de producto como parte del instalador.

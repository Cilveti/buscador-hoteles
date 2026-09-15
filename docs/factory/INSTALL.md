# Instalación reproducible para otro agente

**Implementación en validación. No declarar una instalación terminada hasta completar los ensayos de esta guía.**

## 1. Auditar el destino

1. Leer `AGENTS.md`, comprobar remoto, cuenta efectiva (`gh api user`) y cambios pendientes.
2. Confirmar que es el buscador ficticio o un fork compatible. Para otro producto hay que adaptar comandos, rutas y aceptaciones, no solo cambiar el nombre del repo.
3. Leer `factory/config.ts`, `factory/policy.ts`, `factory/ci/` y los workflows. Conservar la separación entre controlador, modelo, candidato y publicador.
4. Instalar Bun 1.4.2 y Docker. La imagen fija las bases por digest; PostgreSQL instalado en esa imagen debe registrarse con su versión efectiva.

## 2. Configurar

- `factory/config.ts`: repo, rama base, operadores y modelos.
- `factory/sonar-project.properties`: organización y proyecto SonarQube reales.
- Los pins de Bun/OpenCode/Playwright están también en workflows, action local e imagen. Si se cambian versiones, actualizar todas esas referencias y repetir baseline. No usar `latest` para el worker.
- Si la rama base no es `main`, adaptar triggers de baseline y `sonar.pullrequest.base`.
- Elegir el modelo según la credencial del proveedor; `opencode-go/...` requiere OpenCode Go. La key del proveedor no se convierte en una suscripción nueva por configurar el workflow.

## 3. Comprobar sin modelos

```bash
bun test factory
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

La conexión Sonar debe admitir **análisis de PR privadas**. Validar el plan real; no contratar ni activar pagos por inferencia sin autorización. Un fallo de conexión no se presenta como quality gate verde.

Si el plan del repositorio admite protección de ramas, exigir `Factory / acceptance`, `Factory / quality` y revisión humana. Sin esa protección, el workflow evita hacer merge pero un usuario con escritura puede saltarse el proceso: no prometer una prohibición impuesta por GitHub.

## 5. Preparar Penpot

Seguir `factory/designs/README.md`. Probar la consulta real de archivo/componentes y conservar una exportación identificada. CI consume el snapshot, no el ordenador del diseñador. No introducir la clave MCP en el repositorio.

## 6. Ensayar y guardar evidencia

1. Baseline sin modelo verde en Actions.
2. Una issue pequeña con aceptación clara y `factory:basic`; añadir `factory:ready` una vez.
3. Comprobar estado persistido, código propuesto, pruebas reales, review independiente, Sonar y draft PR.
4. Ensayar una corrección; conservar fallo original y feedback del siguiente intento. No afirmar escalado real si el tercer modelo no se ejecutó.
5. Ensayar una petición de permiso: verificar que el job termina, que un actor no autorizado no reanuda, y que el propietario puede aprobar/rechazar la solicitud exacta.
6. Ensayar cancelación y evento duplicado. Ninguno debe publicar un candidato después de revocarse la autorización ni reiniciar el contador.
7. Registrar URLs, commits, hash del parche/diseño, modelos, duración y costes disponibles. Desconocido no significa cero.

La prueba acaba con propuestas revisables. No hacer merge/despliegue de producto como parte del instalador.

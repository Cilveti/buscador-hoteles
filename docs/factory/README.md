# Fábrica de software · instalación y operación

**Estado: infraestructura publicada; cinco baselines GitHub verdes, integraciones externas pendientes.** Consultar [evidencia](EVIDENCE.md).

La fábrica convierte una issue autorizada en una propuesta verificable. El resultado es una draft PR o un estado explicado. La integración del producto sigue siendo humana.

## Configuración portable

`factory/config.ts` contiene repositorio, rama, operadores, modelos y límites. Los workflows y el controlador forman una unidad versionada. Un agente instalador deberá inspeccionar el destino, adaptar esa configuración, comprobar los prerrequisitos y ejecutar el ensayo de instalación; copiar archivos no prueba que una instalación funcione.

## Límites de confianza

- El controlador carga política y checks de un commit confiable, nunca del texto de la issue.
- El agente propone código; no cambia permisos, workflow, diseño aprobado ni aceptación externa.
- La ejecución de código candidato no recibe claves del modelo, tokens de publicación ni conexiones a bases de datos reales.
- El revisor puede recomendar una corrección; no puede omitir un check fallido.
- Una decisión humana debe identificar petición y alcance; no es un permiso global permanente.

## Baseline local aislada

Usar un **checkout desechable sin `.env.local`**, Docker y Bun 1.4.2. No ejecutar sobre el checkout de desarrollo con datos locales.

```bash
FACTORY_EVIDENCE_DIR=/ruta/absoluta/fuera-del-checkout bash factory/ci/run.sh
```

Instala desde `bun.lock` sin lifecycle scripts. Cada fase se ejecuta en un contenedor nuevo sin red externa: unitarios/tipos/lint, E2E real con PostgreSQL efímero y build. No publica puertos al host ni reutiliza el volumen de la base de datos diaria. La imagen prepara Chromium y PostgreSQL; los primeros builds necesitan descargarla.

La suite E2E usa los tests existentes de búsqueda, detalle y administración. Los tests de navegador con fixtures y el laboratorio de evaluación son mecanismos diferentes: no se atribuyen sus resultados a una ejecución de la app completa.

## Qué demuestra la validación actual

La suite levanta la aplicación con su servidor de desarrollo y base efímera; el build se comprueba en otro contenedor. No se ha ensayado aún una preview pública ni el servidor compilado en producción. Los casos existentes comprueban búsqueda, detalle y administración: una nueva funcionalidad necesita sus criterios específicos y la revisión de intención sigue siendo humana.

La integración Sonar está preparada, pero todavía no conectada. No se está enviando cobertura LCOV; no presentar el gate como una garantía de cobertura hasta configurar y comprobar esa parte. El aislamiento de CI evita red externa y credenciales; no convierte los tests escritos por el candidato en una aceptación independiente de su propia autoría.

## Integraciones pendientes

- Credencial de modelo: `OPENCODE_API_KEY` (por configurar en este repo).
- Creación de PR desde Actions: desactivada en la auditoría inicial; requiere habilitación del propietario.
- SonarQube: conexión, proyecto y comprobación de plan pendientes; no se declara gate verde por ausencia de integración.
- Penpot: archivo y exportación versionada pendientes. MCP remoto requiere plugin conectado a un archivo abierto.

## Continuidad

Seguir [instalación](INSTALL.md), [operación](OPERATE.md) y [evidencia](EVIDENCE.md). La bitácora de coordinación docente se conserva además en `bitacora-fabrica-hoteles.md`, en la raíz del proyecto del máster; no es necesaria para ejecutar el instalador.

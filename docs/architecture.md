# Arquitectura

## Aplicación

`apps/web` contiene Next, React y Payload. El frontend del catálogo usa puertos de aplicación y adaptadores HTTP. Los endpoints componen el dominio y proyectan exclusivamente los campos públicos. Payload administra hoteles y usuarios sobre PostgreSQL.

- `packages/core/src/catalog`: búsqueda, filtros, ordenación, paginación y consulta por identificador.
- `packages/contracts`: validación de entradas y respuestas públicas con Zod.
- `apps/web/src/features/catalog/application`: estado de consulta y puertos, sin React ni HTTP.
- `apps/web/src/features/catalog/adapters`: interfaz React y transporte HTTP.
- `apps/web/src/composition/catalog`: carga de Payload, facetas y proyección de datos locales.
- `packages/core/src/search` y `packages/adapters/src/synthetic-stays`: ejemplo aislado de reglas deterministas de ocupación para pruebas y mutation testing.

## Reglas de dependencias

`.dependency-cruiser.cjs` define que el core solo puede importar código del propio core y que la aplicación del frontend solo depende de módulos de aplicación y contratos. `tsconfig.architecture.json` hereda los aliases de la aplicación y adapta la resolución para la herramienta.

`tests/architecture/dependencies.test.ts` ejecuta las reglas. Rechaza además cargas como `import(variable)` que no pueden analizarse como dependencias estáticas, y comprueba que las capas examinadas no estén vacías. `configuration.test.ts` valida las reglas con ejemplos permitidos/prohibidos: imports de tipos, reexports, rutas relativas, aliases y cargas dinámicas literales.

Estas reglas no prueban por sí solas que toda decisión de diseño sea correcta. Los tests de comportamiento y la revisión de código completan la comprobación.

## Datos y aislamiento

El catálogo combina registros persistidos en Payload con atributos inventados en `data/hotels`. Los usuarios y las correcciones editoriales viven en la base exclusiva del proyecto. Las credenciales locales se generan al ejecutar setup y están excluidas de Git.

Los tests de navegador base usan un catálogo sintético. La suite E2E adicional ejecuta la aplicación completa con su PostgreSQL y comprueba las integraciones reales.

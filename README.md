# Buscador de hoteles

Repositorio vigente: [Cilveti/buscador-hoteles](https://github.com/Cilveti/buscador-hoteles).

Proyecto docente independiente con un catálogo de **60 hoteles ficticios**, búsqueda por texto y filtros, fichas de hotel y administración con Payload. Las búsquedas se resuelven con reglas TypeScript y datos locales.

## Qué incluye

- Texto sin distinción de acentos o mayúsculas, país, marca y puntuación mínima; ordenación y paginación.
- Filtros y página conservados en la URL y al volver de una ficha.
- API de catálogo, detalle y facetas; contratos Zod y separación entre dominio, aplicación y adaptadores.
- Administración de hoteles y usuarios. Las correcciones editoriales aparecen en las siguientes consultas.
- Biome, TypeScript, tests unitarios/integración, dependency-cruiser, Playwright, accesibilidad con axe y mutation testing con Stryker.

El producto no necesita claves de modelos ni servicios de IA. No incluye búsqueda semántica. El laboratorio de evaluación de agentes es una herramienta local de desarrollo separada del producto: `bun run eval:coding:ui`, puerto 3415. Los ejemplos de estancias en `packages/adapters/src/synthetic-stays` son datos sintéticos para enseñar tests; no son disponibilidad ni precios reales.

## Arranque

Requisitos: **Bun 1.4.2**, **Node 24.6 o posterior dentro de la rama 24**, Docker con el motor arrancado y Google Chrome para las pruebas de navegador.

```sh
bun install --frozen-lockfile
bun run setup
bun run db:up
bun run seed
bun run dev
```

- Buscador: <http://127.0.0.1:3101>
- Administración: <http://127.0.0.1:3101/admin>
- Credenciales: `ADMIN_EMAIL` y `ADMIN_PASSWORD` en tu `.env.local`.

`setup` genera secretos aleatorios locales y conserva los existentes. `.env.local` no se sube a Git. `seed` crea el esquema local, el administrador y los 60 hoteles ficticios; repetirlo conserva los cambios editoriales. Todos los datos y las imágenes están incluidos en el repositorio.

La base se llama `hoteles`, escucha en `127.0.0.1:55433` y usa el volumen Docker exclusivo `buscador-hoteles_catalog_data`. `bun run db:stop` la detiene sin borrar sus datos. El buscador y PostgreSQL están ligados a localhost.

## Comprobaciones

```sh
bun run verify
```

Ejecuta lint, tipos, tests y navegador con fixtures sintéticos, sin necesitar una base de datos. Conserva un informe y logs en `.tmp/verification/`. El navegador de esta comprobación usa el puerto `3181`, componentes React y handlers HTTP reales, con un catálogo sintético en lugar de Payload/PostgreSQL.

| Comando | Qué comprueba |
|---|---|
| `bun run lint` | Formato, imports y reglas de Biome |
| `bun run lint:report` | Incluye también advertencias no bloqueantes |
| `bun run typecheck` | Tipos de aplicación, contratos, scripts y tests |
| `bun run test` | Comportamiento determinista, contratos y arquitectura |
| `bun run check:architecture` | Dependencias permitidas y rutas de imports analizables |
| `bun run test:browser` | Interacciones, navegación, recuperación de errores, teclado y accesibilidad |
| `bun run test:e2e` | Catálogo y administración con Payload/PostgreSQL reales |
| `bun run test:mutation` | Capacidad de los tests para detectar cambios erróneos en la regla sintética de ocupación |

Para `test:e2e`, prepara antes la base con `db:up` y `seed`, y deja libre el puerto `3101`: Playwright arranca y cierra su propio servidor. Las pruebas crean registros identificados como sintéticos y limpian esos registros. No ejecuta evaluaciones de IA.

## Estructura y material del curso

- [`docs/architecture.md`](docs/architecture.md): decisiones y fronteras del código.
- [`docs/course-checks.md`](docs/course-checks.md): dónde ver cada capa de verificación.
- [`docs/provenance.md`](docs/provenance.md): procedencia y límites de los datos.
- [Proyección pública del catálogo](apps/web/src/composition/catalog/README.md): comportamiento de API y filtros.

La interfaz expone los filtros originales. La API ya admite atributos adicionales de catálogo; este proyecto no incorpora una interfaz nueva para ellos.

# Recorrido docente de verificación

| Concepto | Código y comando |
|---|---|
| Tipos y contratos | `packages/contracts/src/catalog.ts`; `bun run typecheck` y tests de contratos |
| Reglas de negocio | `packages/core/src/catalog/search.test.ts`; `bun run test` |
| HTTP y proyección pública | `apps/web/src/app/api/catalog` y `apps/web/src/composition/catalog` |
| Fronteras arquitectónicas | `.dependency-cruiser.cjs`; `bun run check:architecture` |
| Interacción y recuperación | `tests/browser`; `bun run test:browser` |
| Accesibilidad | `tests/browser/accessibility.spec.ts`: axe, teclado y foco |
| Persistencia y administración | `tests/e2e`; `bun run test:e2e` tras preparar la base |
| Mutation testing | `stryker.config.json` y `packages/core/src/search/eligibility.test.ts`; `bun run test:mutation` |

Cada comando puede ejecutarse sin modelos. El arnés permite que una persona o un asistente de programación reciba errores concretos y compruebe sus cambios.

El fixture sintético de navegador verifica componentes y handlers del producto, pero sustituye la persistencia. E2E comprueba además Next, Payload y PostgreSQL. El análisis automático de accesibilidad cubre una parte de los criterios; las comprobaciones de teclado complementan esa cobertura.

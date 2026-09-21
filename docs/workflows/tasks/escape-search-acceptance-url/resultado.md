# Workflow completo: tests al implementar, aceptación concreta en QA

**Completado en 7 min 44,685 s**, con `gpt-5.6-luna` en `high` para todos los roles. Un intento de implementación y una ronda de revisión/QA. La tarea añade Escape para borrar la búsqueda conservando filtros y foco; repetir Escape con el campo vacío no genera otra petición.

## Tiempo medido

| Fase | Duración |
|---|---:|
| Investigación: dos agentes en paralelo | 97,745 s |
| Plan | 35,074 s |
| Implementación y sus tests automáticos | 203,803 s |
| Verificación externa: base y candidato | 25,583 s |
| Revisión independiente de código | 55,431 s |
| QA interactivo | 46,614 s |
| **Comando completo** | **464,685 s** |

Las fases proceden de las transiciones registradas; los 0,435 s restantes corresponden al arranque/cierre del comando. El cronómetro incluye el recorrido completo desde una especificación ya preparada, con dependencias instaladas. [Medición externa](../../../../.tmp/simulations/acceptance-url-2026-09-20T18-21-17Z/timing.json) · [Resumen de fases, agentes y comandos](../../../../.tmp/simulations/acceptance-url-2026-09-20T18-21-17Z/summary.json).

## Qué ocurrió

- **Implementación:** leyó la skill `implementar`, cambió el componente y añadió un escenario de Playwright. Ejecutó lint, tipos, el escenario específico y `verify:app`. Corrigió formato y reforzó la comprobación del orden de resultados dentro de la misma sesión. No hizo exploración manual del navegador.
- **Verificación externa del candidato:** lint, tipos, **60 tests de producto/arquitectura y 7 casos de Playwright**, todos verdes. Sus comandos sumaron 12,257 s; la fase del candidato duró 12,439 s. La tabla incluye además la comprobación inicial de la base.
- **Revisión:** recibió los criterios completos, revisó el código y pasó sin hallazgos.
- **QA:** recibió la URL dentro de los criterios Dado/Cuando/Entonces. Navegó a ella, observó el estado inicial, pulsó Escape y repitió Escape. Confirmó los tres criterios con **3 acciones de navegador y 4 llamadas al agente**, incluida la del veredicto.

La URL solo prepara el estado: el QA comprueba la transición real y observa las peticiones. No se añadió una infraestructura de atajos ni un nuevo sistema de rutas.

## Evidencias

- [Spec y comando para repetir](spec.md) · [Criterios completos](spec.json).
- [Checks del candidato](../../../../.tmp/local-workflows/2026-09-20T18-21-18-110Z-escape-search-acceptance-url-normal/round-1/implementation-1-1/verification/verification.json).
- [Revisión](../../../../.tmp/local-workflows/2026-09-20T18-21-18-110Z-escape-search-acceptance-url-normal/round-1/review/result.json) · [QA, acciones y peticiones](../../../../.tmp/local-workflows/2026-09-20T18-21-18-110Z-escape-search-acceptance-url-normal/round-1/qa/qa.json).
- Capturas inspeccionadas: [búsqueda de Málaga aplicada](../../../../.tmp/local-workflows/2026-09-20T18-21-18-110Z-escape-search-acceptance-url-normal/round-1/qa/screen-01.png) → [primer Escape](../../../../.tmp/local-workflows/2026-09-20T18-21-18-110Z-escape-search-acceptance-url-normal/round-1/qa/screen-02.png) → [segundo Escape](../../../../.tmp/local-workflows/2026-09-20T18-21-18-110Z-escape-search-acceptance-url-normal/round-1/qa/screen-03.png).

Tras el primer Escape desaparece `q`; se mantienen España, orden por valoración y foco. Tras el segundo, el contador continúa en 3 peticiones. El agente citó 02/03 para AC1; la transición antes/después está en 01/02, enlazada correctamente arriba. La revisión de evidencias conserva esta distinción.

## Alcance

Candidato aislado, sin integración ni publicación. React, HTTP y core reales con catálogo sintético; no se ejecutaron PostgreSQL/Payload, SSR, Sonar ni Actions. Revisión y QA usan sesiones separadas del mismo modelo. Es una ejecución medida, no una garantía de tiempo para otras tareas.

El arnés pasó previamente su verificación completa: 195 tests de Bun, 6 casos base de navegador, lint y tipos. [Preflight](../../../../.tmp/verification/acceptance-url-preflight/verification.json). Los artefactos de `.tmp/` son locales y no viajan al clonar el repositorio.

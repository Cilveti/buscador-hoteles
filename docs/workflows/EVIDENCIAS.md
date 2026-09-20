# Ensayos locales · 20 de septiembre de 2026

Estas evidencias se generaron con agentes reales sobre copias aisladas. Los artefactos enlazados están en `.tmp/`, son locales y no se incluyen al clonar el repositorio. Los comandos y ejemplos de la [guía](README.md) permiten repetir el recorrido y generar evidencias propias. No se ha integrado el código generado en la aplicación principal.

## Normal — completado

Tarea: borrar la búsqueda con Escape conservando filtros, orden y foco; con el campo vacío, no iniciar otra consulta.

- [Informe de entrega](../../.tmp/local-workflows/2026-09-20T12-59-29-636Z-escape-search-normal/RESULTADO.md).
- [Plan](../../.tmp/local-workflows/2026-09-20T12-59-29-636Z-escape-search-normal/plan.md).
- [Checks: lint, tipos, 191 tests y 9 recorridos de navegador](../../.tmp/local-workflows/2026-09-20T12-59-29-636Z-escape-search-normal/round-1/implementation-1-1/verification/verification.json).
- [Revisión Codex](../../.tmp/local-workflows/2026-09-20T12-59-29-636Z-escape-search-normal/round-1/review/result.json): sin hallazgos.
- [QA agéntico](../../.tmp/local-workflows/2026-09-20T12-59-29-636Z-escape-search-normal/round-1/qa/qa.json): AC1–AC3 comprobados mediante navegador; seis acciones y un veredicto final.
- Capturas: [Málaga aplicada](../../.tmp/local-workflows/2026-09-20T12-59-29-636Z-escape-search-normal/round-1/qa/screen-04.png) → [después de Escape](../../.tmp/local-workflows/2026-09-20T12-59-29-636Z-escape-search-normal/round-1/qa/screen-05.png).

Las observaciones antes y después del segundo Escape registran 5 peticiones HTTP en ambos estados: el no-op se comprobó también fuera de la captura visual.

## Ralph — completado

Tarea: Escape y una ayuda contextual, como dos incrementos verificables con sesiones nuevas. Cada subtarea pasó sus checks antes de avanzar; ambas necesitaron un segundo intento para corregir formato, con feedback automático y sin intervención manual sobre el candidato.

- [Informe de entrega](../../.tmp/local-workflows/2026-09-20T13-03-27-877Z-search-keyboard-hint-ralph/RESULTADO.md).
- [Plan con las dos subtareas](../../.tmp/local-workflows/2026-09-20T13-03-27-877Z-search-keyboard-hint-ralph/plan.md) · [Historial de fases](../../.tmp/local-workflows/2026-09-20T13-03-27-877Z-search-keyboard-hint-ralph/events.jsonl).
- [Checks finales: lint, tipos, 191 tests y 10 recorridos de navegador](../../.tmp/local-workflows/2026-09-20T13-03-27-877Z-search-keyboard-hint-ralph/round-1/search-escape-hint-2/verification/verification.json).
- [Review independiente](../../.tmp/local-workflows/2026-09-20T13-03-27-877Z-search-keyboard-hint-ralph/round-1/review/result.json): sin hallazgos.
- [QA agéntico](../../.tmp/local-workflows/2026-09-20T13-03-27-877Z-search-keyboard-hint-ralph/round-1/qa/qa.json): AC1–AC4 comprobados; nueve acciones y un veredicto final.
- Capturas: [búsqueda y ayuda visibles](../../.tmp/local-workflows/2026-09-20T13-03-27-877Z-search-keyboard-hint-ralph/round-1/qa/screen-07.png) → [búsqueda borrada, filtros conservados](../../.tmp/local-workflows/2026-09-20T13-03-27-877Z-search-keyboard-hint-ralph/round-1/qa/screen-08.png).

En la prueba de Escape vacío el contador de peticiones se mantuvo en 7. Las capturas de ambas entregas se han inspeccionado también durante la preparación.

## Dos controles que no se limitaron a dar verde

**QA contra la app sin la mejora.** El agente pulsó Escape sobre Málaga aplicada y detectó que no se borraban ni el campo ni la consulta. AC1 y AC2 fallaron; AC3 pasó. [Informe](../../.tmp/local-qa-negative/qa.json) · [Peticiones observadas](../../.tmp/local-qa-negative/requests.json).

**Review con hallazgo y corrección.** En el primer ensayo Ralph, la ayuda contextual desplazaba los iconos del campo. Los tests pasaban, pero Codex identificó el defecto, Claude corrigió la estructura del componente y la siguiente revisión pasó. [Hallazgo original](../../.tmp/local-workflows/2026-09-20T12-50-31-086Z-search-keyboard-hint-ralph/round-1/review/result.json) · [Revisión después de corregir](../../.tmp/local-workflows/2026-09-20T12-50-31-086Z-search-keyboard-hint-ralph/round-2/review/result.json). Ese ensayo completo quedó **fallido** después por un contrato de nombres de evidencias; no se presenta como entrega completada.

## Otros controles verificados

- Aprobación opcional del plan: la ejecución se detuvo antes de implementar; el operador de esta prueba revisó el plan y reanudó mediante `--approve-plan`. No se atribuye esa aprobación a Iñigo. [Eventos del ensayo](../../.tmp/local-workflows/2026-09-20T12-50-31-086Z-search-keyboard-hint-ralph/events.jsonl).
- 7 tests del controlador cubren contratos, cobertura del plan, evidencias inventadas, cambios fuera de permisos, symlinks, stdin literal y timeout de procesos.
- [Verificación del repositorio](../../.tmp/verification/2026-09-20T12-59-50.249Z-4814274c/verification.json): lint, tipos, 191 tests y navegador en verde.

## Alcance

Se probaron React, HTTP y core con catálogo sintético, en Chrome local. No se ejecutaron PostgreSQL/Payload, SSR, Sonar ni GitHub Actions. Son recorridos concretos con revisión probabilística, no una garantía general sobre cualquier tarea. Las ejecuciones fallidas se conservan para diagnóstico; no se han reiniciado sus contadores ni convertido sus estados en éxito.

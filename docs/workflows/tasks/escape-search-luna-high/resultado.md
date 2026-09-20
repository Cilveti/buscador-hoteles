# Simulación de Escape · Luna 5.6 high

**Resultado: completado en 9 min 27 s (566,601 s).** Ejecución normal del 20/09/2026. Todas las 16 llamadas al modelo solicitaron `gpt-5.6-luna` y `reasoningEffort: high`; solo los dos turnos de implementación tenían escritura.

## Qué se hizo

La tarea estaba acordada: Escape borra la búsqueda desde el campo, conserva filtros, ordenación y foco, y no hace nada si el campo está vacío. No se repitió una entrevista ya resuelta. El agente padre preparó la spec; el workflow hizo exploración, plan, implementación, verificación, revisión y QA en contextos separados. No hubo pausa opcional del plan ni intervención manual sobre el candidato.

## Tiempo medido

| Fase | Duración |
|---|---:|
| Exploración, dos investigadores en paralelo | 109.975 s |
| Plan | 39.464 s |
| Implementación y corrección | 170.181 s |
| Checks: base y dos intentos | 94.342 s |
| Revisión independiente | 32.069 s |
| QA con navegador | 120.152 s |

Tiempo total obtenido con reloj monotónico alrededor del comando; fases calculadas a partir de eventos UTC del controlador. Incluye arranque y cierre del workflow. Excluye la preparación de la spec, añadir la opción high al controlador, su validación previa, esta documentación y abrir la vista final. Dependencias ya instaladas; sin PostgreSQL. Es una ejecución concreta, no una media ni una estimación universal.

## Incidencias reales

- El investigador de producto intentó aplicar un patch y el sandbox de solo lectura lo impidió. Ambos investigadores presentaron restricciones de su rol como bloqueos; el planificador las reconcilió con la tarea y continuó sin pedir permisos extra.
- El primer intento pasó tipos, tests y navegador, pero falló lint por el orden de un import. Otra sesión de Luna lo corrigió y volvió a pasar todos los checks. Esa corrección y su nueva verificación añadieron aproximadamente 80 segundos, incluidos en el total.
- La revisión aprobó sin hallazgos. El QA ejecutó nueve acciones y emitió su veredicto en una décima llamada: AC1–AC3 aprobados. Con el campo vacío, el segundo Escape mantuvo el contador en 7 peticiones.

## Comprobaciones y evidencias

- 194 tests y 9 recorridos de navegador, además de lint y tipos, en verde.
- [Resumen de tiempos y metadatos](/Users/cilveti/work/master-ia/proyectos/buscador-hoteles/.tmp/simulations/luna-high-2026-09-20T17-07-35Z/summary.json) · [Cronómetro del comando](/Users/cilveti/work/master-ia/proyectos/buscador-hoteles/.tmp/simulations/luna-high-2026-09-20T17-07-35Z/timing.json).
- [Plan](/Users/cilveti/work/master-ia/proyectos/buscador-hoteles/.tmp/local-workflows/2026-09-20T17-07-36-045Z-escape-search-luna-high-normal/plan.md) · [Checks finales](/Users/cilveti/work/master-ia/proyectos/buscador-hoteles/.tmp/local-workflows/2026-09-20T17-07-36-045Z-escape-search-luna-high-normal/round-1/implementation-1-2/verification/verification.json) · [Revisión](/Users/cilveti/work/master-ia/proyectos/buscador-hoteles/.tmp/local-workflows/2026-09-20T17-07-36-045Z-escape-search-luna-high-normal/round-1/review/result.json).
- [QA y acciones](/Users/cilveti/work/master-ia/proyectos/buscador-hoteles/.tmp/local-workflows/2026-09-20T17-07-36-045Z-escape-search-luna-high-normal/round-1/qa/qa.json) · [Antes de Escape](/Users/cilveti/work/master-ia/proyectos/buscador-hoteles/.tmp/local-workflows/2026-09-20T17-07-36-045Z-escape-search-luna-high-normal/round-1/qa/screen-07.png) · [Después](/Users/cilveti/work/master-ia/proyectos/buscador-hoteles/.tmp/local-workflows/2026-09-20T17-07-36-045Z-escape-search-luna-high-normal/round-1/qa/screen-08.png). Capturas inspeccionadas al preparar esta entrega.
- [Entrega del workflow](/Users/cilveti/work/master-ia/proyectos/buscador-hoteles/.tmp/local-workflows/2026-09-20T17-07-36-045Z-escape-search-luna-high-normal/RESULTADO.md) · [Patch](/Users/cilveti/work/master-ia/proyectos/buscador-hoteles/.tmp/local-workflows/2026-09-20T17-07-36-045Z-escape-search-luna-high-normal/candidate.patch). SHA256: `cdfa73cb8013b264988cade8275fa8fca3ed3e8c3f46d5117d90190dabb8b97d`.

## Probar el candidato

[Vista con Málaga, España y valoración](http://127.0.0.1:3183/?q=M%C3%A1laga&country=Spain&sort=rating). Pulsa Escape dentro del campo. La vista inicial del puerto 3182 conserva la versión original; el candidato sigue aislado.

El servidor está levantado desde el worktree indicado en `state.json`. Al cerrarse, se puede reiniciar desde ese worktree con `TEST_BROWSER_PORT=3183 bun tests/browser/server.ts`. El arnés del navegador usa React, handlers HTTP y core reales con datos sintéticos; no valida PostgreSQL/Payload, SSR, Sonar ni Actions. El agente revisor usa otro contexto del mismo modelo, sin diversidad de proveedor.

## Repetir

La [spec](spec.json) y la [configuración](agents.json) quedan en este directorio. Comando en [spec.md](spec.md). Los artefactos `.tmp` son locales y no se incluyen al clonar el repositorio; una repetición genera sus propias evidencias.

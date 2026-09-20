# Ensayos locales · 20 de septiembre de 2026

## Simulación medida: Luna 5.6 high

[Informe completo](tasks/escape-search-luna-high/resultado.md): Escape, modo normal, **9 min 27 s**, 16 llamadas. Checks, revisión y QA aprobados. Incluye un reintento automático por el orden de un import. El tiempo parte de una especificación preparada y usa dependencias instaladas y catálogo sintético.

## Versión actual: roles configurables, solo Codex

Verificación del repositorio: 194 tests, lint, tipos y navegador en verde. [Informe](../../.tmp/verification/2026-09-20T15-02-25.913Z-ee07c5bd/verification.json).

La prueba de escritura Codex pasó con `workspace-write`. Los tests del adaptador recorren los seis roles usando dos adaptadores de prueba distintos y verifican salida estructurada, permisos y soporte de imágenes. Estos dobles no acreditan soporte real de Claude/OpenCode.

### Normal Codex — completado

- [Resultado](../../.tmp/local-workflows/2026-09-20T14-51-47-750Z-escape-search-normal/RESULTADO.md): implementación, revisión y QA con Codex en sesiones separadas.
- [Checks](../../.tmp/local-workflows/2026-09-20T14-51-47-750Z-escape-search-normal/round-1/implementation-1-1/verification/verification.json): lint, tipos, 194 tests y 9 recorridos de navegador.
- [QA](../../.tmp/local-workflows/2026-09-20T14-51-47-750Z-escape-search-normal/round-1/qa/qa.json): AC1–AC3; capturas [antes](../../.tmp/local-workflows/2026-09-20T14-51-47-750Z-escape-search-normal/round-1/qa/screen-04.png) → [después de Escape](../../.tmp/local-workflows/2026-09-20T14-51-47-750Z-escape-search-normal/round-1/qa/screen-05.png). El segundo Escape deja el contador en 5 peticiones. El agente atribuyó AC1 a capturas 03/04; el par que muestra su transición completa es 04/05. La validación de nombres no garantiza una atribución semántica correcta.
- [Configuración congelada y aprobación opcional](../../.tmp/local-workflows/2026-09-20T14-51-47-750Z-escape-search-normal/config-freeze-test.json): reanudar sin aprobación no cambia estado. Tras revisar el plan, el operador de la prueba aprobó y reanudó; el run mantuvo Codex aunque la copia de configuración de entrada se había cambiado a un arnés inexistente. No se atribuye esa aprobación a Iñigo.

### Ralph Codex — primer ensayo bloqueado

Ambas subtareas pasaron checks; [la revisión](../../.tmp/local-workflows/2026-09-20T14-51-48-903Z-search-keyboard-hint-ralph/round-1/review/result.json) encontró que la ayuda desplazaba los controles. El primer intento de corrección añadió comprobaciones de posición que fallaron y recibió sus logs. El siguiente corrigió el código, pero intentó arrancar Playwright dentro de su sandbox y reportó EADDRINUSE; el controlador respetó el bloqueo. [Estado conservado](../../.tmp/local-workflows/2026-09-20T14-51-48-903Z-search-keyboard-hint-ralph/state.json).

Se aclaró el reparto: los trabajadores no arrancan servidores ni navegadores; el controlador hace esas comprobaciones en puertos propios. El segundo ensayo `2026-09-20T15-02-24-884Z-search-keyboard-hint-ralph` pasó ambas subtareas, sus checks y la revisión; se interrumpió durante QA al pedir Iñigo pruebas mucho más sencillas. Su estado queda fallido por cancelación, sin presentarlo como entrega completa. [Nota del operador](../../.tmp/local-workflows/2026-09-20T15-02-24-884Z-search-keyboard-hint-ralph/operator-note.json).

### Ralph Codex — prueba sencilla completada

La [spec de copy](examples/copy-search.json) solo pide dos sustituciones de texto: botón «Buscar hoteles» y subtítulo «Encuentra tu próximo hotel.». Ambas se completaron en sesiones separadas y con un intento por subtarea. El patch cambia dos líneas de un único archivo; no añade tests ni modifica lógica o dependencias.

- [Resultado](../../.tmp/local-workflows/2026-09-20T15-09-40-392Z-copy-search-ralph/RESULTADO.md) · [Plan de dos subtareas](../../.tmp/local-workflows/2026-09-20T15-09-40-392Z-copy-search-ralph/plan.md).
- [Checks finales](../../.tmp/local-workflows/2026-09-20T15-09-40-392Z-copy-search-ralph/round-1/copy-search-subtitle-1/verification/verification.json): lint, tipos, 194 tests y los 6 recorridos existentes de navegador.
- [Review](../../.tmp/local-workflows/2026-09-20T15-09-40-392Z-copy-search-ralph/round-1/review/result.json): sin hallazgos.
- [QA](../../.tmp/local-workflows/2026-09-20T15-09-40-392Z-copy-search-ralph/round-1/qa/qa.json): comprobó ambos textos y aplicó una búsqueda pulsando el botón. [Captura inspeccionada](../../.tmp/local-workflows/2026-09-20T15-09-40-392Z-copy-search-ralph/round-1/qa/screen-02.png).
- [Resumen auditado](../../.tmp/local-workflows/2026-09-20T15-09-40-392Z-copy-search-ralph/validation-summary.json): 9 llamadas, todas Codex; solo los dos turnos de implementación tenían escritura. Evidencias y patch vinculados al mismo SHA256.

La revisión usa otro contexto del mismo arnés; esta prueba no acredita diversidad de proveedor. El candidato continúa aislado y no se ha aplicado al buscador principal.

## Versión anterior: Claude implementa y Codex revisa/QA

Los siguientes resultados corresponden a la versión anterior (commit `5bbc1b8`) y conservan su procedencia.

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

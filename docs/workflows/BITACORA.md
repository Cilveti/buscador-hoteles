# Workflow agéntico local

## Objetivo
Grill-me → spec → research/plan → implementación normal o Ralph → verificación externa → revisión adversarial → QA agéntico de navegador. Reproducible en el buscador, independiente del arnés y sin depender de GitHub Actions.

## Estado actual
20/09/2026, rama `codex/local-agentic-workflows`. Roles desacoplados del arnés; configuración inicial solo Codex. Normal y Ralph completados. Iñigo descarta cambios de texto y elige una mejora pequeña: borrar la búsqueda con Escape. La simulación con Luna 5.6 high terminó: 9 min 27 s, con un reintento de lint y QA aprobado. No se han integrado los candidatos ni publicado cambios.

## Decisiones vigentes
- Configuración por defecto/rol en `workflow.agents.json`, congelada en `state.json` al iniciar. La reanudación no relee el JSON del proyecto.
- Contrato pequeño en `harness.ts`; CLI Codex en `codex.ts`; fases y QA ajenos al proveedor. Solo Codex está instalado y probado. Otro arnés necesita su adaptador.
- Implementación, revisión y QA usan sesiones separadas de Codex: separación de contexto, sin afirmar diversidad de proveedor.
- Aprobación del plan opcional; decisiones pendientes de producto/permisos bloquean.
- Snapshot Git aislado; integración posterior fuera del workflow.
- Ralph: contexto nuevo por subtarea/intento, progreso persistente y checks externos. Límites acotados; no reiniciar contadores para obtener un verde.
- Los trabajadores pueden editar, formatear y ejecutar tests enfocados sin servidor. El controlador arranca servidores y navegador fuera del sandbox del trabajador en puertos propios.
- QA con React/handlers/core reales y catálogo sintético: no acredita PostgreSQL/Payload, SSR, Sonar ni Actions.

## Progreso verificado
- Simulación actual completada en 566,601 s: `2026-09-20T17-07-36-045Z-escape-search-luna-high-normal`. Todos los roles configurados con `gpt-5.6-luna`, `reasoningEffort: high`; sin pausa opcional del plan. Spec en `docs/workflows/tasks/escape-search-luna-high/`; medición externa en `.tmp/simulations/luna-high-2026-09-20T17-07-35Z/`.
- Añadido paso de reasoningEffort del JSON al adaptador y a los metadatos. 10 tests del controlador, 55 aserciones, verdes. El CLI local y su catálogo confirman Luna, high e imágenes. Verificación completa verde: `.tmp/verification/2026-09-20T17-07-34.698Z-8b6525f3/verification.json`.
- 10 tests del controlador; 194 tests en la suite completa. Lint, tipos, tests y navegador verdes: `.tmp/verification/2026-09-20T15-02-25.913Z-ee07c5bd/verification.json`.
- Configuración y permisos probados con dos adaptadores de prueba: todos los roles, rutas, imágenes, salidas inválidas y rechazo de escritura del revisor. Esos dobles no acreditan soporte real de otro arnés.
- Edición real Codex con workspace-write: `.tmp/codex-workflow-write-probe/result.json`.
- Normal Codex completado: `2026-09-20T14-51-47-750Z-escape-search-normal`; 12 llamadas Codex, solo implementador con escritura, 9 recorridos de navegador y QA AC1–AC3.
- Configuración congelada comprobada: reanudó con Codex pese a cambiar la copia del JSON de entrada; intentar continuar sin aprobación no modificó el estado. El operador de prueba leyó y aprobó el plan; no se atribuye esa aprobación a Iñigo.
- Primer Ralph Codex: `2026-09-20T14-51-48-903Z-search-keyboard-hint-ralph`, bloqueado. La review detectó desplazamiento de controles, devolvió el hallazgo y se generaron tests de geometría que detectaron una corrección incompleta. El siguiente intento corrigió el código, pero reportó EADDRINUSE al intentar Playwright dentro del sandbox. Se conserva el bloqueo.
- Segundo Ralph Codex: `2026-09-20T15-02-24-884Z-search-keyboard-hint-ralph`, checks y review superados; cancelado durante QA por la petición de simplificar las pruebas. Estado fallido conservado y motivo en operator-note.json.
- Prueba sencilla completada: `2026-09-20T15-09-40-392Z-copy-search-ralph`. Dos sustituciones de texto, una por subtarea y un intento cada una; sin lógica nueva ni tests de copy. 194 tests y 6 recorridos de navegador, review sin hallazgos y QA con captura inspeccionada. 9 llamadas Codex; solo los dos implementadores con escritura. Es el ejemplo inicial en la guía.
- Skill abordar-tarea validada con quick_validate; guía y evidencia actualizadas.

- Luna high: 16 llamadas, 2 intentos de implementación, 194 tests y 9 recorridos de navegador. El reintento por imports consumió ~80 s; QA confirmó los tres criterios y las capturas fueron inspeccionadas.

## Aprendizajes confirmados
- La skill se usa también en evaluaciones; conserva su procedimiento original en modo trabajador para evitar recursión.
- QA necesita historial de observaciones y acciones, además de URL, foco, árbol accesible, peticiones y capturas.
- Validar que un archivo de evidencia existe no valida su interpretación: revisar capturas antes de enseñar resultados.
- Worktrees fuera de carpetas ignoradas por Biome; rutas canónicas del temporal macOS para resolver enlaces.
- El control de rutas del diff es posterior a la escritura. No es una ACL por archivo ni un sandbox de código hostil.
- El servidor de QA debe arrancarlo el controlador, sin depender de la capacidad del arnés para escuchar puertos.

## Historial
La versión anterior `5bbc1b8` usaba Claude para implementar y Codex para revisión/QA. Ambos modos completaron su recorrido, incluidos ejemplos negativos y feedback real. Los detalles y enlaces mantienen su procedencia en EVIDENCIAS.md; no acreditan la nueva integración Codex.

## Próximo paso
Resultado y tiempos en `docs/workflows/tasks/escape-search-luna-high/resultado.md`. Candidato servido en 3183 y original en 3182. El usuario puede probar Escape; el candidato continúa aislado. No queda trabajo para esta simulación. Los tiempos excluyen preparación del controlador y conversación humana. Los intentos y sus incidencias se conservan.

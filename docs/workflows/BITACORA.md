# Workflow agéntico local

## Objetivo
Grill-me → spec → research/plan → implementación normal o Ralph → verificación externa → revisión adversarial → QA agéntico de navegador. Reproducible en el buscador, independiente del arnés y sin depender de GitHub Actions.

## Estado actual
21/09/2026, rama `codex/local-agentic-workflows`. Mejoras previas del workflow guardadas en `b5c9930`; verificación completa verde. Entrada conversacional actualizada según la slide: URL de issue → `gh` → grill-me breve → confirmación explícita → to-spec y script → espera → revisión humana. Se conserva el controlador existente. Las tres skills conversacionales pasan el validador; sus enlaces locales resuelven y el diff pasa la comprobación de espacios. Este cambio se guarda en el segundo commit del encargo.

## Decisiones vigentes
- Confirmación explícita al terminar el grill-me, con un resumen corto: autoriza to-spec y ejecución en un solo paso. Es una instrucción conversacional de la skill; el CLI directo no fuerza esta pausa. El plan técnico sigue sin aprobación por defecto y la integración queda fuera del script.
- La entrada por issue lee descripción y comentarios con `gh`; el agente padre consulta el repo, pregunta como máximo tres cosas por tanda, espera el proceso y avisa al terminar. No activa Actions ni modifica la issue por leerla.
- Configuración por defecto/rol en `workflow.agents.json`, congelada en `state.json` al iniciar. La reanudación no relee el JSON del proyecto.
- Contrato pequeño en `harness.ts`; CLI Codex en `codex.ts`; fases y QA ajenos al proveedor. Solo Codex está instalado y probado. Otro arnés necesita su adaptador.
- Implementación, revisión y QA usan sesiones separadas de Codex: separación de contexto, sin afirmar diversidad de proveedor.
- Aprobación del plan opcional; decisiones pendientes de producto/permisos bloquean.
- Snapshot Git aislado; integración posterior fuera del workflow.
- Ralph: contexto nuevo por subtarea/intento, progreso persistente y checks externos. Límites acotados; no reiniciar contadores para obtener un verde.
- El implementador debe ejecutar lint, tipos y tests relevantes antes de entregar; Playwright si cambia interacción de UI. El controlador proporciona Chrome temporal y puerto de app; el worker ejecuta los tests contra esa conexión. Los otros roles no implementan. Se conserva la verificación externa independiente.
- Perfil `app` para candidatos de producto: lint/tipos completos, producto/arquitectura y navegador. Perfil completo para cambios del arnés/configuración y CI. No se borran tests ni se altera el procedimiento evaluado en `abordar-tarea/references/implementation.md`.
- QA con React/handlers/core reales y catálogo sintético: no acredita PostgreSQL/Payload, SSR, Sonar ni Actions.

## Progreso verificado
- 21/09: verificación completa antes de los commits: lint, tipos, 195 tests (1406 aserciones) y 6 casos de navegador verdes. Evidencia: `.tmp/verification/workflow-before-commits-2026-09-21/verification.json`. Comando de lectura de issue comprobado contra #16, con título, cuerpo, comentarios, etiquetas, URL, estado y fecha de actualización.
- Último recorrido completo: `2026-09-20T18-21-18-110Z-escape-search-acceptance-url-normal`. Implementador con lint/tipos/tests y Playwright automático; sin exploración manual. Checks externos: 60 tests y 7 casos de navegador; review sin hallazgos; QA confirma AC1–AC3 en 46,614 s, con 3 acciones y 4 llamadas. Capturas 01→02→03 y contador de peticiones inspeccionados. Preflight completo verde: 195 tests y 6 casos base en `.tmp/verification/acceptance-url-preflight/`.
- Comparación QA con/sin atajo completada: `qa-atajos-comparacion.md`. Misma implementación inmutable y Luna high; pareja válida con los tres criterios: 76,107 s/8 llamadas/166.847 tokens frente a 43,795 s/5 llamadas/96.865 tokens. Un enlace ahorró tres acciones de preparación. Piloto inconcluso preservado, sin atribuir su menor tiempo a una revisión terminada. La aclaración del protocolo de una sola acción final se incorporó posteriormente al QA y pasó el recorrido completo.
- Prueba real cerrada: `.tmp/self-check-proofs/2026-09-20T17-36-35-274Z/`. Implementador 154,019 s; verificación externa 12,182 s; total 166,399 s. El agente corrigió lint y un escenario de test en la misma sesión, pasó 3 casos Playwright; el controlador pasó 60 tests y 9 recorridos. Alcance y enlaces en EVIDENCIAS.md.
- Perfil app: lint 619 ms, tipos 4722 ms, tests 1043 ms, navegador 5633 ms. Completo tras los cambios: lint 759 ms, tipos 4691 ms, tests 18014 ms, navegador 5502 ms; 195 tests y 6 recorridos, todo verde. Evidencias en `.tmp/verification/app-profile-current/` y `full-after-self-checks/`.
- 16 tests del verificador/workflow pasan; validadores de `implementar` y `abordar-tarea` pasan usando `PYTHONPATH=.tmp/skill-validator-deps`. Conexión de Playwright comprobada desde sandbox con 4 recorridos: `.tmp/worker-browser-connection/`.
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
- El QA conserva servidor propio del controlador. Para autoevaluación del implementador, red habilitada permite arrancar la app, pero Chrome sigue bloqueado por Seatbelt en macOS; usar Chrome temporal del controlador mediante `TEST_BROWSER_WS_ENDPOINT`, que la configuración Playwright ya soportaba. No recurrir a desactivar el sandbox de archivos.

## Historial
La versión anterior `5bbc1b8` usaba Claude para implementar y Codex para revisión/QA. Ambos modos completaron su recorrido, incluidos ejemplos negativos y feedback real. Los detalles y enlaces mantienen su procedencia en EVIDENCIAS.md; no acreditan la nueva integración Codex.

## Próximo paso
Sin cambios de implementación pendientes de este encargo. Próxima prueba de usuario: invocar abordar-tarea con #16 desde un chat nuevo, responder al grill-me y confirmar el paso a spec/ejecución. La lectura real con gh y la validación de skills están comprobadas; esa interacción completa desde Cursor aún no se ha ensayado. Commits locales, sin push ni integración de los candidatos aislados.

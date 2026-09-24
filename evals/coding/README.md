# Laboratorio local de arneses

Sistema del proyecto `buscador-hoteles`, separado del producto y su base de datos. Candidato y juez usan los CLIs instalados y su autenticación existente. Los checks deterministas no consumen modelos; ejecutar una evaluación sí.

## Interfaz y CLI

```sh
bun run eval:coding:ui
bun run eval:coding --config evals/coding/example.json --prepare-only
bun run eval:coding --config evals/coding/example.json
```

UI desktop: `http://localhost:3415/`, configurable con `EVAL_UI_PORT`. Permite editar requisitos y prompt a partir de fuentes, seleccionar skills disponibles/iniciales, idioma, checks y baseline, guardar recetas y ejecutar. La tabla tiene vistas y selector de columnas. La aceptación privada se configura bajo verificación externa y no se ofrece al candidato.

La navegación separa **Evaluaciones** de **Workflows**. Evaluaciones contiene campañas, runs, notas y juez; desde el detalle de una run, «Ver recorrido» abre sus fases, agentes y trazas sin sacarla de Evaluaciones. Incluso el candidato de un solo agente usa esa representación; el candidato de workflow completo añade sus roles y feedback. Workflows lista solo las ejecuciones normales, que pueden lanzarse allí con spec y agentes registrados o desde CLI. Ambas secciones comparten el contrato visual, no la lista. [Detalles y límites de sesiones](../../docs/workflows/README.md#sala-de-control-local).

Desde el botón ⚙ de una run o «Ver configuración» en su detalle se abre el mismo formulario en modo lectura. Usa la configuración de la ejecución, el commit resuelto y los textos congelados de especificación y proceso; no recarga las fuentes actuales. Los textos no conservados se indican como tales. Permite ampliar ambos editores y conserva cualquier borrador de receta al volver.

### Evaluar el workflow completo

`candidateKind: "workflow"` convierte investigación → plan → implementación → verify → review → QA y sus rondas de feedback en **un solo candidato evaluado**. Después de la entrega, el mismo runner ejecuta los checks restaurados, los tests escritos por el candidato, la aceptación privada y el juez Sol high de seis dimensiones. `workflowCompleted` es un gate adicional: terminar el proceso no sustituye los demás checks ni la nota. El resultado guarda tiempos por fase, llamadas de cada rol, review, QA, feedback y hashes de patches por ronda. La vista de recetas permite elegir «Workflow completo»; por CLI se especifica `--candidate-kind workflow --workflow-spec evals/coding/tasks/<tarea>/workflow-spec.json`.

La spec pública `workflow-spec.json` debe tener el mismo ID y requisitos que la tarea del laboratorio. Los criterios de QA han de describir escenarios observables y, si necesitan un estado difícil de alcanzar, proporcionar una URL de preparación; eso no sustituye la interacción que QA debe ejecutar. El juez recibe tanto el prompt de la tarea como la spec y señala discrepancias. El dossier y la aceptación siguen fuera de Git y de todos los workers. Cada rol usa el modelo/esfuerzo seleccionados, con Chrome reservado y aislado durante toda la ejecución. Por ahora esta modalidad admite Codex, modo normal, todos los checks y los prompts de fase del workflow; las variantes de prompt/skill inline del agente único no se trasladan implícitamente. La aplicación QA usa el catálogo sintético, no Payload/PostgreSQL/SSR.

Ejemplo reproducible: `evals/coding/tasks/review-order/workflow-spec.json` con el bundle privado `review-order/acceptance-v1` y su dossier, seleccionados en una receta local. Para comparar con agente único, fijar el mismo commit, tarea, aceptación, dossier y juez; la diferencia de prompts y verificaciones internas es precisamente parte del tratamiento. Un pass del workflow, incluso con aceptación privada verde, no demuestra que review detecte defectos desconocidos: esa capacidad exige casos con bug conocido y control sano.

El juez fijo es Codex `gpt-6-sol` con esfuerzo `high`. `EVAL_CODEX_BIN` selecciona un ejecutable local para candidato y juez sin cambiar el PATH ni la instalación global. En macOS el arnés prefiere el CLI incluido en ChatGPT cuando existe y, fuera de ese caso, usa `codex` del PATH. Las versiones efectivas y comandos se conservan con los resultados. `EVAL_PRIVATE_READ_ROOTS` permite añadir directorios privados a denegar, separados por el delimitador de rutas del sistema.

## Idiomas y contenido exacto

- `skillLanguage`: `en` por defecto o `es`.
- `skillLanguages`: excepciones por ID, por ejemplo `{ "hoteles-testing": "en" }` con idioma general `es`.
- Inglés en `.agents/skills/<id>/`; castellano en `evals/coding/skill-locales/es/<id>/`.
- Se seleccionan tanto `SKILL.md` como sus referencias. Los archivos se materializan bajo `.agents/skills/<id>/` en el candidato, conservando IDs, comandos y enlaces. No recibe el almacén de traducciones.
- Una traducción ausente falla antes del candidato; no se sustituye silenciosamente por otro idioma.
- `skills` controla disponibles; `initialSkills` inyecta instrucciones al arrancar; `processSkill` selecciona la fuente del prompt de proceso. `browserSkill` controla la skill de navegador.
- `specificationText` y `promptText`, cuando existen, se guardan literalmente. Cambiar idioma recarga un prompt que coincide con su fuente; conserva un texto editado. No hay traducción automática de texto propio.

```json
{
  "task": "advanced-filters",
  "harness": "codex",
  "model": "gpt-5.6-luna",
  "effort": "high",
  "baseline": "working-tree",
  "repeats": 2,
  "concurrency": 2,
  "taskFile": "evals/coding/tasks/advanced-filters/specification.md",
  "processSkill": ".agents/skills/abordar-tarea/SKILL.md",
  "skillLanguage": "es",
  "skillLanguages": { "hoteles-testing": "en" },
  "candidateChecks": ["lint", "typecheck", "tests", "architecture", "browser"]
}
```

## Baseline y verificación

`working-tree` captura cambios y archivos nuevos con un índice temporal, sin alterar el staging del usuario. `inputs.json` conserva el commit; úsalo para repetir el mismo baseline. Una rama/ref se resuelve localmente sin fetch. La preparación ejecuta los gates sin modelos y aborta ante fallo del repositorio. No se considera un error de infraestructura que la aceptación de una funcionalidad pendiente esté roja.

Cada candidato tiene un worktree. Los controles retiran scripts y tests no seleccionados; no prohíben recrear pruebas o usar herramientas instaladas. El verificador externo restaura referencias originales y comprueba la entrega; ejecuta también los tests añadidos/modificados por el candidato por separado. La ausencia de un script requerido se registra como fallo, no como verde.

Codex usa Git independiente sin historial del controlador y permisos nativos que deniegan el proyecto controlador y almacenamiento privado, permitiendo su worktree y una copia aislada de dependencias. Durante la ejecución, el worktree se sitúa fuera de los directorios privados del controlador; se restaura al terminar. Se usan reflinks cuando el sistema de archivos los soporta. Antes de llamar al modelo se comprueba la denegación y se ejecutan todos los checks habilitados bajo el mismo sandbox, con puertos y navegador asignados. Si falla alguno, no se lanza el candidato; los logs quedan en `runs/<id>/environment-preflight/`. El baseline comprobado fuera del sandbox no sustituye esta comprobación. OpenCode no dispone todavía de este aislamiento de lectura: una campaña se detiene explícitamente al llegar a esa condición, sin ejecutar el candidato sin protección. Skills personales/globales y el navegador externo no son un entorno hermético de código hostil.

## Aceptación y dossier privados

Los bundles viven **fuera del repositorio y de Git**. No guardar tests privados, respuestas doradas ni bugs privilegiados en la especificación o skills candidatas. `privateAcceptance` apunta a un directorio con:

```json
{ "taskId": "advanced-filters", "version": "v1", "command": ["bun", "run", "./verify.ts"] }
```

Ese archivo se llama `acceptance.json`. El directorio contiene la suite y sus recursos; el comando debe referir archivos del bundle, sin escapar de él. El controlador congela la suite y la ejecuta tras entregar, con `EVAL_PROJECT_ROOT` apuntando al código a verificar y `EVAL_BROWSER_PORT`/`EVAL_BROWSER_OUTPUT` exclusivos. Los resultados llegan al juez.

`judgeDossier` apunta a un directorio con `dossier.json` (`taskId`, `version`) y documentos de conocimiento privilegiado. El runner conserva versiones y hashes bajo `~/.local/share/hoteles-harness-evals/frozen/`. El dossier precisa los requisitos; no añade exigencias ocultas ajenas a la tarea.

### Documentación y regresiones acumuladas

El candidato Codex tiene red y `web_search="live"`; el permiso de consultar documentación pública es explícito en el prompt y `.agents/ENVIRONMENT.md`. Puede comprobar APIs en documentación oficial y tipos/código instalados. El juez usa `web_search="disabled"` y el paquete de evidencia. Acceso disponible no demuestra consulta efectiva: comprobar trazas. La rúbrica vigente del controlador se congela en cada nueva campaña, independientemente del baseline de código candidato.

El juez devuelve `regressionTests` con código Bun/Playwright, requisito público, evidencia e índice del hallazgo. El controlador los guarda automáticamente en `~/.local/share/hoteles-harness-evals/private/<task>/regressions/<hash>/`, separados por especificación y con procedencia de entrega/patch. `judge-regressions.json` registra propuestas o errores de escritura sin perder el juicio. Juicios históricos sin ese campo siguen siendo válidos. No se ejecuta código generado al recogerlo ni se incorpora automáticamente a la aceptación activa.

El orquestador valida cada propuesta: comprobar que protege un requisito público, reproducir una aserción de producto en la entrega defectuosa y obtener verde en una referencia correcta para ese caso. Fallos de preparación, imports, selectores o timeouts quedan pendientes. Después crear una nueva versión del bundle privado y seleccionar `privateAcceptance` en la receta siguiente. El runner lo congela y ejecuta automáticamente tras cada entrega; nunca devolver esos resultados al candidato durante el desarrollo ni sobrescribir resultados históricos. La validación/promoción de propuestas sigue siendo una tarea del orquestador, no un trabajo automático del juez.

El navegador usa catálogo sintético, componentes React, handlers HTTP y core reales del worktree; no verifica Next/Payload/PostgreSQL/SSR. Respetar el endpoint suministrado y detener solo procesos propios. El servidor habitual no forma parte de la evaluación.

## Evidencia y límites

`.agent-evals/<campaña>/` conserva manifest, inputs, prompts exactos, bundles de skills y resultados con diff, métricas, checks, juicio y coste. Al terminar cada run y campaña se eliminan sus worktrees, paquetes temporales del juez, trazas brutas y artefactos pesados de navegador. Desde esta versión se archiva antes una proyección de eventos visibles por agente para navegarla en la sala de control; no conserva razonamiento interno ni salidas individuales completas cuando superan el límite de visualización. Las runs ya compactadas no recuperan trazas eliminadas. También se limpia al fallar o preparar sin modelos. No editar snapshots históricos. Una receta contiene configuración; una run acredita lo ejecutado. Leer las seis dimensiones del juez por separado y distinguir observación del juez de fallo determinista o mutación ejecutada.

Las compactaciones solo tienen recuento exacto cuando la telemetría declara cobertura completa; dato ausente no equivale a cero. Los costes estimados por tokens no son facturas de suscripción. Fallos del CLI, cancelaciones, timeouts y checks incompletos se conservan explícitamente.

`--rejudge-run RUTA --judge-dossier RUTA` sólo funciona sobre evidencia histórica aún retenida; las runs compactadas no conservan el paquete necesario y lo rechazan antes de llamar al modelo. El visor específico de rejuicios y cancelación sigue pendiente.

La migración del 15 de septiembre cambia baseline, namespace y directrices respecto al proyecto anterior. Las cuatro runs originales se mantienen allí; sus rutas e informe se registran en la procedencia local de la nueva campaña. No atribuir al idioma todas las diferencias con esas runs. Comparaciones causales requieren el mismo baseline y protocolo.

## Diagnóstico del entorno candidato

```sh
bun run eval:coding:validate
bun run eval:coding:validate --models
bun run eval:coding:validate --models --profile=all
```

Sin `--models` ejecuta comprobaciones reales de tres perfiles: todos los checks; solo tipos/arquitectura; ninguno. Con `--models`, después de cada preflight aprobado abre un proceso breve mediante `@openai/codex-sdk` con Luna high. Le pide escribir un archivo, ejecutar `verify`, intentar leer un canario privado y comprobar las skills disponibles. Conserva eventos del SDK, salidas reales y resultados en `.agent-evals/environment-validation/`. Un `verify` ausente es lo esperado únicamente en el perfil sin checks. El diagnóstico limpia solo sus worktrees. No forma parte de la suite automática con modelos.

Los tests del controlador no se suministran como tests del producto. Arquitectura y navegador se clasifican por separado, incluso con tests generales desactivados. Las 32 combinaciones se comprueban sin modelos en `runner.test.ts`. Los interruptores controlan scripts y archivos suministrados; no impiden que el candidato escriba pruebas nuevas. La aceptación privada siempre permanece fuera del árbol candidato.

Los checks capturan stdout/stderr mediante pipes, sin heredar descriptores a logs privados. El preflight es asíncrono para mantener operativo el navegador externo. No introducir llamadas bloqueantes para checks que dependan de ese navegador.


## Correcciones y campañas nocturnas (16 septiembre2026)

`bun run eval:coding --reverify-candidate-tests DIRECTORIO_RUN` repite sólo los tests añadidos/modificados de la entrega congelada con los runners correctos. Guarda evidencia en `reverifications`; la UI sólo aplica revisiones que coinciden con el hash del resultado y el commit original. No relanza candidato/juez ni sobrescribe historia. Los tests unitarios van a Bun y los de `tests/browser` a Playwright del producto.

Desde el 22 de septiembre de 2026, los nuevos juicios usan GPT-6 Sol high y seis dimensiones0–10. Los juicios anteriores conservan GPT-5.6 Sol y su procedencia. La nota global pondera funcionalidad35%, código20%, tests20%, directrices10%, verificación10%, informe5%; exige datos de las seis dimensiones. No es una probabilidad ni sustituye la aceptación. Las notas históricas0–2 pueden normalizarse conservando su escala y juez de origen. Un check interrumpido/noejecutado o un juicio inválido se muestran como error de evaluación con resultado nulo.

El Chrome reservado por run se sirve mediante una conexión local. En la copia aislada de Playwright, chromium.launch también conecta a él; las opciones del proceso pertenecen al controlador. Node y Bun prueban esa capacidad antes del candidato, incluso sin checks predefinidos. .agents/ENVIRONMENT.md describe las capacidades disponibles de cada configuración. No se enlazan instrucciones/skills/reglas personales al Codexhome temporal y se desactiva descubrimiento de skills personales mediante configuración; se conservan autenticación y metadatos del modelo. Las dependencias temporales se descartan al entregar, preservando código y evidencias.

El controlador `scripts/coding-eval/overnight.ts DIRECTORIO` consume un plan local finito; escribe estado/recursos, no usa un modelo de orquestación, mantiene concurrencia configurada y frena ante errores de infraestructura, poco disco o plazo. Sólo usarlo con campañas autorizadas. El objetivo nocturno vigente está en `.agents/bitacoras/evaluador-noche-2026-09-16.md`.


### Restauración de manifiestos y revisión completa

La verificación externa conserva los campos de producto de los manifiestos entregados, incluidos `exports`, `imports` y `type`. Sólo restaura su tabla de scripts de referencia. No elimina manifiestos de paquetes nuevos ni repara silenciosamente JSON inválido. Las demás configuraciones de checks existentes mantienen su política de restauración.

`bun run eval:coding --reverify-delivery DIRECTORIO_RUN` repite las comprobaciones externas y los tests del candidato sobre la entrega congelada; si existía aceptación privada, repite su bundle congelado. Después solicita un nuevo juicio Sol high con la evidencia corregida. No vuelve a ejecutar el candidato. Conserva el original y añade una revisión vinculada al hash del resultado y al commit entregado; la UI muestra la nueva nota y resultado con aviso de corrección. Esta operación sí consume un nuevo juicio.


Las suites restauradas incluyen sus archivos auxiliares bajo `tests/`, y la configuración de arquitectura se conserva como referencia. Al verificar tests del candidato por separado se mantienen sus auxiliares entregados. El aprovisionamiento rechaza retirar archivos que el verificador no sabe restaurar. Validar el recorrido completo de disponibilidad a verificación externa sin modelos, además del preflight del sandbox. Las revisiones válidas se acumulan cronológicamente, de modo que una revisión parcial posterior no borra un juicio completo corregido.


### Local laboratory access and isolation (2026-09-16)

Every local API read and write requires the controller capability, stored with mode 0600 in `.agent-evals/ui/access.json`. Open `http://localhost:3415/#access=<token>` once per operator browser; afterward the plain `http://localhost:3415/` URL works, including from bookmarks. The bootstrap clears the fragment and stores the capability for that origin, including its port. Existing `127.0.0.1` links and saved authorizations migrate to `localhost` automatically within the same browser. This does not authorize a new browser or expose the service to other devices: the listener remains bound to loopback. API requests explicitly send an Authorization header; cookies are not accepted, because localhost cookies would also reach other local ports. Version 2 rotates the earlier cookie credential. The original CSRF checks still apply to writes. Never copy the capability into candidate prompts, files or environments.

Candidate preflight checks denied controller/private/history directories, anonymous API access (403, or connection refused when offline), Node/Bun and the leased Chrome. Chrome has its own macOS profile: normal browser capabilities remain available, but reads and writes to controller/private roots are denied. Every browser launch checks a real private `file://` sentinel before serving a candidate; evidence lives in `.agent-evals/browser-isolation/`. This closes the direct file access that an unrestricted external Chrome allowed. macOS Chrome is supported by default; `EVAL_BROWSER_EXECUTABLE` selects an explicit compatible executable. Unsupported isolation fails closed. This is not certification against hostile code or an OS/browser exploit.

## Retención de resultados

Política por defecto `results-only-v1`: eliminación automática de worktrees registrados, dependencias/builds que contienen, paquetes del juez, informes/trazas de navegador y eventos CLI duplicados. Se conservan resultados y correcciones sin modificarlos, prompts, configuración, patch, mensajes finales, métricas de skills/uso/compactaciones y errores. `retention.json` registra limpieza y problemas; un fallo de limpieza no sustituye la nota. Las revisiones Git se fijan mediante refs pequeñas para reconstruir una entrega bajo demanda, sin conservar checkouts completos.

`bun run eval:coding --clean-finished` aplica la política a campañas ya terminadas. Rechaza estados activos y rutas fuera del almacén; no elimina worktrees cotidianos. Los diagnósticos/propuestas/suites privadas tienen su propio ciclo y no se borran con las campañas. Tras compactar no es posible rejuzgar con las trazas originales; hacen falta una nueva evaluación o evidencia conservada expresamente fuera de este flujo. Los resúmenes de compactaciones permanecen en el resultado y `compactions.json`; `count: null` significa desconocido y `observedCount` es un mínimo observado, nunca un cero confirmado.

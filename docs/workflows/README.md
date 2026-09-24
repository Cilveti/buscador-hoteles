# Workflow agéntico local

## Pruébalo conversando

Abre **este repositorio** en Cursor, Codex u otro agente con terminal y di:

> Usa la skill .agents/skills/abordar-tarea/SKILL.md con https://github.com/Cilveti/buscador-hoteles/issues/16. Quiero usar Luna high.

1. El agente lee la issue y sus comentarios con `gh` y consulta el código.
2. Hace un grill-me conciso, con un máximo de tres preguntas por tanda.
3. Resume lo acordado y pregunta **«¿Guardo la especificación en la issue, la marco `ready` y lanzo el workflow local?»**. Espera tu confirmación. Si solo quieres especificar, lo confirma sin incluir ejecución.
4. Con tu confirmación, genera y valida la spec, publica su contenido completo en la issue y añade `ready`. Si también encargaste ejecutar, lanza el script y espera hasta que termine, comunicando avances.
5. Te avisa con el resultado y las evidencias para que revises el candidato. La integración es posterior y requiere tu encargo.

Puedes pedir **Ralph** para implementar por subtareas, «quiero aprobar el plan» o «quiero ver el navegador del QA»; ninguno es obligatorio. La confirmación al terminar el grill-me es distinta de la aprobación opcional del plan técnico.

Las skills canónicas están en `.agents/skills/`; `.claude/skills/` las enlaza, sin duplicar su contenido. Leer explícitamente la ruta evita depender del descubrimiento automático de skills de cada editor. El agente padre entrevista, prepara el contrato, ejecuta el comando y comunica progreso; no implementa por su cuenta mientras trabajan los agentes del workflow. El modelo del agente padre es independiente de los modelos configurados para el script.

La pausa de confirmación es una instrucción de la skill conversacional, no una puerta técnica del CLI. Ejecutar directamente `bun run workflow start` con una spec preparada omite la entrevista y esa pausa.

### De petición breve a tarea preparada

La [plantilla de especificación](spec-template.md) contiene contexto, objetivo, goals/non-goals, alcance, decisiones y restricciones, criterios con casos Dado/Cuando/Entonces, verificación, riesgos y pendientes. No se exige rellenarla al crear una issue: el formulario «Tarea para el workflow local» empieza con una petición breve y el agente completa el acuerdo mediante preguntas.

`ready` significa **especificación acordada y comprobable**, no implementada ni aprobada por QA. Existe como etiqueta independiente en GitHub y no dispara ejecución de modelos. **No confundir con `factory:ready`**, que activa la fábrica cloud. Solo se añade después de confirmar el acuerdo, validar los archivos y guardar la especificación completa en la issue (por defecto como comentario, conservando la descripción original). Si cambian requisitos, se retira hasta confirmar una nueva versión. El agente comprueba estos pasos; GitHub no impide a un humano poner manualmente la etiqueta.

Nuevas specs usan `version: 2` en `spec.json`, con los mismos requisitos que `spec.md`. El JSON conserva también goals, decisiones acordadas, restricciones, riesgos y entorno: todos los roles reciben ese contenido. Los specs y runs históricos siguen siendo compatibles, sin migrarlos ni reescribir su evidencia. [Ejemplo completo](examples/escape-search.json).

Cada AC contiene un `criterion` (regla) y un `scenario` (tipo normal/límite/recuperación, estado inicial, acción y resultado). Un caso independiente tiene un ID propio, de modo que QA informa sobre cada uno y no cubre varios con un solo pass. Los ejemplos no eximen a review/QA de buscar otros fallos pertinentes. Una validación estructural no garantiza exhaustividad ni sustituye al acuerdo humano.

```sh
bun run workflow validate --spec docs/workflows/tasks/<id>/spec.json
```

Este comando no consume modelos ni publica nada. Rechaza el formato incompleto y decisiones pendientes; no evalúa por sí solo la calidad de los requisitos. El entorno debe permitir comprobar los casos: el QA ligero usa tres hoteles sintéticos, no el catálogo de 180 de `bun dev`. Si se necesitan otros datos, persistencia o SSR, hay que resolver ese entorno antes de declarar la tarea preparada; no cambiar la aceptación para lograr un verde.

[Ensayos y evidencias locales](EVIDENCIAS.md): resultados de los recorridos y ejemplos de fallos detectados. [Prueba real tras corregir el timeout](timeout-implementador-2026-09-21.md): Luna high, implementación, checks, revisión y QA completos.

## Qué necesitas

- Las dependencias del buscador instaladas: `bun install --frozen-lockfile`.
- Bun, Node y Chrome según el README principal.
- Codex CLI instalado y autenticado: `codex login status`. La configuración inicial no requiere Claude Code.
- Para empezar desde un ticket: `gh` autenticado con acceso al repositorio. La lectura usa `gh issue view URL --json number,title,body,comments,labels,url,state,updatedAt`. Solo tras confirmar el acuerdo se publica la spec y se añade `ready`; esto no activa la fábrica cloud.
- Permiso de tu cuenta para usar Codex. El consumo depende de tu plan. El arnés y el modelo se eligen en `workflow.agents.json`; sin `model`, se usa el predeterminado del CLI con configuración de usuario omitida. No se leen las antiguas variables `WORKFLOW_CLAUDE_MODEL` ni `WORKFLOW_CODEX_MODEL`.
- El recorrido de catálogo no requiere Docker, PostgreSQL, Penpot alojado ni servidores permanentes. GitHub permite leer el ticket y guardar la spec/etiqueta; también se puede partir de una petición o spec local, sin publicar ni etiquetar.

Entorno comprobado el 20/09/2026: Bun 1.4.2, Node 24.6.0, Codex CLI 0.149.1 en macOS. El controlador usa opciones de esas versiones; comprobar compatibilidad si se emplean CLIs anteriores.

«Local» se refiere al controlador, el código, los checks, la app y el navegador. El arnés seleccionado sigue consultando su modelo remoto con tu autenticación.

## Roles y arneses separados

### Dónde leer o cambiar cada parte

- `scripts/local-workflow/workflow.ts`: preparación y dos bucles explícitos. Un fallo de checks o timeout del implementador consume el siguiente intento disponible; los hallazgos de revisión/QA abren una ronda de corrección. Ralph divide la primera implementación por subtareas.
- `stages.ts`: operaciones concretas de cada fase (agentes, checks, navegador). Se pueden sustituir en los tests del controlador sin consumir modelos.
- `prompts/*.md`: instrucciones de cada agente, separadas de los datos de la tarea. `prompts.ts` compone ambos sin un motor de plantillas.
- `run-state.ts`: creación del snapshot, estado persistente, bloqueo y aprobación del plan.
- `policy.ts`: permisos del patch y protección del candidato contra cambios durante su revisión.
- `qa.ts`: interacción con navegador y evidencias; `report.ts`: entrega final.

Para cambiar modelos o arneses, sigue usando `workflow.agents.json`. El orden del proceso permanece explícito en TypeScript; no hay un motor de grafos ni un formato nuevo de configuración. Se conservan los comandos y el formato de los runs existentes. Rechazar una reanudación no altera su estado guardado ni sus contadores.

`workflow.agents.json` define la selección inicial:

```json
{
  "default": { "harness": "codex" },
  "roles": {}
}
```

Los roles son `research-product`, `research-verification`, `planner`, `implementer`, `reviewer` y `qa`. Una entrada de `roles` puede sustituir el arnés/modelo de ese rol; por ejemplo `"reviewer": {"harness": "codex", "model": "ID_DEL_MODELO"}`. La configuración no altera sus objetivos, orden, permisos ni condiciones de aceptación.

`reasoningEffort` fija el esfuerzo de razonamiento cuando el arnés lo admite. Por ejemplo: `"default": {"harness": "codex", "model": "gpt-5.6-luna", "reasoningEffort": "high"}`. Codex lo recibe mediante `model_reasoning_effort`; sin esta opción mantiene su valor predeterminado. La selección de esta simulación está en [agents.json](tasks/escape-search-luna-high/agents.json) y se conserva en los metadatos de cada llamada.

El flujo llama al contrato `HarnessAdapter` de `scripts/local-workflow/harness.ts`. El adaptador recibe prompt, workspace, modelo, permiso, entorno de checks, imágenes, schema y timeout; devuelve datos que el controlador valida. Solo `codex.ts` conoce los comandos de Codex. Para otro arnés se implementa ese contrato, se registra en `installedHarnesses` dentro de `agents.ts` y se selecciona en el JSON. No hay que modificar `workflow.ts` ni `qa.ts`.

**Hoy solo está instalado y probado el adaptador Codex.** Claude/OpenCode requieren su adaptador antes de poder seleccionarse; escribir un nombre en el JSON no los integra automáticamente. Un arnés desconocido o sin imágenes para QA se rechaza antes de iniciar el trabajo.

El agente padre puede ser cualquier agente con acceso al repositorio y terminal que siga la skill; su identidad no decide los agentes internos. La fase grill-me/to-spec sigue siendo conversacional y la investigación anterior a la spec la realiza el agente padre. Después de la spec, el controlador lanza los dos investigadores configurados.

Con la configuración inicial, implementación, revisión y QA usan Codex en contextos nuevos. Hay separación de sesiones y objetivos, **no diversidad de proveedor**. Los checks deterministas y la decisión de integrar el resultado conservan su función.

## Recorrido

| Fase | Entrada → salida | Quién decide |
|---|---|---|
| Lectura de tarea | Issue + comentarios → contexto contrastado con el repo | Agente padre con `gh` |
| Grill-me | Petición → decisiones resueltas | Tú y el agente padre |
| Confirmación | Resumen → permiso para guardar/etiquetar y, si se encarga, ejecutar | Tú; el agente espera |
| To-spec / ready | Acuerdo → contrato verificable, copia en la issue y etiqueta | Agente padre; no inventa respuestas |
| Research | Spec + snapshot → código relevante y riesgos | Dos investigadores de solo lectura |
| Plan | Spec + research → subtareas verificables | Planificador; pausa humana opcional |
| Implementación | Plan + feedback → cambio y checks relevantes | Implementador con escritura en su workspace |
| Verificación | Cambio → lint, tipos, tests y navegador | Código externo al modelo |
| Review | Spec + diff + checks → hallazgos | Revisor, en una sesión nueva |
| QA | Spec + app + imágenes → acciones y evidencias | QA dirige Playwright; otra sesión/contexto |
| Revisión humana | Informe, patch y evidencias → aceptación o feedback | Tú |
| Entrega | Candidato revisado → integración encargada | Fuera del script; requiere tu encargo |

Antes de llamar modelos, el controlador comprueba que la base pasa la verificación; si el entorno falla, se detiene sin inferencia. Las fases de investigación pueden trabajar a la vez. Solo hay un escritor de código. Cada llamada arranca un contexto nuevo; los resultados estructurados, el plan, el estado y el feedback conservan la continuidad.

El implementador sigue la skill [implementar](../../.agents/skills/implementar/SKILL.md): lint, tipos y tests relevantes antes de entregar, con Playwright cuando cambia comportamiento de UI. El controlador abre un Chrome temporal y proporciona `TEST_BROWSER_PORT`, `TEST_BROWSER_OUTPUT` y `TEST_BROWSER_WS_ENDPOINT`; el trabajador ejecuta `bun run test:browser <archivo.spec.ts>` contra ese navegador. El runner arranca/cierra la app sintética y el controlador cierra Chrome al terminar la fase, también si hay un error. Esto evita el arranque de Chrome bloqueado por el sandbox de macOS. El QA y la verificación externa conservan sus instancias independientes.

### Checks proporcionales

- `bun run verify:app`: lint, todos los tipos, tests del producto y arquitectura, y navegador. Es el perfil del workflow porque su permiso de cambios excluye scripts, configuración y laboratorio.
- `bun run verify`: añade los tests del laboratorio, del verificador y del propio workflow. Sigue siendo obligatorio al cambiar esos sistemas y se conserva en CI.
- Dentro de la implementación: checks enfocados durante la corrección y `verify:app` una vez sobre el estado final, como exige AGENTS.md; no ejecutar previamente por separado todos sus componentes. El controlador comprueba después todo el perfil de producto sobre el mismo patch. Las comprobaciones del agente no sustituyen esa puerta externa.

No se han borrado tests. En la simulación original había **194 tests de Bun** (56 de producto, 4 de arquitectura, 10 del workflow y 124 del laboratorio/verificador), más **9 recorridos de Playwright** (6 base y 3 de Escape). La verificación tardaba unos **31 s**, de ellos **7 s** de navegador. La medición inicial del nuevo perfil sobre la base: **12,0 s** con 60 tests y 6 recorridos. Fuentes: `.tmp/verification/app-profile-current/verification.json` y [simulación original](tasks/escape-search-luna-high/resultado.md). Son mediciones locales con dependencias instaladas, no una garantía de duración en otra máquina.

Las suites deterministas no llaman a modelos ni consumen tokens. El QA agéntico sí: en aquella simulación fueron unos **120 s**, separados de los tests de Playwright. Ejecutar los checks en local no consume minutos de GitHub Actions.

**Plan opcionalmente supervisado:** `--plan-review` guarda `plan.md`, termina el proceso en `waiting-plan` y no implementa. La aprobación reanuda ese plan. Las dudas de producto/alcance bloquean incluso en modo automático. El modo predeterminado permite que un plan sin bloqueos continúe.

## Dos variantes

### Normal

El implementador recibe el plan completo. Una sesión puede resolver sus diferentes partes. Si los checks fallan, otra sesión recibe el cambio anterior y los logs. Tras checks verdes, revisión independiente y QA agéntico.

### Ralph acotado

El plan se convierte en una cola de subtareas. Cada iteración recibe la spec, el plan, el progreso, el código actual y el feedback, y trabaja **solo en una subtarea**. Los checks externos deben pasar antes de marcarla completada. La siguiente iteración abre otra sesión. Al completar la cola, pasan review y QA; los hallazgos pueden iniciar una ronda de corrección con contexto nuevo.

Es una adaptación docente acotada de [Ralph, de Geoffrey Huntley](https://ghuntley.com/ralph/): sesión nueva, una tarea por iteración, estado en archivos y feedback de comprobaciones. No instala el plugin de Claude ni usa un bucle infinito. Por defecto: 2 intentos por tarea y 2 rondas de review/QA. Se pueden subir a 3 explícitamente. Cada llamada tiene timeout (300 s; cada acción QA, 180 s); QA tiene como máximo 16 acciones. Si el implementador agota su tiempo, se conservan los cambios parciales y los logs y se usa el siguiente intento disponible con contexto nuevo. Un timeout nunca cuenta como tarea terminada: sigue haciendo falta una entrega válida y pasar checks, revisión y QA. Agotar ambos intentos termina en `exhausted`; los demás errores técnicos siguen siendo fallos. Estos límites acotan ejecución, no garantizan una factura exacta ni que otro run no vuelva a consumir.

## Qué prueba el QA

Levanta un servidor local y un Chrome temporal propio. El servidor carga componentes React, handlers HTTP y lógica real **del snapshot modificado**, con un catálogo sintético. El agente QA recibe captura, árbol accesible, URL, foco, peticiones HTTP e historial de acciones y observaciones; decide la siguiente navegación, clic, escritura, tecla o comprobación. Playwright ejecuta esa acción y devuelve la observación siguiente. El agente no puede ejecutar JavaScript arbitrario mediante esta interfaz y la navegación/red del navegador queda limitada al origen local.

El informe exige todos los IDs de aceptación, resultado observado y capturas existentes. Las acciones y errores quedan registrados y hay traza de navegador. Una revisión probabilística puede equivocarse: esas comprobaciones estructurales no demuestran que su interpretación sea correcta. Conserva la inspección humana y los tests independientes.

**Alcance:** acredita los recorridos probados del catálogo; no acredita Payload, PostgreSQL, administración, SSR ni integración real de Next. Para esos cambios se necesita el entorno E2E completo, que sigue disponible en el proyecto. Si la tarea exige ese entorno, no aceptar este QA como suficiente. Este workflow no ejecuta Sonar; la fábrica cloud conserva su análisis y sus pendientes de cobertura.

## Comandos que ejecuta tu agente

Desde la raíz del buscador:

```sh
bun run workflow start --spec docs/workflows/tasks/escape-search-luna-high/spec.json --mode normal
bun run workflow start --spec docs/workflows/tasks/escape-search-luna-high/spec.json --mode ralph
```

Aprobación de plan opcional:

```sh
bun run workflow start --spec docs/workflows/tasks/escape-search-luna-high/spec.json --mode normal --plan-review
bun run workflow resume RUTA_DEL_RUN --approve-plan
```

`--agents RUTA.json` selecciona otra configuración para una nueva ejecución. Los runs históricos anteriores a esta configuración siguen siendo consultables, pero no se reanudan con agentes distintos de forma implícita.

`--headed` muestra la ventana del QA. `bun run workflow status RUTA_DEL_RUN` muestra estado y bloqueo. `bun run workflow --help` lista límites.

## Dónde mirar

### Sala de control local

`bun run eval:coding:ui` abre `http://127.0.0.1:3415/` (o `EVAL_UI_PORT`), con una sección **Workflows** reservada al trabajo normal. En ella se pueden escoger una spec registrada, el arnés, modelo y esfuerzo principales, y personalizarlos por fase sin guardar un preset ligado a otra tarea. También se puede iniciar el workflow normal o Ralph, aprobar un plan pausado y ver en vivo fases, checks, agentes, mensajes de feedback, entregables y trazas. La lista de arneses solo ofrece los adaptadores realmente instalados; actualmente solo Codex. La disponibilidad de un modelo concreto depende de la cuenta y se comprueba al ejecutar. El lanzamiento crea un snapshot aislado; no integra cambios, publica ni toca el servidor habitual. Si el agente de confianza usa `bun run workflow start` en la terminal, la ejecución también aparece automáticamente en esa lista. Las campañas y runs con juez y nota viven en **Evaluaciones**; «Ver recorrido» reutiliza la visualización sin añadirlas a la lista de Workflows.

Los agentes aparecen dentro de su fase en «Recorrido», desde donde se abren su traza y resultado estructurado. El QA aparece una vez por ronda: cada decisión es una llamada breve al modelo, no una sesión continua y reanudable. Su traza intercala la observación entregada al modelo, su justificación explícita y veredicto, y la acción ejecutada por el controlador con Playwright y su resultado. Así se distingue lo que hizo el agente de lo que hizo el navegador, sin inventar razonamiento interno. En rondas repetidas se usa también la hora de inicio para colocarlos en la ocurrencia correcta; si falta evidencia para asociar uno, se muestra como «Sin fase identificada» en el mismo recorrido. La cifra de checks resume únicamente los ya registrados: durante una implementación puede mostrar el baseline verde aunque la verificación del cambio, review y QA sigan pendientes.

Los resultados JSON se presentan como resúmenes, tareas, hallazgos y criterios con sus estados y evidencias, tanto en «Ver resultado» como en los mensajes finales de la traza y en el feedback. El historial técnico y el JSON original se pueden desplegar. Los campos no reconocidos se conservan como secciones; un JSON histórico incompleto se muestra como texto con aviso, sin inventar el contenido que falta.

`workflows/definitions/` contiene el contrato declarativo de los recorridos visibles. El adaptador de `delivery` muestra el workflow local; el de `single-agent` representa como workflow incluso una evaluación con un único implementador. Ambos usan la misma estructura de `WorkflowRun` y la misma vista. Las evaluaciones añaden nota y juez, sin que esos conceptos sean obligatorios para los workflows normales.

Cada agente Codex de un **nuevo workflow local** puede conservar su sesión cuando el arnés lo permite. La UI permite copiar `codex -C 'workspace' resume ID` para reabrirla en Codex CLI y ofrece la traza dentro de la propia aplicación. QA es la excepción: se compone de llamadas breves, una por decisión, y su recorrido agregado no es una sesión reanudable. Las sesiones históricas lanzadas con `--ephemeral` y las de evaluación no se pueden reanudar. No se ha comprobado un deep link nativo para abrirlas directamente en Codex Desktop; OpenCode y Cursor aún no tienen adaptador de ejecución ni enlace de sesión en este workflow. La UI no inventa esos enlaces.

Las trazas se muestran por páginas y se actualizan mientras el agente trabaja. Los mensajes quedan a la vista; comandos, herramientas y cambios de archivos se agrupan y sus salidas están plegadas hasta abrirlas. Un grupo con fallos se despliega para señalar las acciones fallidas, pero sus salidas largas siguen plegadas. El visor usa los controles accesibles de Radix y une los eventos de inicio y fin de una misma acción, sin contarlos dos veces. Los eventos de razonamiento interno no se muestran; las salidas individuales muy largas se acortan. Si una evaluación nueva se compacta, se conserva una proyección navegable de mensajes, comandos, herramientas y errores, pero no la traza bruta ni el paquete necesario para rejuiciar. Las evaluaciones ya compactadas antes de esta función solo muestran la evidencia que quedó guardada. El visor marca ausencia de evidencia como desconocida, no como éxito; además comprueba que el patch de entrega de un workflow completado sea aplicable al snapshot base.

Cada ejecución imprime su directorio `.tmp/local-workflows/<id>/`:

- `spec.json`, `plan.md` y `progress.md`: intención, plan y avance.
- `state.json`: estado, intentos y asignación de agentes congelada al iniciar. Una reanudación usa esa asignación; no vuelve a leer la configuración del proyecto.
- `*/agent.json`: rol, arnés, modelo explícito si lo hay, permiso y entorno de comprobación de cada llamada. Los checks propios del implementador quedan en `workspace/.tmp/self-check-*/`; sus comandos y resultados, en `agent.log` y `result.json`.
- `state.json.workspace`: ruta del snapshot Git separado, en el temporal del sistema; el checkout original permanece intacto. Se coloca fuera de `.tmp` para que los analizadores no lo ignoren.
- `round-*/`: prompts, resultados de agentes, verificaciones, revisión y QA.
- `round-*/qa/`: capturas, árboles accesibles, `actions.json`, `requests.json`, `qa.json` y `trace.zip`.
- `events.jsonl`: cambios de fase y aprobación opcional del plan, vinculada a su hash.
- `RESULTADO.md` y `candidate.patch`: entrega si todo pasa.

Los artefactos son locales y no expiran a los siete días. Los logs de agentes pueden incluir código e información del proyecto: inspeccionarlos antes de compartir. No hay subida automática.

Para volver a abrir la app del candidato, entra en la ruta `workspace` que imprime el comando y ejecuta `bun tests/browser/server.ts`: usa el puerto 3181 por defecto y puede cambiarse con `TEST_BROWSER_PORT`. Esto sigue siendo el entorno sintético. Cierra ese proceso al terminar; no interviene sobre el servidor habitual del buscador.

## Permisos y condiciones de parada

El controlador decide los permisos del rol; la configuración no puede conceder escritura a un revisor. El adaptador Codex usa `workspace-write` para el implementador y `read-only` para las demás fases, sin aprobaciones interactivas. Solo el implementador recibe `sandbox_workspace_write.network_access=true` para arrancar la app y conectarse al navegador temporal. Esa opción permite red saliente en general, **no es una restricción técnica a localhost**; el prompt limita el uso a estas pruebas. [Referencia oficial de la opción](https://learn.chatgpt.com/docs/config-file/config-reference). No se desactiva el sandbox de archivos.

El control de rutas del patch se aplica después de la escritura en la copia aislada; no es una ACL que impida cada escritura de archivo. El controlador valida el diff antes de ejecutar sus checks o aceptar código: permite fuentes y tests colocados del producto y nuevos tests de navegador; protege configuración, dependencias, suites de navegador existentes y el propio workflow. Rechaza borrados, symlinks, modos ejecutables y cambios mayores de 200KB. Una necesidad fuera del perímetro bloquea la tarea.

El snapshot y los enlaces de dependencias facilitan el aislamiento operativo; **no son un sandbox de código hostil**. Los checks ejecutan código local y comparten dependencias instaladas. Usar tareas y repositorios de confianza. No se promete aislamiento de secretos de toda la cuenta ni contención de un candidato malicioso.

No hace push, PR, merge, despliegue ni aplica el patch a tu rama. Un éxito es una propuesta local con checks, review y QA; no una aprobación humana del producto. No relanzar automáticamente estados failed/exhausted ni borrar contadores. Una tarea revisada puede crear una nueva ejecución consciente, conservando la anterior.

## Para la clase

Muestra el mismo recorrido primero desde la conversación. La diferencia normal/Ralph se observa en los prompts, `progress.md` y el número de sesiones de implementación. La nube cambia el disparador y el entorno: estos comandos y artefactos pueden adaptarse a un runner, pero no se ha conectado este controlador a Actions.

[Prueba inicial: solo dos textos](examples/copy-search.json). Los ejemplos anteriores de [Escape](examples/escape-search.json) y [ayuda de teclado](examples/search-keyboard-hint.json) quedan como referencias adicionales. [Petición vaga](examples/spec-vaga.md). No atribuir una diferencia causal general a dos ejecuciones aisladas.

## Referencias verificadas · 20/09/2026

- [Codex no interactivo](https://learn.chatgpt.com/docs/non-interactive-mode): CLI y salida estructurada.
- [Ralph](https://ghuntley.com/ralph/): técnica original; los límites y gates de esta implementación son decisiones nuestras.

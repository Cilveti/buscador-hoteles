# Workflow agéntico local

## Pruébalo conversando

Abre **este repositorio** en Claude Code y di:

> Usa abordar-tarea. Quiero poder borrar la búsqueda con Escape conservando los filtros y el foco. Refina conmigo lo que falte, prepara la especificación y ejecuta el workflow normal. Enséñame el resultado y las evidencias.

Para la segunda versión, sustituye «normal» por **«Ralph»**. Puedes añadir «quiero aprobar el plan» o «quiero ver el navegador del QA»; ninguno es obligatorio.

Las skills canónicas están en `.agents/skills/`; `.claude/skills/` las enlaza, sin duplicar su contenido. Desde otro agente, pide que lea `.agents/skills/abordar-tarea/SKILL.md` y siga el mismo proceso. El agente padre entrevista, prepara el contrato, ejecuta el comando y comunica progreso; no implementa por su cuenta mientras trabajan los agentes del workflow.

[Ensayos y evidencias locales](EVIDENCIAS.md): resultados de los recorridos y ejemplos de fallos detectados.

## Qué necesitas

- Las dependencias del buscador instaladas: `bun install --frozen-lockfile`.
- Bun, Node y Chrome según el README principal.
- Claude Code y Codex CLI instalados y autenticados: `claude auth status` y `codex login status`.
- Permiso de tu cuenta para ejecutar esos modelos. Usan tus sesiones de los proveedores; no se crean claves ni se cambian suscripciones. El consumo depende de tu plan. `WORKFLOW_CLAUDE_MODEL` y `WORKFLOW_CODEX_MODEL` permiten elegir modelos; por defecto Claude usa `claude-sonnet-5` y Codex su modelo predeterminado con configuración de usuario omitida.
- No requiere Docker, PostgreSQL, GitHub, Penpot alojado ni servidores permanentes para este recorrido de catálogo.

Entorno comprobado el 20/09/2026: Bun 1.4.2, Node 24.6.0, Claude Code 2.1.278 y Codex CLI 0.149.1 en macOS. El controlador usa opciones de esas versiones; comprobar compatibilidad si se emplean CLIs anteriores.

«Local» se refiere al controlador, el código, los checks, la app y el navegador. Claude y Codex siguen consultando sus modelos remotos con tu autenticación.

## Recorrido

| Fase | Entrada → salida | Quién decide |
|---|---|---|
| Grill-me | Petición → decisiones resueltas | Tú y el agente padre |
| To-spec | Decisiones → contrato con aceptación observable | Agente padre; no inventa respuestas |
| Research | Spec + snapshot → código relevante y riesgos | Dos sesiones Claude de solo lectura |
| Plan | Spec + research → subtareas verificables | Claude; pausa humana opcional |
| Implementación | Plan + feedback → cambio en copia aislada | Claude con edición y sin terminal |
| Verificación | Cambio → lint, tipos, tests y navegador | Código externo al modelo |
| Review | Spec + diff + checks → hallazgos | Codex, en una sesión nueva |
| QA | Spec + app + imágenes → acciones y evidencias | Codex dirige Playwright; otra sesión/contexto |
| Entrega | Criterios comprobados → informe y patch | El controlador; integración humana posterior |

Antes de llamar modelos, el controlador comprueba que la base pasa la verificación; si el entorno falla, se detiene sin inferencia. Las fases de investigación pueden trabajar a la vez. Solo hay un escritor de código. Cada llamada arranca un contexto nuevo; los resultados estructurados, el plan, el estado y el feedback conservan la continuidad.

**Plan opcionalmente supervisado:** `--plan-review` guarda `plan.md`, termina el proceso en `waiting-plan` y no implementa. La aprobación reanuda ese plan. Las dudas de producto/alcance bloquean incluso en modo automático. El modo predeterminado permite que un plan sin bloqueos continúe.

## Dos variantes

### Normal

El implementador recibe el plan completo. Una sesión puede resolver sus diferentes partes. Si los checks fallan, otra sesión recibe el cambio anterior y los logs. Tras checks verdes, revisión independiente y QA agéntico.

### Ralph acotado

El plan se convierte en una cola de subtareas. Cada iteración recibe la spec, el plan, el progreso, el código actual y el feedback, y trabaja **solo en una subtarea**. Los checks externos deben pasar antes de marcarla completada. La siguiente iteración abre otra sesión. Al completar la cola, pasan review y QA; los hallazgos pueden iniciar una ronda de corrección con contexto nuevo.

Es una adaptación docente acotada de [Ralph, de Geoffrey Huntley](https://ghuntley.com/ralph/): sesión nueva, una tarea por iteración, estado en archivos y feedback de comprobaciones. No instala el plugin de Claude ni usa un bucle infinito. Por defecto: 2 intentos por tarea y 2 rondas de review/QA. Se pueden subir a 3 explícitamente. Cada llamada tiene timeout; QA tiene como máximo 16 acciones. Estos límites acotan ejecución, no garantizan una factura exacta ni que otro run no vuelva a consumir.

## Qué prueba el QA

Levanta un servidor local y un Chrome temporal propio. El servidor carga componentes React, handlers HTTP y lógica real **del snapshot modificado**, con un catálogo sintético. Codex recibe captura, árbol accesible, URL, foco, peticiones HTTP e historial de acciones y observaciones; decide la siguiente navegación, clic, escritura, tecla o comprobación. Playwright ejecuta esa acción y devuelve la observación siguiente. El agente no puede ejecutar JavaScript arbitrario mediante esta interfaz y la navegación/red del navegador queda limitada al origen local.

El informe exige todos los IDs de aceptación, resultado observado y capturas existentes. Las acciones y errores quedan registrados y hay traza de navegador. Una revisión probabilística puede equivocarse: esas comprobaciones estructurales no demuestran que su interpretación sea correcta. Conserva la inspección humana y los tests independientes.

**Alcance:** acredita los recorridos probados del catálogo; no acredita Payload, PostgreSQL, administración, SSR ni integración real de Next. Para esos cambios se necesita el entorno E2E completo, que sigue disponible en el proyecto. Si la tarea exige ese entorno, no aceptar este QA como suficiente. Este workflow no ejecuta Sonar; la fábrica cloud conserva su análisis y sus pendientes de cobertura.

## Comandos que ejecuta tu agente

Desde la raíz del buscador:

```sh
bun run workflow start --spec docs/workflows/examples/escape-search.json --mode normal
bun run workflow start --spec docs/workflows/examples/search-keyboard-hint.json --mode ralph
```

Aprobación de plan opcional:

```sh
bun run workflow start --spec docs/workflows/examples/escape-search.json --mode normal --plan-review
bun run workflow resume RUTA_DEL_RUN --approve-plan
```

`--headed` muestra la ventana del QA. `bun run workflow status RUTA_DEL_RUN` muestra estado y bloqueo. `bun run workflow --help` lista límites.

## Dónde mirar

Cada ejecución imprime su directorio `.tmp/local-workflows/<id>/`:

- `spec.json`, `plan.md` y `progress.md`: intención, plan y avance.
- `state.json`: estado del controlador e intentos consumidos.
- `state.json.workspace`: ruta del snapshot Git separado, en el temporal del sistema; el checkout original permanece intacto. Se coloca fuera de `.tmp` para que los analizadores no lo ignoren.
- `round-*/`: prompts, resultados de agentes, verificaciones, revisión y QA.
- `round-*/qa/`: capturas, árboles accesibles, `actions.json`, `requests.json`, `qa.json` y `trace.zip`.
- `events.jsonl`: cambios de fase y aprobación opcional del plan, vinculada a su hash.
- `RESULTADO.md` y `candidate.patch`: entrega si todo pasa.

Los artefactos son locales y no expiran a los siete días. Los logs de agentes pueden incluir código e información del proyecto: inspeccionarlos antes de compartir. No hay subida automática.

Para volver a abrir la app del candidato, entra en la ruta `workspace` que imprime el comando y ejecuta `bun tests/browser/server.ts`: usa el puerto 3181 por defecto y puede cambiarse con `TEST_BROWSER_PORT`. Esto sigue siendo el entorno sintético. Cierra ese proceso al terminar; no interviene sobre el servidor habitual del buscador.

## Permisos y condiciones de parada

Los trabajadores Claude solo tienen herramientas de lectura o edición de archivos según su fase; no reciben Bash, Git ni herramientas de publicación. Codex corre en modo de solo lectura. El controlador valida el diff antes de ejecutar o aceptar código: permite fuentes y tests colocados del producto y nuevos tests de navegador; protege configuración, dependencias, suites de navegador existentes y el propio workflow. Rechaza borrados, symlinks, modos ejecutables y cambios mayores de 200KB. Una necesidad fuera del perímetro bloquea la tarea.

El snapshot y los enlaces de dependencias facilitan el aislamiento operativo; **no son un sandbox de código hostil**. Los checks ejecutan código local y comparten dependencias instaladas. Usar tareas y repositorios de confianza. No se promete aislamiento de secretos de toda la cuenta ni contención de un candidato malicioso.

No hace push, PR, merge, despliegue ni aplica el patch a tu rama. Un éxito es una propuesta local con checks, review y QA; no una aprobación humana del producto. No relanzar automáticamente estados failed/exhausted ni borrar contadores. Una tarea revisada puede crear una nueva ejecución consciente, conservando la anterior.

## Para la clase

Muestra el mismo recorrido primero desde la conversación. La diferencia normal/Ralph se observa en los prompts, `progress.md` y el número de sesiones de implementación. La nube cambia el disparador y el entorno: estos comandos y artefactos pueden adaptarse a un runner, pero no se ha conectado este controlador a Actions.

[Spec concreta](examples/escape-search.json) · [Dos mejoras para Ralph](examples/search-keyboard-hint.json) · [Petición vaga](examples/spec-vaga.md). No atribuir una diferencia causal general a dos ejecuciones aisladas.

## Referencias verificadas · 20/09/2026

- [Claude Code programático](https://code.claude.com/docs/en/headless): CLI, herramientas y resultados estructurados.
- [Codex no interactivo](https://developers.openai.com/codex/noninteractive): CLI y salida estructurada.
- [Ralph](https://ghuntley.com/ralph/): técnica original; los límites y gates de esta implementación son decisiones nuestras.

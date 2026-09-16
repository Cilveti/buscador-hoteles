# Evidencia y estado de implantación

Última actualización: 16-09-2026. **Un recorrido completo ya pasó: issue #5 → corrección → checks → revisión independiente → Sonar → draft PR #6. La mejora del formato y de CI se valida en la PR #7. El segundo ensayo visual #8 pasó las pruebas, pero se detuvo por fallos del revisor y de recuperación. La revisión aislada corregida ya pasa; el caso de control #9 completó el recorrido actualizado al primer intento y publicó la draft PR #10, con todos los gates verdes.**

## Baseline local

- Aplicación congelada: `67e61d3a73b94dd8eeb2dadc7d6207d736cf0e5e`.
- Checkout desechable y tres contenedores nuevos, sin red durante ejecución de código.
- Unitarios, lint y tipos: pasan.
- E2E real de Next/Payload/PostgreSQL: 10 pasan, 21,2 segundos. Incluye búsqueda, filtros, móvil, detalle, autenticación y persistencia administrativa.
- Build: pasa tras corregir la ruta de Next para el monorepo Bun.
- Instalación: 32 segundos con caché fría; 25 con caché caliente. Ambas medidas son Docker local sobre macOS/ARM, no GitHub/Linux x64 ni un benchmark general.
- Primera baseline: PostgreSQL 16.15. Corrección posterior: imagen con PostgreSQL 17.11, igual que compose local, servidor y cliente fijados a `17.11-1.pgdg24.04+2`. Los 10 E2E pasan localmente en 20,5 s con esta versión; su baseline remota también pasa.

## GitHub

- Infraestructura inicial: commit `a1280ab`.
- [Primera baseline sin modelo](https://github.com/Cilveti/buscador-hoteles/actions/runs/35030226539): falló antes de los tests: Bun no podía escribir en el volumen Linux (`tempdir: EACCES`). Se corrige ejecutando la instalación con el UID/GID del propietario y caché explícita. No hubo consumo de modelos.
- [Baseline corregida](https://github.com/Cilveti/buscador-hoteles/actions/runs/35030817082), commit `8d5ff06`: **verde**, 64 tests / 302 aserciones, 10 E2E reales y build. Instalación fría 15 s; job total 308 s (6 minutos redondeados). Logs, trazas y reportes en el artefacto del run.
- [Baseline con caché](https://github.com/Cilveti/buscador-hoteles/actions/runs/35031262510), `509c349`: **verde**, 295 s totales. Instalación 8 s y restauración de caché ~10 s (243 MB). La primera instalación fría tardó 15 s; son dos observaciones, no un benchmark repetido ni una mejora neta de 7 s garantizada.
- [Baseline PostgreSQL 17.11](https://github.com/Cilveti/buscador-hoteles/actions/runs/35031693837), `2b1749d`: **verde**, 289 s totales. Misma versión de servidor que compose local.
- Etiquetas de configuración y rama `factory-state` creadas por el instalador.
- PR desde Actions habilitadas y `OPENCODE_API_KEY` configurada tras autorización explícita. Conexión OpenCode comprobada con el ensayo real #1. Sonar conectado tras autenticación de Iñigo: organización `cilveti`, proyecto privado `Cilveti_buscador-hoteles`, Free ($0), sin autoimport de otros repositorios. `SONAR_TOKEN` guardado en GitHub y `setup --check-ready` verde. Automatic Analysis desactivado para usar nuestro workflow de CI.
- Penpot: conexión MCP, lectura/escritura y exportación reales comprobadas. [Snapshot `hotel-empty-v1`](../../factory/designs/hotel-empty-v1/manifest.json), dos tableros y nueve tokens; PNG inspeccionados y SVG XML válido. [Reproducción](PENPOT.md).

- [Baseline de integridad del candidato](https://github.com/Cilveti/buscador-hoteles/actions/runs/35032213155), `d0721fd`: **verde**, 293 s totales.

## Resolución de dependencias

Prueba local real con Docker y registro npm: una copia desechable de los manifiestos añade `is-number@7.0.0`; el resolver conserva los manifiestos, ignora un postinstall que fallaría y mantiene estable el lock al repetir. No se ejecutó el modelo. La [baseline con resolver](https://github.com/Cilveti/buscador-hoteles/actions/runs/35032865550), commit `a2afa28`, terminó **verde**: resolver 11 s, job completo 313 s, con las comprobaciones de aplicación, navegador y build. No se ejecutó ningún modelo.

## Controles probados localmente

- Presupuesto máximo de tres intentos; no se reinicia por aprobación.
- Eventos duplicados, aprobación repetida o de actor no autorizado y respuesta tardía tras cancelar.
- Validación de parches Git reales: rutas protegidas, manifiestos y symlinks.
- Claves y URLs de diseño: rechazo de exportaciones alteradas y URLs que contienen credenciales.
- 15 tests del arnés / 51 aserciones verdes localmente. Incluyen comprobación externa del índice y rechazo de modificaciones o archivos inesperados tras verificar. Contratos TypeScript y YAML validados. Estas pruebas son deterministas, no ejecuciones de modelos.

## Pendiente para acreditar el objetivo

Completar una propuesta visual que consume Penpot y comparar/adoptar una mejora del arnés. Ya hay evidencia de Sonar, draft con gates verdes, corrección, pausa/aprobación/reanudación humana, recuperación, escalado y cancelación. El clone limpio y los runners nuevos prueban reproducción del código y checks; todavía no se ha realizado una instalación completa en otra cuenta.

## Primer ensayo con modelo y pausa · 16-09-2026

[Issue #1](https://github.com/Cilveti/buscador-hoteles/issues/1) → [run 35068794419](https://github.com/Cilveti/buscador-hoteles/actions/runs/35068794419): run verde y estado **waiting-human**, intento 1/3 con `opencode-go/glm-5.3-flash`. Sin cambios de código, sin verificación de candidato y sin PR, porque el modelo pidió permiso antes de editar dependencias.

El agente detectó además un error de la tarea de ensayo: situaba la biblioteca en el core, cuya regla externa prohíbe imports ajenos. Conceder permiso de dependencias no resuelve esa incompatibilidad. El operador automatizado canceló #1 mediante el comando de control; [run de cancelación 35069157210](https://github.com/Cilveti/buscador-hoteles/actions/runs/35069157210) verde. Esta cancelación ejercita el evento autenticado y estado remoto; **no se presenta como una decisión humana real**. El ensayo corregido usa el adaptador web en #2.

[Medición del primer run](evidence/hitl-request-35068794419.json): 194 s de runners sumados; 5 minutos redondeados (admisión 9 s, generación 139 s, cierre 46 s). La espera humana sucede tras finalizar los jobs y no mantiene un runner ocupado. Tokens y factura desconocidos. La clave del modelo no aparece en el log completo descargado y contrastado sin imprimir su valor.

## Clone limpio

Clone nuevo desde GitHub en `/tmp/hoteles-factory-replay-20260916`, commit `4cbef21`: `bun test factory` pasa 15 tests / 51 aserciones sin copiar cambios locales; `bun factory/setup.ts` confirma identidad, PR habilitadas y secreto de modelo. El checkout queda limpio. Esta prueba valida arranque/contratos; no demuestra todavía instalar las integraciones en otra cuenta ni completa el E2E de producto.

## Corrección de integración del diseño

[Baseline 35068777827](https://github.com/Cilveti/buscador-hoteles/actions/runs/35068777827), sobre `3b378d3`, detecta errores de lint en los SVG crudos de Penpot; E2E y build pasan. Se separan las referencias SVG del código mediante una configuración limitada a `factory/designs/`. No se cambia el SVG congelado ni su hash ni se excluye código de aplicación.

La revisión descubre además que la política admitía `apps/web/src/biome.json`: una configuración anidada podía desactivar lint. Corregido en la política externa y en los permisos de edición. Prueba con índices Git reales: Biome, tsconfig y ESLint anidados se rechazan en ambos perfiles, mientras los JSON de datos siguen admitidos. Suite local actual: **16 tests / 60 aserciones**, tipos y lint del arnés verdes.

El ensayo #2 recibió una aprobación real de Cilveti ([comentario 5693799876](https://github.com/Cilveti/buscador-hoteles/issues/2#issuecomment-5693799876)). El ledger registra `approved`, cambio a `full` y reserva del intento 2 en [run 35069605703](https://github.com/Cilveti/buscador-hoteles/actions/runs/35069605703). La cancelación del operador automatizado, solicitada por el fallo de la base SVG, coincidió con esa reanudación y se aplicó ocho segundos después; [run 35069620366](https://github.com/Cilveti/buscador-hoteles/actions/runs/35069620366) verde. La pausa/aprobación/reanudación del protocolo está comprobada; **la implementación con permisos completos no terminó**. No reescribir esa base ni reiniciar sus dos intentos reservados. La nueva tarea #5 conserva el alcance de dependencia ya autorizado y parte de una baseline corregida, con un historial separado y visible.

[Propuesta de mejora generada desde el historial real #1](https://github.com/Cilveti/buscador-hoteles/issues/4): permanece como propuesta sin ejecución automática; comparación con casos congelados y aprobación humana aún pendientes.

## Baseline corregida confirmada

[Run 35069669688](https://github.com/Cilveti/buscador-hoteles/actions/runs/35069669688), commit `c874b6f`: **verde**. Contratos del arnés, resolución aislada de dependencias, lint/tipos/unitarios, E2E reales y build completados. Incluye la referencia Penpot y la protección frente a configuración anidada. [Medición](evidence/baseline-35069669688.json). Las tareas #3 y #5 siguen preparadas sin `factory:ready`, esperando la conexión Sonar.

## Primer análisis Sonar

[Run 35070892755](https://github.com/Cilveti/buscador-hoteles/actions/runs/35070892755), commit `dc78c78`: conexión y carga de análisis correctas, 57 archivos de fuente analizados. El scanner termina en fallo porque el gate inicial es **Not computed**, confirmado en la pantalla Summary; no es un rechazo por una condición de calidad evaluada. Sonar indica que el segundo análisis calculará el gate. Se repite sobre el mismo código, sin modificar reglas/umbrales. [Medición](evidence/sonar-main-35070892755.json). El panel muestra 0% de cobertura porque no se ha importado LCOV, no porque se haya medido una suite sin cobertura.

[Segundo análisis main 35071072059](https://github.com/Cilveti/buscador-hoteles/actions/runs/35071072059), mismo commit `dc78c78`: **verde**, incluido quality gate Sonar way. Ninguna regla/umbral cambiado. [Medición](evidence/sonar-main-35071072059.json). Ensayos #3 (`35071200573`) y #5 (`35071205468`) activados después de este verde.

## Primer recorrido completo con dependencia y corrección

[Issue #5](https://github.com/Cilveti/buscador-hoteles/issues/5) → [intento1 35071205468](https://github.com/Cilveti/buscador-hoteles/actions/runs/35071205468) → [intento2 35071794022](https://github.com/Cilveti/buscador-hoteles/actions/runs/35071794022) → **[draft PR #6](https://github.com/Cilveti/buscador-hoteles/pull/6)**.

El primer intento falló en el test de `Montaña & Mar`: produjo `montana-y-mar`, se esperaba `montana-and-mar`. E2E y build pasaron; el controlador devolvió el fallo concreto y el parche al segundo intento con el mismo modelo flash. En el segundo se corrige la implementación manteniendo el ejemplo exigido y sus tests.

Resultado final: 69 unitarios, 10 E2E reales, build, revisor independiente `opencode-go/glm-5.3` sin hallazgos y quality gate Sonar **verdes**. La app y la base de datos se levantaron en CI. El revisor inspeccionó el código y la evidencia; no ejecutó otra app ni sustituye la revisión humana.

Commit publicado `3c3b60273710a89e1585cf91ffe3de3369ff05da`, padre exacto `dc78c7887e4b6f2f052a4d2b84872a5bbc4c7d8d`. SHA256 del diff completo `90a640ef09d6e1a5ee1a3c8c537c1ec5b19ed644a65aa2fde3cd096575689b63`: coinciden artefacto original, informe del revisor y diff obtenido de GitHub. Cuatro rutas: manifiesto web, módulo, test y lock. PR en draft y sin merge; `Factory / acceptance`, `Factory / quality` y `SonarCloud Code Analysis` en verde. El operador trasladó el informe automatizado a la descripción para hacerlo visible y actualizó el aviso Sonar; esa edición no es una aprobación humana.

Mediciones: [intento1](evidence/full-retry-35071205468.json), [intento2](evidence/full-success-35071794022.json).

## Ensayo visual, recuperación y límite real

#3 intento1 `35071200573`: consume el snapshot congelado y propone un cambio en el componente. E2E/build pasan, pero Biome exige `section` en lugar de `div role=region`. El controlador inicia automáticamente el segundo intento `35071825830`; falla porque la respuesta final no es JSON. El operador solicita recuperación autenticada mediante `/factory retry 35071825830`; no se presenta como una decisión humana del producto.

Tercer intento `35072051343` ejecuta realmente `opencode-go/glm-5.3` y también falla al parsear la respuesta. Tres intentos consumidos, sin publicación; no se reinicia el ledger ni se atribuye éxito visual al mero escalado. Esto justifica investigar salida estructurada mediante JSON Schema. No se conserva el texto completo de las respuestas de esos runners y no se inventa su contenido.

Mediciones: [intento1](evidence/visual-retry-35071200573.json), [intento2](evidence/visual-format-failure-35071825830.json), [tercer modelo](evidence/visual-escalation-35072051343.json).

En el primer intento full, el guardado de caché del candidato fue rechazado por falta de scope de escritura. La restauración y la instalación son mecanismos separados: no afirmar que los reintentos ya reutilizan un lockfile nuevo desde caché. La corrección de permisos de caché no debe ampliar la autoridad del código no confiable.


## CI automática y nuevo ensayo visual

La [PR #7](https://github.com/Cilveti/buscador-hoteles/pull/7) incorpora CI por PR y main, Sonar, respuestas estructuradas y publicación de resúmenes legibles. [CI 35132462005](https://github.com/Cilveti/buscador-hoteles/actions/runs/35132462005), revisión244db9b, pasó contratos, checks de aplicación, navegador, build y Sonar. Consultar sus checks para el resultado de revisiones posteriores.

[Issue #8](https://github.com/Cilveti/buscador-hoteles/issues/8) es un ensayo nuevo autorizado al pedir continuar hasta dejarlo funcionando; conserva intacto el presupuesto agotado de #3. Primer run35132573912: implementador con schema correcto; 12 pruebas de navegador (incluidas Penpot1280/360) y build pasan. Biome rechaza el formato de un test generado; el controlador devuelve patch y fallo al segundo intento35133563930. Las capturas reales de ambos tamaños se inspeccionaron. La rama de infraestructura es la base congelada del ensayo: su eventual PR depende de #7. Los enlaces de la issue conservan el resultado final, sin inferirlo del verde del controlador.

La API de protección de ramas y rulesets devuelve403 solicitando Pro para este repo privado. No hay protección obligatoria de merge acreditada ni despliegue de producción. [Operación de CI](CI.md).


## Corrección y validación del revisor

El segundo intento visual [35133563930](https://github.com/Cilveti/buscador-hoteles/actions/runs/35133563930) pasó 67 tests / 313 aserciones, 12 E2E reales y build, con patch `a3d47bba725621297cd37b6a211c5014b017323e23a815d0bf76661089fe422c` sobre base `244db9b292ec80dda227274660dc000a1ba5f0f9`. La revisión síncrona falló por timeout (~363 s). El intento 3 falló antes de inferencia al descargar un informe inexistente: el output anunciaba un artefacto que nunca se subió. #8 conserva sus tres intentos y estado fallido; no tiene PR.

Se corrigió la emisión de outputs de artefactos, el transporte a `prompt_async` y el contexto del revisor, que recibe ahora diff y lista de archivos. La revisión aislada con GLM 5.3 siguió agotando tiempo; un ensayo local mostró repetición de lecturas sobre el mismo conjunto de archivos. Se detuvo ese proceso y se añadió un corte al observar más de 80 llamadas a herramientas, además del deadline de diez minutos. El revisor por defecto usa GLM 5.3 Flash en sesión separada. El escalado del tercer implementador conserva GLM 5.3.

[Diagnóstico en GitHub 35143114004](https://github.com/Cilveti/buscador-hoteles/actions/runs/35143114004), infraestructura `baacb463ed86303a4c706e6bb2bd394b09247e5c`: **verde**. Vuelve a revisar el patch exacto anterior y sus checks, sin generar otro cambio, publicar ni modificar el ledger de #8. Veredicto estructurado `pass`, sin hallazgos; job completo 143 s (3 minutos redondeados). [Medición](evidence/review-replay-35143114004.json). Esto acredita esa ejecución; no demuestra que Flash sea universalmente mejor que otro modelo revisando.

El caso de control [#9](https://github.com/Cilveti/buscador-hoteles/issues/9) repite explícitamente el caso previamente exitoso #5 sobre la infraestructura nueva. Es una comprobación de integración, no una continuación de los ensayos visuales ni una autorización de fusionar otra copia de la funcionalidad.


## Recorrido completo del controlador actualizado

[Issue #9](https://github.com/Cilveti/buscador-hoteles/issues/9) → [run 35143166482](https://github.com/Cilveti/buscador-hoteles/actions/runs/35143166482) → [draft PR #10](https://github.com/Cilveti/buscador-hoteles/pull/10): **todas las fases verdes al primer intento**. 68 tests / 307 aserciones, 10 E2E sin fallos ni reintentos, lint/tipos, build, revisor separado y Sonar. Ledger final `review`, 1/3 intentos. Generación, verificación y publicación se realizaron en jobs separados.

Base y ejecutor: `baacb463ed86303a4c706e6bb2bd394b09247e5c`. Commit publicado: `965f0847be0baca84c0be05de4479197688c3bc4`, hijo directo de esa base. Patch SHA256 `9b0f3b05fcd41593d55ffa85d577c096f499b911eef877c18e0d7bc416a8d47b`: coinciden propuesta, checks, review y diff Git obtenido del commit remoto. Cuatro rutas autorizadas: manifiesto web, módulo, test y lockfile. `Factory / acceptance` y `Factory / quality` verdes. La PR sigue en draft, sin merge ni despliegue; se identificó como caso de control dependiente de #7, no como funcionalidad adicional que fusionar.

La descripción se generó automáticamente con resumen, comprobaciones, informe plegado y hashes en detalles. Sonar cambió automáticamente su sección de pendiente a superado. Se observó ese cambio antes de añadir una nota del operador identificando el ensayo. El log completo del run se contrastó con la clave conocida del modelo sin imprimirla; no aparece expuesta. [Medición del recorrido](evidence/control-success-35143166482.json).

La [CI de PR #7 sobre la misma revisión](https://github.com/Cilveti/buscador-hoteles/actions/runs/35143119194) también pasó: 32 tests del arnés / 115 aserciones, 64 tests de aplicación / 302 aserciones, 10 E2E, build y Sonar. El job de aplicación duró 334 s y Sonar 58 s; [medición](evidence/ci-pr-35143119194.json). Tiempos observados, no promesa de duración ni factura. La mejora se activa para eventos normales cuando #7 se incorpore a main; ensayarla en su rama no equivale a integrarla.


La PR #10 generó además [CI de PR 35143952369](https://github.com/Cilveti/buscador-hoteles/actions/runs/35143952369) en `action_required`, sin jobs: es el comportamiento actual de las PR creadas con GITHUB_TOKEN, no un fallo de los checks previos. Tras verificar base, diff, review y ausencia de cambios fuera de alcance, el operador automatizado aprobó esa ejecución adicional por la API de GitHub. No se presenta como aprobación humana del producto ni modifica la protección del repositorio. Su resultado se consulta en el enlace; la documentación antigua que decía que no se creaba ningún run se corrigió con la documentación oficial vigente.

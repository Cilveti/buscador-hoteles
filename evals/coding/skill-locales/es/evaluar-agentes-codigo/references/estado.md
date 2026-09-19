# Estado de implementación — 2026-09-15

El laboratorio se ha trasladado del proyecto anterior a `buscador-hoteles` por petición de Iñigo. Se ha detenido el localhost anterior; la evidencia original permanece en su repositorio de origen. Este proyecto conserva catálogo ficticio y producto determinista.

Implementado: runner y UI desktop, especificación/proceso editables, skills disponibles/iniciales, vistas de columnas, selección de baseline, aceptación privada, juez informado, idioma general y excepciones por skill. Inglés y castellano incluyen las referencias de las skills; los snapshots conservan el contenido elegido. La UI sigue en castellano. El prompt propio conserva su texto literal.

La migración cambia baseline, namespace de paquetes y directrices del proyecto. Las runs históricas son contexto, no un control español idéntico. Campaña solicitada: dos candidatos Luna high, skills españolas salvo testing en inglés. No lanzar candidatos adicionales silenciosamente.

Validación y resultados se registran en artefactos locales bajo `.agent-evals/`. Pendientes: control español sobre el mismo baseline si se solicita, UI de rejuicios, cancelación, diseño Penpot completo, comparativas limpio/legacy, alcance y compactaciones, autonomía con evidencia y propuestas automáticas de mejora.

## Campaña terminada y siguiente paso

Campaña `2026-09-15T21-26-42.054Z-081bc520`: dos runs concurrentes Luna high, castellano salvo testing en inglés; ambas leen esa skill. Ambas pasan aceptación privada; la run 001 falla lint/tipos y conserva una expectativa circular de URL, la run 002 pasa los checks externos y añade expectativas independientes. Esto no es una comparación causal del idioma entre repositorios. No se ejecutó mutation testing.

Consultar `.agent-evals/experiments/testing-language-en/report.md` para evidencias y limitaciones. Esa campaña detectó fallos realpath de Node bajo aislamiento; la evidencia original conserva su carácter histórico. Consultar la corrección siguiente antes de otra campaña. La retirada del script de tests y el formato del verificador generado se corrigieron después de congelar la campaña. Pasan seis pruebas de UI y doce validaciones de skills localizadas. La UI del puerto 3415 pertenece ahora a este repositorio. Estas notas no autorizan candidatos adicionales.

## Reparación del entorno — 2026-09-16

El usuario autorizó explícitamente diagnósticos breves con el SDK de Codex. Tres procesos Luna high comprobaron todos los checks, solo tipos/arquitectura y ningún check. Los verify habilitados pasan; el comando ausente en el perfil vacío falla como se esperaba; todas las lecturas del canario privado son denegadas. El perfil completo también supera navegador. Evidencia: `.agent-evals/environment-validation/report-20260916.md`.

Los candidatos se ejecutan fuera de los padres privados del controlador, con copia propia de dependencias y Git independiente. El checkout original se restaura después. Cada check habilitado se ejecuta bajo el sandbox candidato antes de arrancar el modelo; un fallo bloquea la llamada. El preflight debe ser asíncrono y capturar stdio por pipes para mantener operativo el navegador y evitar descriptores a archivos privados. Los tests del controlador quedan fuera de la suite de producto candidata. Pasan las 32 combinaciones, tests enfocados y verify del repositorio. Usar `eval:coding:validate` para diagnósticos deterministas; `--models` añade explícitamente llamadas al SDK. Esto no autoriza una campaña nueva de comparación de idiomas.


## Estabilización nocturna — 16 septiembre2026

La autorización vigente y la continuación exacta están en `.agents/bitacoras/evaluador-noche-2026-09-16.md`. Iñigo autorizó múltiples tareas y variantes con Luna high hasta08:00 y juez Sol 5.6 high. El límite anterior de dos runs no restringe esta petición nocturna explícita.

Los tests del candidato se separan entre Bun, Playwright del producto, Playwright del evaluador y aceptación pública configurada. `--reverify-candidate-tests RUN` repite tests de una entrega congelada: la UI aplica sólo correcciones vinculadas por hash, conserva originales y no relanza modelos. Nuevos juicios puntúan seis dimensiones0–10 y una media ponderada transparente; estado de ejecución y aceptación siguen separados. Juicios históricos0–2 conservan escala. process-summary.json reduce lectura repetida; se conservan eventos completos.

Las dependencias aisladas adaptan Chromium launch para conectar al navegador reservado por run desde Node/Bun; el controlador configura el proceso. Su prueba de salud precede a los checks incluso con todos desactivados. Tras la entrega se descartan copias de dependencias y se recuperan enlaces externos, conservando código/evidencia. Las bitácoras de orquestación no se suministran al candidato.

## Correcciones de restauración — noche del16de septiembre

Conservar los metadatos de producto de los manifiestos entregados (exports/imports/type y demás campos); restaurar únicamente las tablas de scripts de referencia. Mantener manifiestos nuevos y no reparar silenciosamente JSON inválido o manifiestos de producto eliminados. Las suites de referencia incluyen sus auxiliares bajo tests/, mientras la verificación de tests candidatos conserva sus auxiliares. La política de arquitectura es un archivo de referencia. El aprovisionamiento rechaza retirar archivos sin cobertura de restauración.

Validar el recorrido completo sin modelos: desactivar todos los checks, capturar el producto intacto, restaurar la verificación de referencia y ejecutar sus gates. El16de septiembre reprodujo la pérdida de auxiliares de arquitectura antes del arreglo y pasó los cuatro gates después. El preflight del SDK por sí solo no prueba la restauración posterior.

`--reverify-delivery RUN` repite checks y un juicio Sol high sobre una entrega congelada. Conserva la evidencia original; acumula cronológicamente las correcciones vinculadas por hash, incluso una posterior que sólo repita tests candidatos. Distinguir cambios de protocolo y cambios de contexto candidato en la procedencia experimental.


### Acceso local y aislamiento (2026-09-16)

Toda lectura y escritura de la API exige la credencial del controlador, guardada con modo 0600 en `.agent-evals/ui/access.json`. El enlace inicial `http://127.0.0.1:3415/#access=<token>` elimina el fragmento y guarda la credencial para ese origen, incluido el puerto. Las peticiones API la envían explícitamente mediante Authorization; no se aceptan cookies, porque las cookies de localhost también llegan a otros puertos locales. La versión 2 rota la antigua credencial de cookie. Se mantiene la comprobación CSRF de escrituras. No copiar la credencial al candidato.

El preflight verifica privados e historial denegados, API anónima 403 (o apagada), Node/Bun y Chrome reservado. Chrome usa su propio perfil de macOS: conserva las capacidades normales del navegador pero no puede leer ni escribir raíces del controlador o privadas. Cada arranque prueba un archivo privado real por `file://`; evidencia en `.agent-evals/browser-isolation/`. Así se cierra el acceso directo que permitía el Chrome externo sin restricciones. Por defecto se usa Chrome de macOS; `EVAL_BROWSER_EXECUTABLE` permite un ejecutable compatible explícito. Si el aislamiento no funciona, no se lanza el candidato. No es certificación contra código hostil o vulnerabilidades del sistema/navegador.


## Cierre nocturno — 16 de septiembre de 2026

La noche autorizada produjo 46 entregas Luna high evaluadas en cuatro tareas, con juez Sol 5.6 high: 29 pass, 17 fail y 1 intento de infraestructura detenido antes del modelo. Las tres entregas finales pasan tras reparar un timeout de 5 segundos de la sonda privada de Chrome. La sonda espera commit hasta 30 segundos y reintenta sólo un TimeoutError; archivo legible, error inesperado o segundo timeout siguen bloqueando. Pasan cuatro arranques simultáneos y la verificación completa. Conservar intento fallido y diferencias de protocolo/concurrencia al comparar.

Una tanda completa de cuatro candidatos pasó todos los checks privados/generales/propios, con aproximadamente 3,98 GiB de picoRSS sumado en esta máquina de 24 GiB. Es muestreo que incluye páginas compartidas, no RAM física exclusiva ni garantía universal de concurrencia.

La instrucción de testing ampliada no mostró una mejora clara. Los textos originales inglés/castellano siguen por defecto; se conservan variantes experimentales y snapshots privados. Entregar instrucciones inicialmente no demuestra cumplirlas. Bugs de estado, recarga y capacidad de búsquedas guardadas se reprodujeron independientemente con tests generales/propios verdes. Dossiers privados versionados `dossier-night-v2` listos para futuras recetas de saved-searches, advanced-filters y review-order; juicios actuales conservan sus dossiers originales congelados.

Informe y procedencia: `.agent-evals/night-summary-20260916/informe.md`, `runs.json`, `runs.csv`. Son privados del controlador: no copiarlos al contexto candidato. No lanzar nuevas campañas autónomas tras el plazo. Prioridades futuras: aceptación privada reutilizable de transiciones de estado, comparaciones con tareas reservadas y después legacy/clean y compactaciones.

## Documentación pública y recogida de regresiones privadas — 16 septiembre 2026

El entorno candidato permite explícitamente documentación oficial pública y búsqueda web live de Codex; los jueces mantienen la búsqueda desactivada y usan el paquete de evidencia. Diagnósticos nativos de red/Chrome en `.agent-evals/documentation-access-20260916/`. Disponibilidad no demuestra uso histórico.

Los jueces devuelven propuestas acotadas de tests ejecutables con requisitos públicos y evidencia. El controlador las recoge fuera de Git en el almacenamiento privado por tarea, conservando procedencia de especificación/patch, sin ejecutar ni promover código generado. Los juicios históricos siguen siendo legibles. El orquestador valida y versiona la suite de aceptación; la promoción aún no es automática. Las campañas nuevas congelan la rúbrica vigente del controlador independientemente del baseline de código candidato.

Se validó una suite privada de tres casos contra una entrega positiva y otra negativa congeladas, usando el verificador externo real. La receta actual de búsquedas guardadas la selecciona. Casos exactos, hashes, evidencias, receta anterior y límites en el informe privado del controlador `.agent-evals/private-suite-validation-saved-v1-final/informe.md`. Sin nuevas llamadas a modelos ni cambios de notas históricas. La verificación general pasó; los tests de recogida simulan la salida del juez, no ejecutan un juez nuevo.

## Retención sólo de resultados — 16 septiembre 2026

El usuario exige eliminar los worktrees desechables tras evaluar. `retention.ts` limpia runs/campañas terminadas en bloques finally y conserva resultados finales inmutables, correcciones, inputs/prompts exactos, patches y métricas; elimina worktrees registrados, eventos brutos duplicados, paquetes temporales del juez e informes pesados de navegador. Rechaza estados activos y rutas fuera del almacén. `--clean-finished` aplica la política al histórico. Las runs compactadas no pueden reutilizar evidencia descartada para rejuicios/reverificaciones; se informa antes de llamar al modelo. Refs Git conservan revisiones sin copias materializadas del proyecto.

Limpiadas las26campañas terminadas y siete worktrees de diagnóstico inactivos.117hashes de resultados/juicios intactos; almacenamiento aprox.3,7GiB→164MiB. Evidencia exacta en `.agent-evals/storage-cleanup-20260916/`. Suites privadas y propuestas permanecen separadas. La decisión explícita de retención prevalece sobre notas anteriores que exigían conservar evidencia bruta de campañas.

Auditoría de compactaciones:52resultados candidatos parciales,1sin dato,0marcadores observados; ningún recuento exacto. El CLI instalado0.154.0-alpha.6.2 no es la versión estable validada por el analizador. No informar cero ni afirmar medición de impacto. Se conservan resúmenes; los rollouts eliminados no pueden reanalizarse retroactivamente. Pendiente: validar el contrato real del CLI y una prueba de compactación forzada.

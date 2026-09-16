# CI y revisión de propuestas

## Qué ocurre al abrir o actualizar una PR

`CI · aplicación y fábrica` ejecuta contratos del controlador, resolución aislada de dependencias, lint, tipos, tests, aplicación real con PostgreSQL y Playwright, y build. El resumen de Actions distingue comprobaciones superadas, fallidas y no completadas. Los artefactos conservan logs, capturas y trazas siete días.

Las PR del mismo repositorio ejecutan también Sonar después de los checks. Las PR de forks no reciben el secreto Sonar. Hay CI en los pushes a main y ejecución manual para diagnosticar una revisión concreta.

Al crear una PR con `GITHUB_TOKEN`, GitHub genera las ejecuciones `pull_request` en estado **aprobación requerida**. Un usuario con escritura puede pulsar **Approve workflows to run** en la PR. Es el comportamiento vigente desde junio de 2026 ([documentación oficial](https://docs.github.com/en/actions/concepts/security/github_token), [anuncio](https://github.blog/changelog/2026-06-11-bot-created-pull-requests-can-run-workflows-if-approved/)). No hace falta introducir otro token para ese paso.

La fábrica verifica el patch antes de publicarlo, ejecuta Sonar y registra `Factory / acceptance` y `Factory / quality` sobre el commit exacto. Después de aprobar la CI adicional, esta comprueba también el resultado de combinar la PR con main y genera los checks normales. Una aprobación del workflow autoriza esa ejecución; no es una aprobación del código ni un merge. No deducir aceptación de que exista una PR o de que un run que gestiona reintentos esté verde.

## Leer una propuesta del agente

1. **Qué cambia:** resumen del implementador, identificado como tal.
2. **Qué se ha comprobado:** resultados de los jobs, no afirmaciones del modelo.
3. **Informe del revisor automático:** observaciones independientes sobre código y evidencia.
4. **Calidad de código:** sección que Sonar actualiza al terminar. Si falla, queda bloqueada; no conserva un «pendiente» obsoleto.
5. **Qué necesita una persona:** revisión del comportamiento y decisión de integrar. Los hashes y archivos están en un desplegable.

El publicador comprueba que resumen y revisión pertenecen a la misma base y patch. La prosa del modelo no puede cambiar el quality gate ni introducir el marcador con el que se actualiza la sección. Al actualizarla se conservan las notas añadidas por una persona.

## Verificación de Penpot

Las tareas cuyo diseño congelado es `hotel-empty-v1` activan dos pruebas adicionales del navegador: 1280 px y 360 px. Comprueban región accesible, título, ayuda, colores/borde/radio relevantes, icono decorativo, ausencia de scroll horizontal y recuperación de resultados. Los tests están en `factory/checks/browser/`, fuera del snapshot editable del modelo.

Las capturas `empty-state-1280.png` y `empty-state-360.png` quedan dentro de la evidencia E2E. Inspeccionarlas antes de afirmar fidelidad visual completa: comprobar algunas propiedades y comportamientos no equivale a comparar todos los píxeles.

## Probar cambios del controlador

Un operador configurado puede ejecutar `factory.yml` manualmente, indicando una issue nueva y una rama del arnés previamente revisada. Esto permite validar una mejora antes de incorporarla a main. Debe existir exactamente un perfil de permisos y el autor debe estar autorizado. Se congelan especificación, base y diseño; los reintentos conservan la rama de ejecución y siguen limitados a tres.

Durante ese ensayo, mantener estable la revisión del ejecutor. Una recuperación explícita puede registrar un `workerSha` nuevo para corregir el transporte: conserva `baseSha`, diseño, especificación, parche y contador. El ejecutor se carga en un checkout separado solo en los jobs del modelo; las comprobaciones y la publicación siguen usando la base de aplicación congelada. No es una actualización silenciosa de requisitos ni un reinicio de intentos. La PR de producto partirá de esa base y dependerá de sus cambios hasta integrar el arnés. Identificar explícitamente esa dependencia en la PR; no atribuir al agente los cambios de infraestructura ni fusionar la propuesta mezclada por accidente.

## Permisos y límites reales

- El candidato se ejecuta en contenedores sin red y sin claves del modelo. El job de modelo, el verificador y el publicador son distintos.
- El permiso completo no permite añadir, quitar, mover de sección ni cambiar la versión declarada de herramientas conocidas de verificación (TypeScript, Biome, Playwright y las demás protegidas en policy.ts). Sus actualizaciones se revisan como cambios del arnés. Esto no sustituye la revisión de la cadena de dependencias.
- El verificador restaura la caché pero no intenta guardarla. `bun install --frozen-lockfile --ignore-scripts` sigue siendo obligatorio; caché no sustituye el lockfile.
- Sonar es un análisis adicional, no una ejecución de la aplicación. No hay importación LCOV todavía.
- El 16-09-2026, la API de GitHub devolvió 403 al consultar protección de main y rulesets, indicando que este repositorio privado requiere GitHub Pro para esa función. No se compró un plan ni se hizo público el repositorio.
- Por tanto, los workflows dejan la propuesta en borrador y no hacen merge, pero un usuario con escritura puede saltarse el proceso. Si se habilita un plan compatible, exigir CI, Sonar y revisión humana sin bypass antes de presentar la protección como obligatoria.
- No se ha configurado despliegue de producción ni una URL de preview. La aplicación usada por CI es temporal. El build verde es evidencia para decidir una entrega, no un despliegue realizado.

## Reproducir en otra cuenta

Seguir [INSTALL.md](INSTALL.md): adaptar repositorio, operadores y proyecto Sonar; configurar secretos con autorización; habilitar PR desde Actions; ejecutar setup y baseline; probar una issue. No copiar claves a Markdown ni convertir este repositorio privado en público para evitar configurar permisos.


## Recuperar un fallo de transporte

Si el modelo o su transporte falla antes de publicar, un operador puede ejecutar `factory.yml` desde la revisión corregida, con `issue` y `recover_run` (ID del run fallido). Se verifica que ha terminado y que no ha publicado rama; la recuperación queda auditada y consume el siguiente intento disponible. No puede usarse después de agotar los tres intentos.

El worker usa `prompt_async` de OpenCode 1.18.30 y consulta brevemente el último mensaje, con un único límite de diez minutos para la inferencia. El job tiene doce minutos para incluir instalación y cierre. Esto evita sostener una llamada HTTP síncrona larga, que falló por timeout a los seis minutos en la revisión de #8.

La versión fijada tiene además un fallo al serializar el formato JSON Schema de ciertos mensajes de usuario. Consultar solo el último mensaje evita recuperar esos mensajes anteriores; si el primer mensaje todavía es ese mensaje de usuario, se tolera exclusivamente el error de codificación identificado hasta que llegue el del asistente. Otros errores HTTP fallan. Se esperan mensajes completados: un turno de herramientas intermedio no equivale a un veredicto. La salida final sigue validándose contra el contrato y el presupuesto no se amplía.


## Diagnosticar solo el revisor

En `CI · aplicación y fábrica`, usar la ejecución manual con `review_run` para indicar un run terminado de la fábrica cuyo patch haya pasado la verificación independiente. Esta opción vuelve a revisar ese snapshot y guarda el veredicto; no genera código, no publica una PR ni cambia el ledger. Solo pueden ejecutarla los operadores configurados. Comprueba identidad de base, especificación y hash del patch antes de llamar al modelo. Consume una llamada de revisión y respeta el límite de tiempo del worker.

La incidencia real de #8 mostró que un nombre estático de artefacto podía apuntar a un informe nunca creado después de un timeout. Los outputs de la fábrica ahora solo anuncian artefactos cuando el paso que los publica ha terminado correctamente. El intento 3 de #8 falló al recuperar aquel informe inexistente, antes de llamar al modelo; su contador y su estado fallido se conservan. Los diagnósticos del revisor son pruebas del arnés, no una continuación oculta de esa tarea.

El revisor recibe también `context/review/patch.diff` y la lista de archivos modificados, ambos construidos por el controlador a partir del patch verificado. Empieza por los cambios y consulta su contexto inmediato; no tiene que reconstruir el diff ni revisar toda la aplicación.

### Presupuesto del revisor

El revisor usa una sesión independiente de GLM 5.3 Flash. En el ensayo visual, GLM 5.3 repitió lecturas de los mismos archivos hasta agotar el tiempo; no se adoptó esa configuración como revisor por defecto. Flash cerró la revisión estructurada del mismo patch verificado. Esto prueba que el recorrido funciona en ese caso, no que un modelo sea universalmente mejor revisando.

Además de diez minutos, el controlador corta una sesión si observa más de 80 llamadas a herramientas. El diagnóstico guarda estados y contadores, nunca argumentos, código devuelto por herramientas ni razonamiento del modelo. El tercer intento de implementación conserva GLM 5.3 y el mismo corte: escalar no amplía los permisos ni garantiza el éxito.

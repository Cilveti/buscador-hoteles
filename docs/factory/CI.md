# CI y revisión de propuestas

## Qué ocurre al abrir o actualizar una PR

`CI · aplicación y fábrica` ejecuta contratos del controlador, resolución aislada de dependencias, lint, tipos, tests, aplicación real con PostgreSQL y Playwright, y build. El resumen de Actions distingue comprobaciones superadas, fallidas y no completadas. Los artefactos conservan logs, capturas y trazas siete días.

Las PR del mismo repositorio ejecutan también Sonar después de los checks. Las PR de forks no reciben el secreto Sonar. Hay CI en los pushes a main y ejecución manual para diagnosticar una revisión concreta.

La PR creada por `GITHUB_TOKEN` no dispara por sí sola otro workflow. Por eso la fábrica ya verifica su patch antes de publicarlo, analiza Sonar después y registra `Factory / acceptance` y `Factory / quality` en el commit exacto. Una actualización posterior por una persona dispara la CI normal. No deducir aceptación de que exista una PR o de que un run que gestiona reintentos esté verde.

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

Durante ese ensayo, mantener estable la rama del arnés. La PR de producto partirá de esa base y dependerá de sus cambios hasta integrar el arnés. Identificar explícitamente esa dependencia en la PR; no atribuir al agente los cambios de infraestructura ni fusionar la propuesta mezclada por accidente.

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

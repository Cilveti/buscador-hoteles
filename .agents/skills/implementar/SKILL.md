---
name: implementar
description: Implementa una tarea ya especificada del buscador y verifica el cambio antes de entregarlo. Usar en la fase de implementación del workflow o al ejecutar un plan resuelto; no inicia entrevistas ni otros workflows.
---

# Implementar y comprobar

Recibe la especificación, el plan y, si existe, el feedback del intento anterior. Inspecciona el estado actual antes de editar: puede haber trabajo aprovechable. Sigue [testing](../hoteles-testing/SKILL.md) y [arquitectura](../hoteles-hexagonal/SKILL.md). Implementa únicamente la tarea asignada; en Ralph, una subtarea por sesión.

## Comprueba antes de entregar

En este workflow, comprueba mediante tests automáticos, incluidos los de Playwright. No hagas además una exploración manual paso a paso del navegador: esa revisión corresponde al QA posterior. El bucle del implementador es código → ejecución de tests → corrección de fallos.

- Ejecuta `bun run lint` y `bun run typecheck` sobre el estado final. `biome format` solo formatea: **no sustituye a `biome check`**, que también revisa imports. Para corregirlo, usa `bunx --no-install biome check --write <archivos-modificados>` sin extender cambios a otros archivos.
- Ejecuta los tests afectados: `bun test <archivo-o-directorio>`. Para recorrer todo el producto y su arquitectura, `bun run test:app`. Selecciona por comportamiento/riesgo, no por una cuota de tests.
- Si cambias interacción, navegación o estado visible, compruébalo con Playwright: `bun run test:browser <archivo.spec.ts>` o `bun run test:browser --grep '<caso>'`. Añade un caso mantenible cuando falte cobertura útil. El runner levanta y cierra la app sintética; no necesita PostgreSQL. Usa `TEST_BROWSER_PORT`, `TEST_BROWSER_OUTPUT` y `TEST_BROWSER_WS_ENDPOINT` proporcionados por el controlador, sin reemplazarlos ni reutilizar servidores de otra sesión. El controlador abre y cierra Chrome; los scripts propios deben usar `chromium.connect(process.env.TEST_BROWSER_WS_ENDPOINT)`. Fuera del workflow, sin endpoint proporcionado, el runner puede abrir su navegador local.
- Si no hay una selección enfocada evidente, `bun run verify:app` reúne lint, tipos, producto/arquitectura y navegador. No añadas la suite del laboratorio a cada iteración de producto. Cambios del arnés/configuración necesitan `bun run verify`; persistencia/administración, el E2E con base exclusiva.
- Corrige fallos y vuelve a comprobar lo afectado tras el último cambio. No debilites checks ni repitas una comprobación que siga cubriendo exactamente el mismo estado.

El workflow permite fuentes/tests colocados del producto y nuevos `tests/browser/*.spec.ts`; no permite cambiar suites de navegador existentes, scripts, skills, configuración ni dependencias. Una necesidad fuera de ese alcance debe declararse como bloqueo.

## Entrega

Incluye en el resultado los comandos ejecutados, su resultado y lo que no has podido comprobar. Un error al arrancar el navegador deja esa comprobación pendiente; no demuestra que la UI funcione. No declares la tarea verificada si faltan comprobaciones necesarias. La verificación externa, la revisión y el QA son posteriores e independientes de tus propias comprobaciones.

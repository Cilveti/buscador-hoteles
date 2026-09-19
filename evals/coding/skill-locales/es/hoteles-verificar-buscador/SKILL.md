---
name: hoteles-verificar-buscador
description: Levantar y comprobar el buscador convencional del worktree actual con Playwright, catálogo sintético y artefactos locales. Usar para verificar cambios de UI, filtros, navegación y recuperación; no valida Payload, PostgreSQL, SSR ni el buscador agéntico.
---

# Comprobar el buscador que acabas de modificar

El harness `evals/coding/browser/` carga **los componentes React, handlers HTTP y core del worktree actual**. Sustituye únicamente la carga del catálogo por tres hoteles sintéticos y `next/link` por enlaces HTML. No sirve el snapshot docente, ni usa el servidor habitual, bases de datos, proveedores de IA o imágenes remotas. No acredita integración de Next/Payload, SSR ni persistencia real.

Trabaja desde la raíz del worktree. Respeta `EVAL_PROJECT_ROOT`, `EVAL_BROWSER_PORT`, `EVAL_BROWSER_OUTPUT` y `EVAL_BROWSER_WS_ENDPOINT` si los proporciona el runner; así cada intento usa su propio código, puerto y artefactos. Sin variables, el puerto es 3413 y la salida `.agent-evals/browser`. No cambies al checkout principal ni utilices el puerto habitual 3100. No leas `.env.local` para este entorno.

## Suite reproducible

```sh
node node_modules/@playwright/test/cli.js test --config evals/coding/browser/playwright.config.ts
```

Este comando compila la UI actual, arranca el servidor aislado, ejecuta la suite del navegador y lo detiene. Genera `results.json`, informe HTML en `report/`, capturas y trazas en `test-results/` dentro de la salida configurada. Si existe `EVAL_BROWSER_WS_ENDPOINT`, Playwright reutiliza automáticamente el navegador efímero que el controlador ha creado para este intento; conserva esa variable. En las evaluaciones, chromium.launch() también conecta a ese navegador mediante el adaptador suministrado; ambas entradas están soportadas. El arnés configura el proceso del navegador; usa browser.newContext() para las opciones del contexto. Esto permite probar desde el sandbox de Codex en macOS y limita procesos en campañas paralelas. El controlador cierra ese navegador al terminar el candidato, también ante un fallo o timeout. Sin endpoint, usa Chrome instalado; `EVAL_BROWSER_CHANNEL` permite otro canal instalado. Si falta el navegador, informa del bloqueo: no instales ni descargues herramientas como efecto lateral.

La suite base protege búsqueda, filtros existentes, ordenación, paginación, vuelta desde detalle, estado vacío y recuperación HTTP. **Añade o ejecuta escenarios que prueben tu funcionalidad concreta**: pasar estos recorridos no demuestra un filtro nuevo, una búsqueda guardada u otra interacción recién añadida. Usa roles/nombres accesibles y expectativas del requisito; no sustituyas las respuestas de tu funcionalidad por mocks que ya devuelvan el resultado esperado.

La aceptación de la tarea se ejecuta fuera del candidato al entregar. Comprueba los requisitos visibles con tus propias pruebas; no busques la suite privada.

## Exploración y evidencia de tu implementación

```sh
bun evals/coding/browser/server.ts
```

Con ese proceso activo, abre la URL que imprime usando un script local con `@playwright/test`. Si el runner proporciona un endpoint, conecta a ese navegador y crea un contexto para tu exploración:

```ts
import { chromium } from '@playwright/test';

const endpoint = process.env.EVAL_BROWSER_WS_ENDPOINT;
const browser = endpoint
  ? await chromium.connect(endpoint)
  : await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext();
try {
  const page = await context.newPage();
  // Navega a la URL local del servidor y comprueba el recorrido del requisito.
} finally {
  await context.close();
  await browser.close(); // En una conexión remota, desconecta este cliente.
}
```

El endpoint usa loopback y un puerto aleatorio; no lo publiques, conectes al Chrome personal ni lo reutilices entre intentos. El navegador corre fuera del sandbox con los permisos del controlador, no representa un aislamiento de código hostil. Recorre los criterios de aceptación, incluyendo errores pertinentes. Guarda screenshots con `page.screenshot({ path, fullPage: true })`; para una exploración programática, activa `context.tracing.start({ screenshots: true, snapshots: true })` y guarda `context.tracing.stop({ path })` en la carpeta de artefactos del intento.

El bundle se construye al arrancar: **reinicia tu servidor después de editar** antes de verificar de nuevo. Detén únicamente el proceso que has creado. No ejecutes la suite sobre el mismo puerto mientras tu servidor manual sigue activo: la configuración no reutiliza servidores preexistentes.

Si usas un script propio, impide peticiones fuera del origen local como hace `catalog.spec.ts`. El caso de 503 de la suite sustituye deliberadamente una respuesta HTTP para verificar recuperación; los recorridos normales llegan al handler y al core reales.

Al terminar, ejecuta también `bun run verify` si está disponible en el proyecto: el navegador complementa tipos, lint y tests. Informa de los comandos, exit codes y recorridos realmente verificados; enlaza evidencias y distingue un fallo del código de un bloqueo del entorno. Si corriges después de comprobar, vuelve a verificar el estado final.

Consulta .agents/ENVIRONMENT.md cuando exista para conocer herramientas y checks suministrados; la ausencia de suites predefinidas puede ser intencional.

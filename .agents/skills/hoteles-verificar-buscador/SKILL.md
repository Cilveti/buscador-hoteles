---
name: hoteles-verificar-buscador
description: Start and check conventional search in the current worktree using Playwright, a synthetic catalog and local artifacts. Use to verify UI changes, filters, navigation and recovery; does not validate Payload, PostgreSQL, SSR or agentic search.
---

# Check the search application you just modified

The `evals/coding/browser/` harness loads **the React components, HTTP handlers and core of the current worktree**. It replaces only catalog loading with three synthetic hotels and `next/link` with HTML links. It does not serve a teaching snapshot or use the usual server, databases, AI providers or remote images. It does not establish Next/Payload integration, SSR or real persistence.

Work from the worktree root. Respect `EVAL_PROJECT_ROOT`, `EVAL_BROWSER_PORT`, `EVAL_BROWSER_OUTPUT` and `EVAL_BROWSER_WS_ENDPOINT` when supplied by the runner; each attempt then uses its own code, port and artifacts. Without variables, the port is 3413 and output is `.agent-evals/browser`. Do not switch to the main checkout or use the usual port 3100. Do not read `.env.local` for this environment.

## Reproducible suite

```sh
node node_modules/@playwright/test/cli.js test --config evals/coding/browser/playwright.config.ts
```

This command compiles the current UI, starts the isolated server, runs the browser suite and stops it. It generates `results.json`, an HTML report in `report/`, screenshots and traces in `test-results/` inside the configured output directory. If `EVAL_BROWSER_WS_ENDPOINT` exists, Playwright automatically reuses the ephemeral browser the controller created for this attempt; preserve that variable. In evaluation runs, standard chromium.launch() also connects to this browser through the supplied adapter; both entrypoints are supported. Launch-process options are controlled by the harness; use browser.newContext() for context settings. This allows testing from the Codex sandbox on macOS and limits processes in parallel campaigns. The controller closes that browser when the candidate finishes, including on failure or timeout. Without an endpoint, it uses installed Chrome; `EVAL_BROWSER_CHANNEL` allows another installed channel. If the browser is missing, report the blocker: do not install or download tools as a side effect.

The base suite protects search, existing filters, sorting, pagination, returning from details, empty state and HTTP recovery. **Add or run scenarios that test your specific functionality**: passing these journeys does not prove a new filter, saved search or other newly added interaction. Use accessible roles/names and requirement-derived expectations; do not replace your functionality's responses with mocks that already return the expected result.

Task acceptance runs outside the candidate after delivery. Check visible requirements with your own tests; do not look for the private suite.

## Explore and gather evidence of your implementation

```sh
bun evals/coding/browser/server.ts
```

With that process running, open the URL it prints using a local script with `@playwright/test`. If the runner supplies an endpoint, connect to that browser and create a context for your exploration:

```ts
import { chromium } from '@playwright/test';

const endpoint = process.env.EVAL_BROWSER_WS_ENDPOINT;
const browser = endpoint
  ? await chromium.connect(endpoint)
  : await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext();
try {
  const page = await context.newPage();
  // Navigate to the local server URL and check the requirement's journey.
} finally {
  await context.close();
  await browser.close(); // With a remote connection, disconnect this client.
}
```

The endpoint uses loopback and a random port; do not publish it, connect to personal Chrome or reuse it between attempts. The browser runs outside the sandbox with controller permissions; it does not isolate hostile code. Walk through acceptance criteria, including relevant errors. Save screenshots with `page.screenshot({ path, fullPage: true })`; for programmatic exploration, enable `context.tracing.start({ screenshots: true, snapshots: true })` and save `context.tracing.stop({ path })` in the attempt's artifacts folder.

The bundle is built at startup: **restart your server after editing** before verifying again. Stop only the process you created. Do not run the suite on the same port while your manual server is still active: the configuration does not reuse existing servers.

Read .agents/ENVIRONMENT.md when present for the supplied tools and checks; missing predefined suites can be intentional.

If you use a custom script, prevent requests outside the local origin as `catalog.spec.ts` does. The suite's 503 case deliberately replaces an HTTP response to verify recovery; normal journeys reach the real handler and core.

Before finishing, also run `bun run verify` if available in the project: browser checks complement types, lint and tests. Report commands, exit codes and journeys actually verified; link evidence and distinguish code failures from environment blockers. If you make corrections after checking, verify the final state again.

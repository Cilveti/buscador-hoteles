import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

/** Mechanical capability inventory, supplied in every treatment including the no-skills one. */
export function provisionEnvironmentGuide(root: string) {
  const pkg = z
    .object({ scripts: z.record(z.string(), z.string()).default({}) })
    .parse(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')));
  const scripts = Object.keys(pkg.scripts).filter((name) =>
    /^(verify|test|lint|typecheck|check:architecture)(:|$)/.test(name),
  );
  const guide = `# Supplied environment\n\nThe following verification commands are supplied for this run:\n${scripts.length ? scripts.map((name) => `- bun run ${name}`).join('\n') : '- No predefined verification commands.'}\n\nAvailability here takes precedence over generic instructions that mention other checks. Missing predefined suites are an intentional configuration, not a broken environment. You may write and execute your own relevant checks with installed tools. Task acceptance is external; its files are not provided and should not be searched for.\n\nPublic documentation is available over the network. Codex candidates have live web search enabled; you may also read official documentation with HTTP tools. Check the documentation and installed types/source when an API contract is uncertain. Browser localStorage is the real Web Storage API; application adapters have their own contracts, which you must inspect in the project. Public documentation access does not authorize sending project code, credentials or private evaluation data to external services.\n\nNode, Bun and Playwright are installed. Each run receives its own Chrome browser. Standard chromium.launch() is adapted to connect to it; chromium.connect(process.env.EVAL_BROWSER_WS_ENDPOINT) also works. The controller owns launch-process options; use browser.newContext for viewport and browser-context options. Closing a client does not end the shared browser. Do not install browsers or connect to personal Chrome.\n\nFor UI exploration use bun evals/coding/browser/server.ts and its printed URL. Respect EVAL_BROWSER_PORT and EVAL_BROWSER_OUTPUT; restart only your server after editing. The isolated fixture uses your current code with synthetic hotels and needs no database or product credentials.\n`;
  mkdirSync(join(root, '.agents'), { recursive: true });
  writeFileSync(join(root, '.agents/ENVIRONMENT.md'), guide);
  const path = join(root, 'AGENTS.md');
  const source = existsSync(path) ? readFileSync(path, 'utf8') : '';
  writeFileSync(
    path,
    `${source.split('## Laboratorio de arneses')[0]?.trim() ?? ''}\n\n## Supplied evaluation environment\n\nRead .agents/ENVIRONMENT.md for the actual tools and checks provided for this run. Its availability rules override generic verification commands mentioned above.\n`,
  );
  return guide;
}

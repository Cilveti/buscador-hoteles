import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isAbsolute, join, relative } from 'node:path';

const marker = '// hoteles evaluation browser bridge v1';

/** Adapt the isolated dependency copy, leaving the controller and user's Chrome untouched. */
export function provisionBrowserBridge(root: string) {
  const require = createRequire(join(root, 'package.json'));
  const fromTest = createRequire(require.resolve('@playwright/test'));
  const core = realpathSync(fromTest.resolve('playwright-core'));
  const path = relative(realpathSync(join(root, 'node_modules')), core);
  if (path.startsWith('..') || isAbsolute(path))
    throw new Error('Browser bridge requires an isolated dependency copy');
  const source = readFileSync(core, 'utf8');
  if (source.includes(marker)) return;
  // All supported Node/Bun and CJS/ESM entrypoints share this public Chromium object.
  writeFileSync(
    core,
    `${source}\n${marker}
if (process.env.EVAL_BROWSER_WS_ENDPOINT) {
  const chromium = module.exports.chromium;
  chromium.launch = async (options = {}) => chromium.connect({
    wsEndpoint: process.env.EVAL_BROWSER_WS_ENDPOINT,
    timeout: options.timeout,
    slowMo: options.slowMo,
  });
}
`,
  );
}

export const browserHealthScript = `
(async () => {
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<button>Environment ready</button>');
    if (await page.getByRole('button', { name: 'Environment ready' }).count() !== 1)
      throw new Error('Browser probe did not render');
    console.log('BROWSER_READY');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
`;

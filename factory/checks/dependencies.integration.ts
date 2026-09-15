import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { resolveDependencies } from '../dependencies';
import { object } from '../github';

// Real Docker/registry check, run explicitly. Never changes the application's working manifests.
const candidate = mkdtempSync(join(tmpdir(), 'factory-dependency-check-'));
try {
  for (const path of [
    'package.json',
    'apps/web/package.json',
    'packages/core/package.json',
    'packages/contracts/package.json',
    'packages/adapters/package.json',
  ]) {
    mkdirSync(dirname(join(candidate, path)), { recursive: true });
    writeFileSync(join(candidate, path), execFileSync('git', ['show', `HEAD:${path}`]));
  }
  const previous = execFileSync('git', ['show', 'HEAD:bun.lock']);
  const root = object(JSON.parse(readFileSync(join(candidate, 'package.json'), 'utf8')));
  root.scripts = { ...object(root.scripts), postinstall: 'exit 42' };
  writeFileSync(join(candidate, 'package.json'), JSON.stringify(root));
  const path = join(candidate, 'apps/web/package.json');
  const web = object(JSON.parse(readFileSync(path, 'utf8')));
  const dependencies = object(web.dependencies);
  // Keep this fixture useful if the application later adopts the example dependency itself.
  delete dependencies['is-number'];
  writeFileSync(path, JSON.stringify(web));
  resolveDependencies(candidate, previous);
  const baseline = readFileSync(join(candidate, 'bun.lock'));
  web.dependencies = { ...dependencies, 'is-number': '7.0.0' };
  const manifest = JSON.stringify(web);
  writeFileSync(path, manifest);
  writeFileSync(join(candidate, '.env.local'), 'TEST_ONLY_NOT_A_SECRET=fixture');
  resolveDependencies(candidate, baseline);
  const resolved = readFileSync(join(candidate, 'bun.lock'));
  assert(!resolved.equals(baseline));
  assert(resolved.toString().includes('"is-number": "7.0.0"'));
  assert.equal(readFileSync(path, 'utf8'), manifest);
  assert(!existsSync(join(candidate, 'node_modules')));
  resolveDependencies(candidate, resolved);
  assert(
    readFileSync(join(candidate, 'bun.lock')).equals(resolved),
    'Resolved lock must be stable',
  );
  console.log(
    'Passed: registry dependency resolved, scripts ignored, manifests preserved, stable lock, no installed application dependencies. No model was called.',
  );
} finally {
  rmSync(candidate, { recursive: true, force: true });
}

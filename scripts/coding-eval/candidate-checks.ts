import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { type CandidateCheck, candidateCheckIds } from './config';
import { git, isReference } from './workspace';

export const candidateScriptGroup = (name: string, command: string): CandidateCheck | null => {
  if (/architecture/.test(name + command) && !/^test$/.test(name)) return 'architecture';
  if (/acceptance/.test(name + command) || /evals\/coding\/tasks\//.test(command))
    return 'acceptance';
  if (/eval-browser|e2e|playwright/.test(name + command)) return 'browser';
  if (/^(?:test|check:architecture)(?::|$)/.test(name) || /\bbun test\b/.test(command))
    return 'tests';
  if (/^(?:lint|format)(?::|$)/.test(name) || /\bbiome\b/.test(command)) return 'lint';
  if (/typecheck/.test(name) || /\btsc\b/.test(command)) return 'typecheck';
  return null;
};

function fileGroup(path: string): CandidateCheck | null {
  if (path.startsWith('tests/architecture/')) return 'architecture';
  if (path.startsWith('evals/coding/tasks/') && !/\.(?:md|json|png|svg|jpg)$/.test(path))
    return 'acceptance';
  if (
    path.startsWith('tests/e2e/') ||
    (path.startsWith('tests/browser/') && path.endsWith('.spec.ts')) ||
    (path.startsWith('evals/coding/browser/') && path.endsWith('.spec.ts')) ||
    path.endsWith('.browser.spec.ts')
  )
    return 'browser';
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path)) return 'tests';
  if (/(?:^|\/)biome\.jsonc?$/.test(path)) return 'lint';
  return null;
}

const controllerTest = (path: string) =>
  /^(?:scripts\/(?:coding-eval(?:-ui)?|verification)\/|evals\/coding\/ui\/)/.test(path) &&
  /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path);

function filterPackageScripts(worktree: string, path: string, enabled: Set<CandidateCheck>) {
  const packagePath = join(worktree, path);
  if (!existsSync(packagePath)) return [];
  const pkg = z
    .object({ scripts: z.record(z.string(), z.string()).optional() })
    .passthrough()
    .parse(JSON.parse(readFileSync(packagePath, 'utf8')));
  if (!pkg.scripts) return [];
  // The candidate validates the product, not the controller's own isolation tests.
  if (pkg.scripts.test)
    pkg.scripts.test = pkg.scripts.test
      .replace(
        /(?:^|\s)(?:\.\/)?scripts\/(?:coding-eval-ui|coding-eval|verification)(?=\s|$)/g,
        ' ',
      )
      .replace(/\s+/g, ' ')
      .trim();
  const removed: string[] = [];
  const restricted = enabled.size < candidateCheckIds.length;
  for (const [name, command] of Object.entries(pkg.scripts)) {
    const category = candidateScriptGroup(name, command);
    if (
      name === 'test:e2e' ||
      (category && !enabled.has(category)) ||
      (restricted && /(?:scripts\/verification\/verify\.ts|eval:coding)/.test(name + command))
    ) {
      delete pkg.scripts[name];
      removed.push(`${path}:${name}`);
    }
  }
  if (!enabled.has('architecture') && pkg.scripts.test)
    pkg.scripts.test = pkg.scripts.test
      .replace(/(?:^|\s)(?:\.\/)?tests\/architecture(?:\/[^\s]*)?(?=\s|$)/g, ' ')
      .trim();
  if (restricted && path === 'package.json') {
    const checks = ['lint', 'typecheck', 'test', 'check:architecture', 'test:eval-browser'].filter(
      (name) => pkg.scripts?.[name],
    );
    if (checks.length) pkg.scripts.verify = checks.map((name) => `bun run ${name}`).join(' && ');
    else delete pkg.scripts.verify;
  }
  writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
  return removed;
}

/** Availability controls supplied scripts and suites; installed tools and Git history are not sandboxed. */
export function provisionCandidateChecks(worktree: string, selection: CandidateCheck[] | null) {
  const enabled = new Set(selection ?? candidateCheckIds);
  const removedFiles: string[] = [];
  const removedScripts: string[] = [];
  const files = git(worktree, ['ls-files', '-z']).split('\0').filter(Boolean);
  for (const path of files) {
    const category = fileGroup(path);
    if (
      path.startsWith('tests/e2e/') ||
      controllerTest(path) ||
      (category && !enabled.has(category))
    ) {
      rmSync(join(worktree, path), { force: true });
      removedFiles.push(path);
    }
    if (/(?:^|\/)package\.json$/.test(path))
      removedScripts.push(...filterPackageScripts(worktree, path, enabled));
  }
  const unrestorable = removedFiles.filter((path) => !isReference(path));
  if (unrestorable.length)
    throw new Error(
      `Availability removed files outside reference restoration: ${unrestorable.join(', ')}`,
    );
  // Keep exported types/functions used by the app's typecheck, but restrict the direct CLI too.
  const verifier = join(worktree, 'scripts/verification/verify.ts');
  if (enabled.size < candidateCheckIds.length && existsSync(verifier)) {
    const content = readFileSync(verifier, 'utf8');
    const checkList = `[${[...enabled].map((id) => `'${id}'`).join(', ')}]`;
    writeFileSync(
      verifier,
      content.replace(
        'return checks;',
        `const enabledChecks = new Set<string>(${checkList});\n  return checks.filter((check) => enabledChecks.has(check.id));`,
      ),
    );
  }
  return {
    enabled: [...enabled],
    removedFiles,
    removedScripts,
    restrictedVerifier: enabled.size < candidateCheckIds.length,
    unsupported: ['database-backed e2e; no product credentials or database in this fixture'],
    isolation:
      'Supplied files and scripts only; installed tools and Git history remain accessible. External verification always uses the original baseline.',
  };
}

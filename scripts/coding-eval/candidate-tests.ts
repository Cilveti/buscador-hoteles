import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type CheckDefinition, runVerification } from '../verification/verify';
import type { EvalTask } from './config';
import { createWorktree, linkDependencies, restoreReferences } from './workspace';

/** Use the frozen project's runners, never pass Playwright files to Bun's test runner. */
export function candidateTestChecks(root: string, changed: string[], task: EvalTask) {
  const unit: string[] = [];
  let browser = false;
  let evalBrowser = false;
  let acceptance = false;
  for (const path of changed) {
    if (!/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path) || !existsSync(join(root, path))) continue;
    if (path.startsWith('tests/e2e/') || path.startsWith('scripts/teaching/'))
      throw new Error(`Candidate test needs an explicitly configured isolated runner: ${path}`);
    if (path.startsWith('tests/browser/')) browser = true;
    else if (path.startsWith('evals/coding/browser/') && path.endsWith('.spec.ts'))
      evalBrowser = true;
    else if (
      path.startsWith(`evals/coding/tasks/${task.id}/`) &&
      path.endsWith('.browser.spec.ts')
    ) {
      if (!task.acceptanceCommand) throw new Error(`No public acceptance runner for ${path}`);
      acceptance = true;
    } else {
      if (/@playwright\/test/.test(readFileSync(join(root, path), 'utf8')))
        throw new Error(`Unknown Playwright test location; configure its runner: ${path}`);
      unit.push(path);
    }
  }
  const checks: CheckDefinition[] = [];
  if (unit.length)
    checks.push({ id: 'candidate-tests', command: ['bun', 'test', ...unit.map((p) => `./${p}`)] });
  if (browser)
    checks.push({ id: 'candidate-product-browser-tests', command: ['bun', 'run', 'test:browser'] });
  if (evalBrowser)
    checks.push({ id: 'candidate-browser-tests', command: ['bun', 'run', 'test:eval-browser'] });
  const [executable, ...args] = task.acceptanceCommand ?? [];
  if (acceptance && executable)
    checks.push({ id: 'candidate-acceptance-tests', command: [executable, ...args] });
  return checks;
}

export async function verifyCandidateTests(options: {
  project: string;
  output: string;
  baseline: string;
  delivered: string;
  candidateRoot: string;
  changed: string[];
  task: EvalTask;
  timeoutSeconds: number;
  port: number;
  verify?: typeof runVerification;
}) {
  const checks = candidateTestChecks(options.candidateRoot, options.changed, options.task);
  if (!checks.length) return null;
  const root = join(options.output, 'candidate-tests-worktree');
  createWorktree(options.project, root, options.delivered);
  restoreReferences(options.project, root, options.baseline, options.delivered, true);
  linkDependencies(options.project, root);
  const output = join(options.output, 'candidate-tests');
  return (options.verify ?? runVerification)({
    root,
    output,
    checks,
    timeoutSeconds: options.timeoutSeconds,
    env: {
      EVAL_BROWSER_PORT: String(options.port),
      TEST_BROWSER_PORT: String(options.port),
      EVAL_BROWSER_OUTPUT: join(output, 'browser'),
      TEST_BROWSER_OUTPUT: join(output, 'browser'),
      EVAL_PROJECT_ROOT: root,
    },
  });
}

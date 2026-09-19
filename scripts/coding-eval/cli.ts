import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { HELP, interactiveConfig, listTasks, parseConfig } from './config';
import { rejudgeRun } from './rejudge';
import { compactEvaluation } from './retention';
import { reverifyCandidateTests } from './reverify';
import { reverifyDelivery } from './reverify-delivery';
import { runCampaign } from './runner';

async function main() {
  const project = resolve(import.meta.dir, '../..');
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--clean-finished') {
    const root = resolve(project, '.agent-evals');
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const path = resolve(root, entry.name);
      if (!entry.isDirectory() || !existsSync(resolve(path, 'manifest.json'))) continue;
      try {
        const cleaned = compactEvaluation(project, path);
        console.log(
          `${entry.name}: ${cleaned.removed.length} removed; ${cleaned.errors.length} errors`,
        );
        if (cleaned.errors.length) process.exitCode = 2;
      } catch (error) {
        console.log(`${entry.name}: skipped (${String(error)})`);
      }
    }
    return;
  }
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    return;
  }
  if (args.includes('--reverify-delivery')) {
    const { values } = parseArgs({
      args,
      options: { 'reverify-delivery': { type: 'string' } },
      strict: true,
    });
    if (!values['reverify-delivery']) throw new Error('Missing run directory');
    console.log(
      `Delivery correction: ${await reverifyDelivery(project, values['reverify-delivery'])}`,
    );
    return;
  }
  if (args.includes('--reverify-candidate-tests')) {
    const { values } = parseArgs({
      args,
      options: { 'reverify-candidate-tests': { type: 'string' } },
      strict: true,
    });
    if (!values['reverify-candidate-tests']) throw new Error('Missing run directory');
    console.log(
      `Verification correction: ${await reverifyCandidateTests(project, values['reverify-candidate-tests'])}`,
    );
    return;
  }
  if (args.includes('--rejudge-run')) {
    const { values } = parseArgs({
      args,
      options: {
        'rejudge-run': { type: 'string' },
        'judge-dossier': { type: 'string' },
      },
      strict: true,
      allowPositionals: false,
    });
    if (!values['rejudge-run'] || !values['judge-dossier'])
      throw new Error('Rejudge requires --rejudge-run and --judge-dossier.');
    const output = await rejudgeRun(project, values['rejudge-run'], values['judge-dossier']);
    console.log(`Rejudgment: ${output}`);
    const result = z
      .object({ status: z.string() })
      .parse(JSON.parse(readFileSync(resolve(output, 'result.json'), 'utf8')));
    if (result.status !== 'evaluated') process.exitCode = 2;
    return;
  }
  if (args.includes('--list')) {
    for (const task of listTasks(project))
      console.log(`${task.id}\t${task.title}\n  ${task.description}`);
    return;
  }
  if (!args.length && !process.stdin.isTTY) {
    console.log(HELP);
    return;
  }
  const config = args.length ? parseConfig(args) : await interactiveConfig(project);
  if (!config) return;
  const campaign = await runCampaign(project, config);
  console.log(`Results: ${campaign}`);
  const manifest = z
    .object({ status: z.string() })
    .parse(JSON.parse(readFileSync(resolve(campaign, 'manifest.json'), 'utf8')));
  if (manifest.status === 'incomplete' || manifest.status === 'baseline_failed')
    process.exitCode = 2;
}

if (import.meta.main)
  main().catch((error: unknown) => {
    console.error(String(error));
    process.exitCode = 1;
  });

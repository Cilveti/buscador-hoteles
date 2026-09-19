import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { type judgmentSchema, regressionTestSchema } from './judge';
import { saveJson } from './workspace';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const deliverySchema = z.object({ deliveredCommit: z.string().min(1) });

function writeOnce(path: string, content: string) {
  try {
    writeFileSync(path, content, { flag: 'wx' });
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
  }
}

/** Store generated code privately as proposals. Never execute or promote unvalidated judge output. */
export function collectRegressionTests(
  input: {
    taskId: string;
    output: string;
    packet: string;
    judgment: z.infer<typeof judgmentSchema>;
  },
  privateRoot = join(homedir(), '.local/share/hoteles-harness-evals/private'),
) {
  const taskId = z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .parse(input.taskId);
  const { output, packet, judgment } = input;
  if (judgment.regressionTests.length === 0) return [];
  const specificationHash = hash(readFileSync(join(packet, 'TASK.md'), 'utf8'));
  const deliveryPath = join(output, 'delivery.json');
  const deliveredCommit = existsSync(deliveryPath)
    ? deliverySchema.parse(JSON.parse(readFileSync(deliveryPath, 'utf8'))).deliveredCommit
    : null;
  const patchPath = join(packet, 'candidate.patch');
  const deliveredPatchSha256 = existsSync(patchPath) ? hash(readFileSync(patchPath, 'utf8')) : null;
  return judgment.regressionTests.map((rawProposal) => {
    const proposal = regressionTestSchema.parse(rawProposal);
    const finding = judgment.findings[proposal.findingIndex];
    if (!finding) throw new Error(`Regression references missing finding ${proposal.findingIndex}`);
    const id = hash(JSON.stringify({ taskId, specificationHash, proposal }));
    const folder = join(privateRoot, taskId, 'regressions', id);
    mkdirSync(join(folder, 'observations'), { recursive: true });
    // Exclusive creation preserves validation/promotion state when the same proposal recurs.
    writeOnce(join(folder, proposal.filename), proposal.source);
    writeOnce(
      join(folder, 'proposal.json'),
      JSON.stringify(
        {
          id,
          taskId,
          specificationHash,
          ...proposal,
          status: 'pending-validation',
          createdAt: new Date().toISOString(),
          validationRequired: [
            'fails-on-buggy-delivery',
            'passes-on-correct-reference',
            'matches-public-requirement',
          ],
        },
        null,
        2,
      ),
    );
    saveJson(join(folder, 'observations', `${hash(output)}.json`), {
      sourceRun: output,
      deliveredCommit,
      deliveredPatchSha256,
      finding,
      collectedAt: new Date().toISOString(),
    });
    return { id, folder, filename: proposal.filename };
  });
}

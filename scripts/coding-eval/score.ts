import { z } from 'zod';

export const scoreWeights = {
  functionality: 35,
  codeQuality: 20,
  testQuality: 20,
  projectGuidelines: 10,
  verificationProcess: 10,
  reportAccuracy: 5,
} as const;

/** Quality is a weighted rubric summary, not a probability or an acceptance gate. */
export function qualityScore(value: unknown, scale: number = 2) {
  const judgment = z.record(z.string(), z.unknown()).safeParse(value).data;
  if (!judgment || ![2, 10].includes(scale)) return null;
  let total = 0;
  for (const [key, weight] of Object.entries(scoreWeights)) {
    const criterion = z.object({ score: z.number().min(0).max(scale) }).safeParse(judgment[key]);
    if (!criterion.success) return null;
    total += (criterion.data.score / scale) * weight;
  }
  return Math.round(total) / 10;
}

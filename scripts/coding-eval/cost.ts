import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const rate = z.number().finite().nonnegative();
const priceSchema = z.object({
  inputPerMillion: rate,
  cachedInputPerMillion: rate,
  cacheWritePerMillion: rate,
  outputPerMillion: rate,
  longContextThresholdTokens: z.number().int().positive().nullable(),
  source: z.object({
    kind: z.enum(['official', 'user']),
    url: z.string().min(1),
    verifiedOn: z.iso.date(),
  }),
});
export const pricingSchema = z.object({
  schemaVersion: z.literal(1),
  currency: z.literal('USD'),
  models: z.record(z.string(), priceSchema),
});
export type Pricing = z.infer<typeof pricingSchema>;

/** Read once from the controller's versioned table, then freeze it in campaign/pricing.json. */
export function loadPricing(project: string): Pricing {
  const path = join(project, 'evals/coding/pricing.json');
  return pricingSchema.parse(
    existsSync(path)
      ? JSON.parse(readFileSync(path, 'utf8'))
      : { schemaVersion: 1, currency: 'USD', models: {} },
  );
}

const count = z.number().int().nonnegative().safe();
const usageSchema = z
  .object({
    input_tokens: count,
    cached_input_tokens: count,
    cache_write_input_tokens: count.default(0),
    output_tokens: count,
    reasoning_output_tokens: count.optional(),
  })
  .refine(
    (usage) =>
      usage.cached_input_tokens + usage.cache_write_input_tokens <= usage.input_tokens &&
      (usage.reasoning_output_tokens ?? 0) <= usage.output_tokens,
  );

type ExecutionUsage = { harness: string; model: string; usage: Record<string, number> | null };
type UnavailableReason =
  | 'unsupported_harness'
  | 'unknown_model'
  | 'missing_usage'
  | 'invalid_usage';
const component = (tokens: number, ratePerMillion: number) => ({
  tokens,
  ratePerMillion,
  costUsd: (tokens * ratePerMillion) / 1_000_000,
});

/** API-equivalent Standard estimate, not a subscription charge or an actual invoice. */
export function estimateCodexCost(execution: ExecutionUsage, pricing: Pricing) {
  const rates = pricing.models[execution.model] ?? null;
  const parsed = usageSchema.safeParse(execution.usage);
  const reason: UnavailableReason | null =
    execution.harness !== 'codex'
      ? 'unsupported_harness'
      : !rates
        ? 'unknown_model'
        : execution.usage === null
          ? 'missing_usage'
          : !parsed.success
            ? 'invalid_usage'
            : null;
  const assumptions = [
    'Standard API-equivalent text token rates, not actual Codex subscription billing',
    'input_tokens includes cache reads and writes; output_tokens includes reasoning',
  ];
  if (rates?.longContextThresholdTokens)
    assumptions.push(
      'standard rates; long-context surcharge not applied without per-request usage',
    );
  if (execution.usage && execution.usage.cache_write_input_tokens === undefined)
    assumptions.push('cache_write_input_tokens absent; treated as zero as in the Codex SDK');
  const base = {
    schemaVersion: 1,
    model: execution.model,
    currency: pricing.currency,
    pricingSchemaVersion: pricing.schemaVersion,
    calculatedAt: new Date().toISOString(),
    basis: 'standard-api-equivalent',
    rates,
    source: rates?.source ?? null,
    usage: execution.usage,
    reason,
    assumptions,
    limitations: [
      'Only usage emitted by the execution is priced; failed turns without usage, hidden retries or subagents may be missing.',
      'Turn totals aggregate multiple model requests; their sum cannot determine a per-request context surcharge.',
      'No tool fees, Fast/Priority surcharges, Batch/Flex discounts, taxes or subscription allocation are included.',
      'The requested model selects the tariff; the CLI does not independently attest model routing or service tier.',
    ],
  };
  if (reason !== null || !rates || !parsed.success)
    return { ...base, estimatedApiCostUsd: null, breakdown: null };
  const usage = parsed.data;
  const breakdown = {
    uncachedInput: component(
      usage.input_tokens - usage.cached_input_tokens - usage.cache_write_input_tokens,
      rates.inputPerMillion,
    ),
    cacheRead: component(usage.cached_input_tokens, rates.cachedInputPerMillion),
    cacheWrite: component(usage.cache_write_input_tokens, rates.cacheWritePerMillion),
    output: component(usage.output_tokens, rates.outputPerMillion),
  };
  return {
    ...base,
    estimatedApiCostUsd: Object.values(breakdown).reduce((sum, item) => sum + item.costUsd, 0),
    breakdown,
  };
}
export type CostEstimate = ReturnType<typeof estimateCodexCost>;

/** Missing executions/prices never become zero in the combined result. */
export function summarizeCosts(candidate: CostEstimate | null, judge: CostEstimate | null) {
  const known = [candidate?.estimatedApiCostUsd, judge?.estimatedApiCostUsd].filter(
    (cost): cost is number => cost !== undefined && cost !== null,
  );
  const knownSubtotalUsd = known.reduce((sum, cost) => sum + cost, 0);
  return {
    schemaVersion: 1,
    currency: 'USD',
    candidate,
    judge,
    estimatedApiCostUsd: known.length === 2 ? knownSubtotalUsd : null,
    knownSubtotalUsd: known.length ? knownSubtotalUsd : null,
    complete: known.length === 2,
    scope:
      'Only the candidate and judge executions recorded here; previous attempts/retries are not included.',
  };
}

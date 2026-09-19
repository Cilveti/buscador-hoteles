import { describe, expect, test } from 'bun:test';
import { estimateCodexCost, loadPricing, summarizeCosts } from './cost';

const pricing = loadPricing(process.cwd());
const usage = {
  input_tokens: 1_000_000,
  cached_input_tokens: 600_000,
  cache_write_input_tokens: 100_000,
  output_tokens: 100_000,
  reasoning_output_tokens: 80_000,
};
const estimate = (model = 'gpt-5.6-luna', tokens: Record<string, number> | null = usage) =>
  estimateCodexCost({ harness: 'codex', model, usage: tokens }, pricing);

describe('API equivalent token costs', () => {
  test('partitions input into uncached, cache reads and writes; reasoning is already output', () => {
    const result = estimate();
    // 300k × .20 + 600k × .02 + 100k × .25 + 100k × 1.20, per million.
    expect(result.estimatedApiCostUsd).toBeCloseTo(0.217, 10);
    expect(result.breakdown?.uncachedInput.tokens).toBe(300_000);
    expect(result.breakdown?.cacheWrite.costUsd).toBeCloseTo(0.025, 10);
    expect(result.breakdown?.output.tokens).toBe(100_000);
    expect(result.usage?.reasoning_output_tokens).toBe(80_000);
  });

  test('totals across many requests do not trigger a long-context surcharge', () => {
    const result = estimate('gpt-5.6-luna', {
      input_tokens: 5_955_820,
      cached_input_tokens: 5_766_912,
      cache_write_input_tokens: 0,
      output_tokens: 26_386,
      reasoning_output_tokens: 10_136,
    });
    expect(result.estimatedApiCostUsd).toBeCloseTo(0.18478304, 10);
    expect(result.assumptions).toContain(
      'standard rates; long-context surcharge not applied without per-request usage',
    );
  });

  test('unknown models and missing or invalid usage remain unavailable, not free', () => {
    expect(estimate('unknown').estimatedApiCostUsd).toBeNull();
    expect(estimate('gpt-5.6-luna', null).reason).toBe('missing_usage');
    expect(estimate('gpt-5.6-luna', { input_tokens: 1 }).reason).toBe('invalid_usage');
    expect(estimate('gpt-5.6-luna', { ...usage, cached_input_tokens: 1_000_001 }).reason).toBe(
      'invalid_usage',
    );
    expect(
      estimate('gpt-5.6-luna', { ...usage, output_tokens: -1 }).estimatedApiCostUsd,
    ).toBeNull();
    expect(
      estimateCodexCost({ harness: 'opencode', model: 'gpt-5.6-luna', usage }, pricing).reason,
    ).toBe('unsupported_harness');
  });

  test('older CLI absence of cache writes assumes zero explicitly; explicit zero usage costs zero', () => {
    const result = estimate('gpt-5.6-luna', {
      input_tokens: 100,
      cached_input_tokens: 50,
      output_tokens: 10,
    });
    expect(result.estimatedApiCostUsd).toBeCloseTo(0.000023, 10);
    expect(result.assumptions).toContain(
      'cache_write_input_tokens absent; treated as zero as in the Codex SDK',
    );
    expect(
      estimate('gpt-5.6-luna', { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 })
        .estimatedApiCostUsd,
    ).toBe(0);
  });

  test('candidate and judge use their own model rates, with null propagation for missing executions', () => {
    const candidate = estimate();
    const judge = estimate('gpt-6-astra', {
      input_tokens: 366_279,
      cached_input_tokens: 300_416,
      cache_write_input_tokens: 0,
      output_tokens: 2_446,
      reasoning_output_tokens: 57,
    });
    expect(judge.estimatedApiCostUsd).toBeCloseTo(1.081346, 10);
    expect(summarizeCosts(candidate, judge).estimatedApiCostUsd).toBeCloseTo(1.298346, 10);
    expect(summarizeCosts(candidate, null).estimatedApiCostUsd).toBeNull();
    expect(summarizeCosts(candidate, estimate('unknown')).estimatedApiCostUsd).toBeNull();
  });
});

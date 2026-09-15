import { expect, test } from 'bun:test';
import { createCapabilitiesHandler } from './handler';

test('serves capability metadata without loading administrative records into the response', async () => {
  const response = await createCapabilitiesHandler(async () => [])();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    scope: 'hotel-catalog',
    coverage: { hotels: 0 },
    semantics: { services: 'all-required-available' },
  });
});

test('conceals errors while loading capability data', async () => {
  const response = await createCapabilitiesHandler(async () => {
    throw new Error('private');
  })();
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain('private');
});

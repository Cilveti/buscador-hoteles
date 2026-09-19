import { expect, test } from 'bun:test';
import { probePrivateBrowserFile, withEvaluationBrowser } from './browser';

test('the candidate can use its browser endpoint until delivery, then it is closed', async () => {
  let closed = false;
  const result = await withEvaluationBrowser(
    async (endpoint) => {
      expect(endpoint).toBe('ws://127.0.0.1:43123/attempt');
      expect(closed).toBe(false);
      return 'delivered';
    },
    async () => ({
      endpoint: 'ws://127.0.0.1:43123/attempt',
      close: async () => {
        closed = true;
      },
    }),
  );
  expect(result).toBe('delivered');
  expect(closed).toBe(true);
});

test('candidate failure still releases the browser and preserves the failure', async () => {
  let closed = false;
  const failure = new Error('candidate failed');
  await expect(
    withEvaluationBrowser(
      async () => {
        throw failure;
      },
      async () => ({
        endpoint: 'ws://127.0.0.1:43124/attempt',
        close: async () => {
          closed = true;
        },
      }),
    ),
  ).rejects.toBe(failure);
  expect(closed).toBe(true);
});

test('private roots reach the browser launcher independently of candidate workspace permissions', async () => {
  const roots = ['/private/judge', '/private/acceptance'];
  await withEvaluationBrowser(
    async () => 'done',
    async (received) => {
      expect(received).toEqual(roots);
      return { endpoint: 'ws://127.0.0.1:43210/private', close: async () => {} };
    },
    roots,
  );
});

test('a slow private-file probe retries but still requires an explicit denial', async () => {
  let calls = 0;
  const result = await probePrivateBrowserFile(async () => {
    if (++calls === 1)
      throw Object.assign(new Error('navigation timed out'), { name: 'TimeoutError' });
    throw new Error('net::ERR_ACCESS_DENIED');
  });
  expect(result.denied).toBe(true);
  expect(result.attempts).toHaveLength(2);
});

test('readable private files fail immediately even after a timeout', async () => {
  for (const slow of [false, true]) {
    let calls = 0;
    const result = await probePrivateBrowserFile(async () => {
      if (++calls === 1 && slow) throw Object.assign(new Error('slow'), { name: 'TimeoutError' });
    });
    expect(result.denied).toBe(false);
    expect(calls).toBe(slow ? 2 : 1);
  }
});

test('timeouts and unexpected browser failures never prove isolation', async () => {
  for (const name of ['TimeoutError', 'Error']) {
    const result = await probePrivateBrowserFile(async () => {
      throw Object.assign(new Error('browser unavailable'), { name });
    });
    expect(result.denied).toBe(false);
    expect(result.attempts).toHaveLength(name === 'TimeoutError' ? 2 : 1);
  }
});

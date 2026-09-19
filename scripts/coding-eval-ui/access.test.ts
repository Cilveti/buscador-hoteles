import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAccessGuard, loadAccess } from './access';

test('private capability protects every API method; cookies cannot authenticate across localhost ports', () => {
  const root = mkdtempSync(join(tmpdir(), 'lab-access-'));
  try {
    const file = join(root, 'access.json');
    writeFileSync(file, JSON.stringify({ token: 'a'.repeat(64) }));
    const token = loadAccess(file);
    expect(token).not.toBe('a'.repeat(64));
    expect(JSON.parse(readFileSync(file, 'utf8')).version).toBe(2);
    expect(loadAccess(file)).toBe(token);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    const guard = createAccessGuard(token);
    for (const path of [
      '/api/bootstrap',
      '/api/campaigns',
      '/api/campaigns/x/runs/001',
      '/api/jobs',
    ]) {
      for (const method of ['GET', 'POST']) {
        const url = `http://127.0.0.1:3415${path}`;
        expect(guard(new Request(url, { method }))?.status).toBe(403);
        expect(
          guard(new Request(url, { method, headers: { cookie: `harness_lab_3415=${token}` } }))
            ?.status,
        ).toBe(403);
        expect(
          guard(new Request(url, { method, headers: { authorization: `Bearer ${token}` } })),
        ).toBeNull();
      }
    }
    expect(
      guard(
        new Request('http://127.0.0.1:3415/api/bootstrap', {
          headers: { authorization: `Bearer ${'é'.repeat(64)}` },
        }),
      )?.status,
    ).toBe(403);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

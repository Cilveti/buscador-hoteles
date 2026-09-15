import { afterEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { designIdFromIssue, readDesign } from './design';
import { hash } from './state';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test('a visual task selects an explicit snapshot, not an arbitrary file path', () => {
  expect(designIdFromIssue('### Design snapshot\n\nhotel-filters-v1\n')).toBe('hotel-filters-v1');
  expect(() => designIdFromIssue('### Design snapshot\n\n../../secret')).toThrow();
});

test('design validation rejects changed exports and credential-bearing URLs', () => {
  const root = mkdtempSync(join(tmpdir(), 'factory-design-'));
  roots.push(root);
  const directory = join(root, 'factory/designs/demo');
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'tokens.json'), '{}');
  const manifest = {
    schemaVersion: 1,
    id: 'demo',
    source: {
      fileUrl: 'https://design.penpot.app/#/workspace/example',
      revision: 'test-fixture',
      exportedAt: '2026-09-16T00:00:00Z',
    },
    files: [{ path: 'tokens.json', sha256: hash('{}') }],
  };
  const save = () => writeFileSync(join(directory, 'manifest.json'), JSON.stringify(manifest));
  save();
  expect(readDesign(root, 'demo').files).toHaveLength(1);
  writeFileSync(join(directory, 'tokens.json'), '{"changed":true}');
  expect(() => readDesign(root, 'demo')).toThrow();
  writeFileSync(join(directory, 'tokens.json'), '{}');
  manifest.source.fileUrl = 'https://design.penpot.app/mcp/stream?userToken=TEST_ONLY';
  save();
  expect(() => readDesign(root, 'demo')).toThrow();
  manifest.source.fileUrl = 'https://design.penpot.app/#/workspace?userToken=TEST_ONLY';
  save();
  expect(() => readDesign(root, 'demo')).toThrow();
  manifest.source.fileUrl = 'https://design.penpot.app/#/workspace/example';
  writeFileSync(join(root, 'outside.json'), JSON.stringify(manifest));
  rmSync(join(directory, 'manifest.json'));
  symlinkSync(join(root, 'outside.json'), join(directory, 'manifest.json'));
  expect(() => readDesign(root, 'demo')).toThrow();
});

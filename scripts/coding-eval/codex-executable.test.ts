import { expect, test } from 'bun:test';
import { bundledMacCodex, codexExecutable } from './codex-executable';

test('explicit Codex executable always wins', () => {
  expect(codexExecutable({ EVAL_CODEX_BIN: '/custom/codex' }, 'darwin', () => true)).toBe(
    '/custom/codex',
  );
});

test('macOS prefers the desktop-bundled CLI when it exists', () => {
  expect(codexExecutable({}, 'darwin', (path) => path === bundledMacCodex)).toBe(bundledMacCodex);
});

test('other environments fall back to PATH', () => {
  expect(codexExecutable({}, 'linux', () => true)).toBe('codex');
  expect(codexExecutable({}, 'darwin', () => false)).toBe('codex');
});

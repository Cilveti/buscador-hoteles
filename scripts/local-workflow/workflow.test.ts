import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git } from '../coding-eval/workspace';
import { actionSchema, planSchema, specSchema, validatePlan, validQaFinish } from './contracts';
import { allowedChange, assertPatchApplies, candidatePatch } from './policy';

const spec = specSchema.parse({
  id: 'demo-task',
  title: 'Buscar con teclado',
  objective: 'Recuperar resultados con teclado sin perder filtros.',
  scope: ['Búsqueda'],
  outOfScope: [],
  decisions: [],
  acceptance: [{ id: 'AC1', criterion: 'Escape borra la consulta y conserva filtros.' }],
});

describe('workflow contracts and gates', () => {
  test('spec rejects duplicated acceptance IDs and ambiguous task state is preserved', () => {
    expect(() =>
      specSchema.parse({ ...spec, acceptance: [...spec.acceptance, ...spec.acceptance] }),
    ).toThrow();
    expect(specSchema.parse({ ...spec, decisions: ['Qué tecla usar'] }).decisions).toHaveLength(1);
  });
  test('plan must cover all and only existing criteria; subtask IDs cannot escape the run', () => {
    const task = {
      id: 'keyboard',
      title: 'Teclado',
      instructions: 'Implementar y comprobar',
      criteria: ['AC1'],
    };
    const plan = planSchema.parse({ summary: 'Plan', blockers: [], tasks: [task] });
    expect(() => validatePlan(spec, plan)).not.toThrow();
    expect(() =>
      validatePlan(spec, { ...plan, tasks: [{ ...task, criteria: ['AC2'] }] }),
    ).toThrow();
    expect(() => validatePlan(spec, { ...plan, tasks: [task, task] })).toThrow();
    expect(() => planSchema.parse({ ...plan, tasks: [{ ...task, id: '../state' }] })).toThrow();
  });
  test('QA cannot pass missing criteria or invent evidence filenames', () => {
    const finish = actionSchema.parse({
      action: 'finish',
      role: 'none',
      name: '',
      value: '',
      rationale: 'Inspeccionado',
      results: [
        {
          id: 'AC1',
          status: 'pass',
          observed: 'Texto vacío después de Escape',
          evidence: ['screen-03.png'],
        },
      ],
    });
    expect(validQaFinish(spec, finish, ['screen-03.png'])).toBe(true);
    expect(validQaFinish(spec, finish, ['screen-02.png'])).toBe(false);
    expect(() =>
      actionSchema.parse({
        ...finish,
        results: [{ ...finish.results[0], evidence: ['screen-03.png: expected result'] }],
      }),
    ).toThrow();
    expect(validQaFinish(spec, { ...finish, results: [] }, ['screen-03.png'])).toBe(false);
    expect(
      validQaFinish(spec, { ...finish, results: [{ ...finish.results[0]!, evidence: [] }] }, [
        'screen-03.png',
      ]),
    ).toBe(false);
  });
  test('workers cannot change control files, weaken the base browser suite, delete files or add dependencies', () => {
    for (const file of [
      'package.json',
      'factory/policy.ts',
      '.github/workflows/factory.yml',
      'tests/browser/catalog.spec.ts',
      'scripts/local-workflow/cli.ts',
      '.agents/skills/abordar-tarea/SKILL.md',
    ])
      expect(allowedChange(file, 'M')).toBe(false);
    expect(allowedChange('apps/web/src/features/catalog/adapters/catalog-search.tsx', 'M')).toBe(
      true,
    );
    expect(allowedChange('tests/browser/keyboard.spec.ts', 'A')).toBe(true);
    expect(allowedChange('apps/web/src/features/catalog/adapters/catalog-search.tsx', 'D')).toBe(
      false,
    );
  });
  test('external patch gate catches real forbidden changes and symlinks', () => {
    const root = mkdtempSync(join(tmpdir(), 'workflow-policy-'));
    try {
      git(root, ['init', '--quiet']);
      mkdirSync(join(root, 'apps/web/src'), { recursive: true });
      writeFileSync(join(root, 'apps/web/src/example.ts'), 'export const value = 1;\n');
      writeFileSync(join(root, 'package.json'), '{}\n');
      git(root, ['add', '-A']);
      git(root, [
        '-c',
        'user.name=Test',
        '-c',
        'user.email=test@localhost',
        'commit',
        '-qm',
        'base',
      ]);
      const state = { workspace: root, base: git(root, ['rev-parse', 'HEAD']) };
      writeFileSync(join(root, 'apps/web/src/example.ts'), 'export const value = 2;\n');
      const patch = candidatePatch(state);
      expect(patch).toContain('value = 2');
      expect(patch.endsWith('\n')).toBe(true);
      expect(() => assertPatchApplies(state, patch)).not.toThrow();
      expect(() => assertPatchApplies(state, patch.trimEnd())).toThrow('does not apply');
      writeFileSync(join(root, 'package.json'), '{"scripts":{"test":"true"}}\n');
      expect(() => candidatePatch(state)).toThrow('outside task permissions');
      git(root, ['restore', '--source=HEAD', '--staged', '--worktree', 'package.json']);
      symlinkSync('/tmp', join(root, 'apps/web/src/escape.ts'));
      expect(() => candidatePatch(state)).toThrow('regular');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

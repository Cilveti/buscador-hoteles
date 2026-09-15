import { expect, test } from 'bun:test';
import { checkDependencies, opaqueImports } from './dependency-check';

test('las dependencias respetan .dependency-cruiser.cjs', async () => {
  const { exitCode, report } = await checkDependencies();
  console.log(report.trim());
  expect(exitCode, report).toBe(0);
});

test('las capas protegidas existen y sus imports tienen rutas analizables', async () => {
  const violations: string[] = [];
  for (const pattern of [
    'packages/core/src/**/*.ts',
    'apps/web/src/features/*/application/**/*.ts',
  ]) {
    const files = Array.from(new Bun.Glob(pattern).scanSync('.')).filter(
      (file) => !file.endsWith('.test.ts'),
    );
    expect(files.length, `No se encontraron archivos en ${pattern}`).toBeGreaterThan(0);
    for (const file of files) violations.push(...opaqueImports(await Bun.file(file).text(), file));
  }
  expect(violations).toEqual([]);
});

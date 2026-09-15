import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { checkDependencies, opaqueImports } from './dependency-check';

test('las reglas permiten dependencias internas y detectan infracciones aunque cambie la sintaxis', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aurora-architecture-'));
  async function put(path: string, source: string) {
    const file = join(root, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, source);
  }
  try {
    await put('tsconfig.architecture.json', await Bun.file('tsconfig.architecture.json').text());
    await put(
      'apps/web/tsconfig.json',
      JSON.stringify({
        compilerOptions: {
          paths: {
            '@/*': ['./src/*'],
            '@hoteles/contracts/*': ['../../packages/contracts/src/*'],
          },
        },
        include: ['src/**/*.ts'],
      }),
    );
    await put('packages/core/src/catalog/rule.ts', 'export const rule = true;');
    await put('packages/core/src/catalog/use-rule.ts', "export { rule } from './rule';");
    await put('packages/contracts/src/catalog.ts', 'export type CatalogQuery = { text: string };');
    await put('apps/web/src/features/catalog/application/query.ts', 'export const query = {};');
    await put(
      'apps/web/src/features/catalog/application/port.ts',
      "import type { CatalogQuery } from '@hoteles/contracts/catalog'; export { query } from './query'; import { query as byAlias } from '@/features/catalog/application/query';",
    );
    await put('apps/web/src/features/catalog/adapters/http.ts', 'export const client = {};');
    // Los tests de comportamiento pueden usar su runner y dependencias de prueba.
    await put('packages/core/src/catalog/rule.test.ts', "import { test } from 'bun:test';");
    const green = await checkDependencies(root);
    expect(green.exitCode, green.report).toBe(0);

    const coreCases = {
      normal: "import { value } from 'payload';",
      types: "import type { ReactNode } from 'react';",
      reexport: "export { value } from 'payload';",
      'type-query': "type T = import('react').ReactNode;",
      dynamic: "const load = () => import('next');",
      require: "const payload = require('payload');",
      'import-equals': "import Framework = require('next');",
      alias: "import { client } from '@/features/catalog/adapters/http';",
      relative: "import { client } from '../../../../apps/web/src/features/catalog/adapters/http';",
    };
    for (const [name, source] of Object.entries(coreCases)) {
      await put(`packages/core/src/catalog/invalid-${name}.ts`, source);
    }
    const applicationCases = {
      react: "import React from 'react';",
      relative: "import { client } from '../adapters/http';",
      alias: "import { client } from '@/features/catalog/adapters/http';",
    };
    for (const [name, source] of Object.entries(applicationCases)) {
      await put(`apps/web/src/features/catalog/application/invalid-${name}.ts`, source);
    }
    const red = await checkDependencies(root);
    expect(red.exitCode).not.toBe(0);
    expect(red.report).toContain('core-independiente');
    expect(red.report).toContain('aplicacion-sin-adaptadores');
    for (const name of Object.keys(coreCases)) {
      expect(red.report).toContain(`packages/core/src/catalog/invalid-${name}.ts`);
    }
    for (const name of Object.keys(applicationCases)) {
      expect(red.report).toContain(`apps/web/src/features/catalog/application/invalid-${name}.ts`);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('las cargas con rutas calculadas se rechazan aunque no aparezcan en el grafo', () => {
  expect(
    opaqueImports("import('./rule'); require('./rule'); import(`./rule`);", 'example.ts'),
  ).toEqual([]);
  const found = opaqueImports(
    // biome-ignore lint/suspicious/noTemplateCurlyInString: código fuente del fixture, no interpolación del test.
    'import(moduleName); require(moduleName); import(`./${moduleName}`);',
    'example.ts',
  );
  expect(found).toHaveLength(3);
  expect(found.every((message) => message.includes('example.ts:1:'))).toBe(true);
});

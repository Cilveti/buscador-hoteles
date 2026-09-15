import { resolve } from 'node:path';
import ts from 'typescript';

const projectRoot = resolve(import.meta.dir, '../..');

/** Ejecuta las mismas reglas tanto en el proyecto como en los fixtures de arquitectura. */
export async function checkDependencies(cwd = projectRoot) {
  const child = Bun.spawn(
    [
      'node',
      resolve(projectRoot, 'node_modules/dependency-cruiser/bin/dependency-cruiser.mjs'),
      'packages/core/src',
      'apps/web/src/features',
      '--config',
      resolve(projectRoot, '.dependency-cruiser.cjs'),
      '--output-type',
      'err-long',
    ],
    { cwd, stdout: 'pipe', stderr: 'pipe' },
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { exitCode, report: stdout + stderr };
}

/** Las rutas calculadas no entran en el grafo de dependency-cruiser: se rechazan explícitamente. */
export function opaqueImports(source: string, filename: string): string[] {
  const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      const argument = node.arguments[0];
      if (
        !argument ||
        !(ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))
      ) {
        const { line } = tree.getLineAndCharacterOfPosition(node.getStart(tree));
        found.push(
          `${filename}:${line + 1}: ${node.getText(tree)} — usa una ruta literal para poder comprobar sus dependencias`,
        );
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return found;
}

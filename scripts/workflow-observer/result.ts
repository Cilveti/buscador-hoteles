import { readFileSync, statSync } from 'node:fs';

/** Keep structured outputs intact; cutting a JSON string makes it impossible to render. */
export function resultText(path: string): string | null {
  try {
    if (statSync(path).size > 2_000_000)
      return 'El resultado supera el límite de visualización de 2 MB. Consulta el archivo original.';
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

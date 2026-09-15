import { lstatSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { object, string } from './github';
import { hash } from './state';

export function designIdFromIssue(body: string): string | null {
  const value = /### Design snapshot\s+([^\n]+)/.exec(body)?.[1]?.trim();
  if (!value || value === '_No response_') return null;
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(value)) throw new Error('Invalid design snapshot ID');
  return value;
}

/** Only frozen, hashed files enter CI. A live Penpot session is a preparation tool, not a dependency. */
export function readDesign(root: string, id: string) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) throw new Error('Invalid design ID');
  const directory = resolve(root, 'factory/designs', id);
  if (!lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink())
    throw new Error('Design snapshot must be a regular directory');
  const manifestPath = join(directory, 'manifest.json');
  const manifestStat = lstatSync(manifestPath);
  if (!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.size > 64_000)
    throw new Error('Invalid design manifest file');
  const bytes = readFileSync(join(directory, 'manifest.json'));
  const manifest = object(JSON.parse(bytes.toString()));
  if (manifest.schemaVersion !== 1 || manifest.id !== id)
    throw new Error('Invalid design manifest');
  const source = object(manifest.source);
  const url = new URL(string(source.fileUrl));
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    /token|key|secret/i.test(url.search + url.hash)
  )
    throw new Error('Use a design URL without credentials or MCP tokens');
  string(source.revision);
  if (!Number.isFinite(Date.parse(string(source.exportedAt))))
    throw new Error('Invalid export date');
  if (!Array.isArray(manifest.files) || !manifest.files.length)
    throw new Error('Design has no exported files');
  let size = 0;
  const seen = new Set<string>();
  const files = manifest.files.map((entry) => {
    const file = object(entry);
    const path = string(file.path);
    if (!/^[a-zA-Z0-9_-]+\.(json|md|svg|png)$/.test(path) || seen.has(path))
      throw new Error('Invalid or duplicate design asset path');
    seen.add(path);
    const target = join(directory, path);
    if (!lstatSync(target).isFile() || lstatSync(target).isSymbolicLink())
      throw new Error('Only regular design assets');
    const content = readFileSync(target);
    size += content.length;
    if (size > 5_000_000 || hash(content) !== file.sha256)
      throw new Error('Design asset size/hash mismatch');
    return { path, sha256: string(file.sha256) };
  });
  return { directory, manifestSha: hash(bytes), files, source };
}

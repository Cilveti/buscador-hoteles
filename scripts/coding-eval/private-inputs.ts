import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { z } from 'zod';
import { git, hashFile, saveJson } from './workspace';

const manifest = z.object({ taskId: z.string().min(1), version: z.string().min(1) });
export const dossierManifestSchema = manifest.strict();
export const acceptanceManifestSchema = manifest
  .extend({
    command: z
      .tuple([z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/)])
      .rest(z.string())
      .refine(
        (command) =>
          command
            .slice(1)
            .every(
              (argument) =>
                !/(?:^|=)[/\\~]/.test(argument) && !/(?:^|[=/\\])\.\.(?:[/\\]|$)/.test(argument),
            ),
        'Acceptance command paths must stay relative to the frozen bundle; absolute and parent paths are not allowed.',
      ),
  })
  .strict();

type Bundle = {
  root: string;
  source: string;
  taskId: string;
  version: string;
  sha256: string;
  files: { path: string; sha256: string }[];
};
export type FrozenDossier = Bundle;
export type FrozenAcceptance = Bundle & { command: [string, ...string[]] };
export type PrivateInputs = {
  dossier: FrozenDossier | null;
  acceptance: FrozenAcceptance | null;
};

function filesIn(root: string, folder = ''): string[] {
  return readdirSync(join(root, folder))
    .sort()
    .flatMap((name) => {
      if (name === 'node_modules') return [];
      const path = join(folder, name);
      const stat = lstatSync(join(root, path));
      if (stat.isSymbolicLink())
        throw new Error(`Private bundles cannot contain symlinks: ${path}`);
      if (name === '.git') throw new Error(`Private bundle contains forbidden directory: ${path}`);
      if (stat.isDirectory()) return filesIn(root, path);
      if (!stat.isFile()) throw new Error(`Private bundles require regular files: ${path}`);
      return [path];
    });
}

/** Private inputs must never enter the project's snapshots or shared Git history. This is not an OS sandbox. */
function freezeBundle(project: string, source: string, destination: string): Bundle {
  const root = realpathSync(resolve(project, source));
  const projectRoot = realpathSync(project);
  const path = relative(projectRoot, root);
  if (path === '' || (!path.startsWith('../') && path !== '..'))
    throw new Error('Private inputs must live outside the project, including ignored folders.');
  let gitRepository = false;
  try {
    git(root, ['rev-parse', '--git-dir']);
    gitRepository = true;
  } catch {
    /* A non-Git directory is required. */
  }
  if (gitRepository)
    throw new Error('Private inputs must live outside Git repositories and their history.');
  if (existsSync(destination)) throw new Error(`Frozen bundle already exists: ${destination}`);
  const paths = filesIn(root);
  mkdirSync(destination, { recursive: true });
  for (const path of paths) {
    mkdirSync(dirname(join(destination, path)), { recursive: true });
    cpSync(join(root, path), join(destination, path));
  }
  const files = paths.map((path) => ({ path, sha256: hashFile(join(destination, path)) }));
  // Read only the frozen manifest, so source edits cannot change this campaign.
  const manifestName = basename(destination) === 'dossier' ? 'dossier.json' : 'acceptance.json';
  const parsed = manifest.parse(JSON.parse(readFileSync(join(destination, manifestName), 'utf8')));
  return {
    root: destination,
    source: root,
    ...parsed,
    files,
    sha256: createHash('sha256').update(JSON.stringify(files)).digest('hex'),
  };
}

export function freezePrivateInputs(
  project: string,
  taskId: string,
  campaignId: string,
  config: {
    judgeDossier: string | null;
    privateAcceptance: string | null;
  },
  destination = join(homedir(), '.local/share/hoteles-harness-evals/frozen', campaignId),
): PrivateInputs {
  const dossier = config.judgeDossier
    ? freezeBundle(project, config.judgeDossier, join(destination, 'dossier'))
    : null;
  const acceptanceBundle = config.privateAcceptance
    ? freezeBundle(project, config.privateAcceptance, join(destination, 'acceptance'))
    : null;
  if (dossier)
    dossierManifestSchema.parse(
      JSON.parse(readFileSync(join(dossier.root, 'dossier.json'), 'utf8')),
    );
  const acceptance = acceptanceBundle
    ? {
        ...acceptanceBundle,
        command: acceptanceManifestSchema.parse(
          JSON.parse(readFileSync(join(acceptanceBundle.root, 'acceptance.json'), 'utf8')),
        ).command,
      }
    : null;
  for (const bundle of [dossier, acceptance])
    if (bundle && bundle.taskId !== taskId)
      throw new Error(`Private bundle is for ${bundle.taskId}, not ${taskId}.`);
  return { dossier, acceptance };
}

export function bundleMetadata(bundle: Bundle | null) {
  if (!bundle) return null;
  const { taskId, version, sha256, files } = bundle;
  return { taskId, version, sha256, files };
}

/** Copy only frozen evidence files, never runtime dependencies or generated output. */
export function copyPrivateEvidence(bundle: Bundle, destination: string) {
  mkdirSync(destination, { recursive: true });
  for (const file of bundle.files) {
    if (hashFile(join(bundle.root, file.path)) !== file.sha256)
      throw new Error(`Frozen private input changed: ${file.path}`);
    mkdirSync(dirname(join(destination, file.path)), { recursive: true });
    cpSync(join(bundle.root, file.path), join(destination, file.path));
  }
  saveJson(join(destination, 'bundle-provenance.json'), bundleMetadata(bundle));
}

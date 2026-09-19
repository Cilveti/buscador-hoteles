import { cpSync, existsSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import type { EvalConfig } from './config';

export function skillLanguage(config: EvalConfig, name: string) {
  return config.skillLanguages[name] ?? config.skillLanguage;
}

/** English is the discoverable source; Spanish is materialized at the same candidate path. */
export function skillSource(project: string, name: string, language: 'en' | 'es') {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`Invalid skill name: ${name}`);
  const path =
    language === 'en'
      ? `.agents/skills/${name}/SKILL.md`
      : `evals/coding/skill-locales/es/${name}/SKILL.md`;
  const source = resolve(project, path);
  if (!isLocalSkillSource(project, source))
    throw new Error(`Missing or unsafe ${language} skill: ${name}`);
  return source;
}

export function isLocalSkillSource(project: string, sourceFile: string) {
  const local = relative(resolve(project), resolve(sourceFile));
  if (!/^(?:\.agents\/skills|evals\/coding\/skill-locales\/es)\/[a-z0-9-]+\/SKILL\.md$/.test(local))
    return false;
  return existsSync(sourceFile) && realpathSync(sourceFile) === join(realpathSync(project), local);
}

export function localizedProcessSource(project: string, path: string, config: EvalConfig) {
  const local = relative(resolve(project), resolve(project, path));
  const name = /^\.agents\/skills\/([a-z0-9-]+)\/SKILL\.md$/.exec(local)?.[1];
  if (config.promptText !== null && !existsSync(resolve(project, path)))
    return resolve(project, path);
  return name ? skillSource(project, name, skillLanguage(config, name)) : resolve(project, path);
}

export function copySkillResources(project: string, sourceFile: string, destination: string) {
  if (!isLocalSkillSource(project, sourceFile)) return;
  cpSync(dirname(sourceFile), destination, {
    recursive: true,
    filter: (path) => !lstatSync(path).isSymbolicLink(),
  });
}

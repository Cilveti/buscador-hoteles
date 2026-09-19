import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function readProcessSkill(project: string, path: string) {
  const sourceFile = resolve(project, path);
  const content = readFileSync(sourceFile, 'utf8');
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content)?.[1];
  const name = frontmatter?.match(/^name:\s*([a-z0-9-]+)\s*$/m)?.[1];
  if (!name)
    throw new Error(`Process skill requires a lowercase name in YAML frontmatter: ${sourceFile}`);
  return {
    name,
    sourceFile,
    content,
    path: `.agents/skills/${name}/SKILL.md`,
    sha256: createHash('sha256').update(content).digest('hex'),
  };
}

export type ProcessSkill = ReturnType<typeof readProcessSkill>;

/** Inline injection guarantees the process is supplied, independently of discovery/tool calls. */
export function buildTaskSkillPrompt(envelope: string, specification: string, skill: ProcessSkill) {
  return [
    envelope,
    `## Especificación de la tarea\n\n${specification}`,
    `## Skill de proceso inyectada: ${skill.name}\n\nAplica esta skill al abordar la tarea. Su contenido completo ya está incluido; no necesitas cargarlo de nuevo. Las referencias relativas se resuelven desde ${skill.path}.\n\n${skill.content}`,
  ].join('\n\n');
}

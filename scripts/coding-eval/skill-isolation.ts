import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Disable personal discovery through Codex's supported per-skill configuration. */
export function personalSkillOverride() {
  const roots = [join(homedir(), '.agents/skills'), join(homedir(), '.codex/skills')];
  const files = roots.flatMap((root) =>
    existsSync(root)
      ? readdirSync(root)
          .map((name) => join(root, name, 'SKILL.md'))
          .filter(existsSync)
      : [],
  );
  return `skills.config=[${files.map((path) => `{path=${JSON.stringify(path)},enabled=false}`).join(',')}]`;
}

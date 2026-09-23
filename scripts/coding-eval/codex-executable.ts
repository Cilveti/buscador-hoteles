import { existsSync } from 'node:fs';

export const bundledMacCodex = '/Applications/ChatGPT.app/Contents/Resources/codex';

/** Prefer an explicit override, then the desktop-bundled CLI on macOS, then PATH. */
export function codexExecutable(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  exists: (path: string) => boolean = existsSync,
): string {
  if (env.EVAL_CODEX_BIN) return env.EVAL_CODEX_BIN;
  return platform === 'darwin' && exists(bundledMacCodex) ? bundledMacCodex : 'codex';
}

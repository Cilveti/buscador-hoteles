import { readFileSync } from 'node:fs';
import type { Specification } from './contracts';

const readPrompt = (name: string) =>
  readFileSync(new URL(`./prompts/${name}.md`, import.meta.url), 'utf8');
const instructions = {
  common: readPrompt('common'),
  qa: readPrompt('qa'),
  'research-product': readPrompt('research-product'),
  'research-verification': readPrompt('research-verification'),
  planner: readPrompt('planner'),
  implementer: readPrompt('implementer'),
  reviewer: readPrompt('reviewer'),
};

/** Named data sections keep task context separate from maintained agent instructions. */
export function taskPrompt(
  role: Exclude<keyof typeof instructions, 'common' | 'qa'>,
  spec: Specification,
  context: Record<string, unknown> = {},
): string {
  return [
    instructions.common,
    instructions[role],
    ...Object.entries({ 'SPECIFICATION (authoritative requirements)': spec, ...context }).map(
      ([name, value]) =>
        `## ${name}\n${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}`,
    ),
  ].join('\n\n');
}

export function qaPrompt(context: {
  spec: Specification;
  url: string;
  baseURL: string;
  screenshot: string;
  observation: string;
  history: unknown;
  remainingActions: number;
  screenshots: string[];
}): string {
  return `${instructions.qa}
SPECIFICATION: ${JSON.stringify(context.spec)}
URL: ${context.url}
LOCAL ORIGIN: ${context.baseURL}
OBSERVATION (${context.screenshot}):
${context.observation}
HISTORY: ${JSON.stringify(context.history)}
Remaining actions: ${context.remainingActions}.
Previously captured: ${context.screenshots.join(', ')}.
`;
}

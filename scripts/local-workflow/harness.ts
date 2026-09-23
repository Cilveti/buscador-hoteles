/** Adapter boundary: workflows describe work; each harness translates this invocation to its CLI. */
export type HarnessInvocation = {
  root: string;
  prompt: string;
  schemaPath: string;
  resultPath: string;
  logPath: string;
  access: 'read' | 'write';
  env?: Record<string, string>;
  model?: string;
  reasoningEffort?: string;
  images: string[];
  timeoutMs: number;
  permissionArgs?: string[];
  persistSession?: boolean;
};

export type HarnessAdapter = {
  images: boolean;
  run: (invocation: HarnessInvocation) => Promise<unknown>;
};
export type HarnessRegistry = Readonly<Record<string, HarnessAdapter>>;

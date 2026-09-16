import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { closeSync, openSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config';
import { object, string } from './github';
import { resultSchema, validateResult } from './model-result';
import { waitForModelResult } from './model-session';

// This trusted driver runs after installation, with the model key confined to this job.
// The API server is loopback-only, password-protected and killed on completion.
const temp = string(process.env.RUNNER_TEMP);
const role = process.env.WORKER_ROLE === 'reviewer' ? 'reviewer' : 'implementer';
const model = string(process.env.OPENCODE_MODEL);
const separator = model.indexOf('/');
if (separator < 1 || separator === model.length - 1) throw new Error('Invalid model identifier');
const workerConfig = object(JSON.parse(string(process.env.OPENCODE_CONFIG_CONTENT)));
const permissions = object(object(object(workerConfig.agent).build).permission);
if (permissions.StructuredOutput !== 'allow')
  throw new Error('StructuredOutput must be enabled before requesting a schema result');
const password = randomBytes(32).toString('hex');
const stderr = openSync(join(temp, 'worker-stderr.log'), 'w', 0o600);
const child = spawn(
  process.env.FACTORY_OPENCODE_BINARY ?? 'opencode',
  ['--pure', 'serve', '--hostname', '127.0.0.1', '--port', '0'],
  {
    cwd: join(temp, 'candidate'),
    env: {
      ...process.env,
      PWD: join(temp, 'candidate'),
      OPENCODE_SERVER_PASSWORD: password,
      OPENCODE_SERVER_USERNAME: 'opencode',
    },
    stdio: ['ignore', 'pipe', stderr],
  },
);
closeSync(stderr);
const closed = new Promise<void>((resolve) => child.once('close', () => resolve()));
let stage = 'startup';
try {
  const url = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('OpenCode startup timeout')), 30_000);
    let output = '';
    child.once('error', () => {
      clearTimeout(timer);
      reject(new Error('Could not start OpenCode'));
    });
    child.once('exit', () => {
      clearTimeout(timer);
      reject(new Error('OpenCode exited before readiness'));
    });
    const stdout = child.stdout;
    if (!stdout) {
      clearTimeout(timer);
      reject(new Error('Missing OpenCode output stream'));
      return;
    }
    stdout.on('data', (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-16_000);
      const match = /opencode server listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(output);
      if (match?.[1]) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
  });
  const deadline = AbortSignal.timeout(config.limits.modelMinutes * 60_000);
  async function request(path: string, body?: unknown): Promise<unknown> {
    const endpoint = new URL(path, url);
    endpoint.searchParams.set('directory', join(temp, 'candidate'));
    const response = await fetch(endpoint, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`,
        'content-type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: deadline,
    });
    // Do not emit arbitrary server errors: they may include request headers or private data.
    if (!response.ok) {
      const body = (await response.text())
        .replaceAll(password, '[redacted]')
        .replaceAll(process.env.OPENCODE_API_KEY ?? 'NO_KEY', '[redacted]');
      // Before the first assistant message, 1.18.30 can fail to encode the schema on the user message.
      if (response.status === 400 && path.endsWith('/message?limit=1')) {
        const error = object(JSON.parse(body));
        if (
          error.name === 'BadRequest' &&
          String(object(error.data).message).startsWith('Expected OutputFormatJsonSchema, got ')
        )
          return [];
      }
      throw new Error(`OpenCode API returned HTTP ${response.status}`);
    }
    return response.status === 204 ? null : await response.json();
  }
  const health = object(await request('/global/health'));
  if (health.healthy !== true || health.version !== config.worker.version)
    throw new Error('Wrong OpenCode server version');
  const context = object(await request('/path'));
  if (realpathSync(string(context.directory)) !== realpathSync(join(temp, 'candidate')))
    throw new Error('OpenCode is outside the candidate snapshot');
  const session = object(await request('/session', { title: `Factory ${role}`, agent: 'build' }));
  const sessionId = string(session.id);
  if (!/^ses[a-zA-Z0-9_-]+$/.test(sessionId)) throw new Error('Invalid OpenCode session');
  stage = 'submit';
  await request(`/session/${sessionId}/prompt_async`, {
    agent: 'build',
    model: { providerID: model.slice(0, separator), modelID: model.slice(separator + 1) },
    parts: [{ type: 'text', text: readFileSync(join(temp, 'worker-prompt.txt'), 'utf8') }],
    // No hidden schema retry budget on top of the task's three implementation attempts.
    format: { type: 'json_schema', schema: resultSchema(role), retryCount: 0 },
  });
  stage = 'waiting';
  const info = await waitForModelResult(request, sessionId, deadline);
  stage = 'validation';
  writeFileSync(
    join(temp, 'model-diagnostic.json'),
    JSON.stringify({
      version: health.version,
      model,
      role,
      transport: 'async',
      hasStructuredResult: info.structured !== undefined,
      hasModelError: info.error !== undefined,
      // This deliberately records shape, not the model's prose, credentials or chain of thought.
    }),
    { mode: 0o600 },
  );
  if (info.error)
    throw new Error('OpenCode returned a model or structured-output error; see diagnostic');
  const result = validateResult(info.structured, role);
  writeFileSync(join(temp, 'worker-result.json'), JSON.stringify(result), { mode: 0o600 });
} catch (error) {
  writeFileSync(
    join(temp, 'model-diagnostic.json'),
    JSON.stringify({
      version: config.worker.version,
      model,
      role,
      transport: 'async',
      stage,
      outcome: 'failed',
      httpStatus:
        error instanceof Error
          ? /^OpenCode API returned HTTP (\d{3})$/.exec(error.message)?.[1]
          : undefined,
      errorKind:
        error instanceof TypeError
          ? 'TypeError'
          : error instanceof Error && error.name === 'TimeoutError'
            ? 'TimeoutError'
            : 'Error',
      timeout: error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name),
    }),
    { mode: 0o600 },
  );
  throw new Error(`Model ${stage} failed; inspect the non-sensitive diagnostic`);
} finally {
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
  await closed;
  clearTimeout(timer);
}

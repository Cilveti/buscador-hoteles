import { appendFileSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test } from './fixtures';

test('configura modelo y esfuerzo por rol sin elegir presets de tareas', async ({ page }) => {
  let submitted: Record<string, unknown> | null = null;
  await page.route('**/api/workflows', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    submitted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 400, json: { error: 'Prueba de formulario' } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Workflows', exact: true }).click();
  await page.getByRole('button', { name: '＋ Lanzar workflow' }).click();
  await expect(page.getByRole('combobox', { name: 'Arnés principal' })).toHaveValue('codex');
  await expect(page.getByRole('combobox', { name: 'Agentes' })).toHaveCount(0);
  await expect(page.getByText('escape-search-luna-high')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Modelo principal' }).fill('gpt-6-luna');
  await page.getByRole('combobox', { name: 'Esfuerzo principal' }).selectOption('high');
  await page.getByText('Personalizar por fase').click();
  await page.getByRole('checkbox', { name: 'Personalizar Implementación' }).check();
  await page.getByRole('combobox', { name: 'Modelo de Implementación' }).fill('gpt-6-sol');
  await page.getByRole('combobox', { name: 'Esfuerzo de Implementación' }).selectOption('xhigh');
  await page.getByRole('button', { name: 'Iniciar y observar →' }).click();
  await expect(page.getByRole('alert')).toContainText('Prueba de formulario');
  expect(submitted).toMatchObject({
    agentConfig: {
      default: { harness: 'codex', model: 'gpt-6-luna', reasoningEffort: 'high' },
      roles: {
        implementer: { harness: 'codex', model: 'gpt-6-sol', reasoningEffort: 'xhigh' },
      },
    },
  });
  expect(submitted).not.toHaveProperty('agentsPath');
});

test('muestra la cadena, la traza y el fallo actualizado en vivo sin llamar a modelos', async ({
  page,
}) => {
  const project = realpathSync(resolve('.'));
  const id = `ui-observer-${process.pid}-${Date.now()}`;
  const run = join(project, '.tmp/local-workflows', id);
  const agent = join(run, 'round-1/implementation-1');
  const evaluation = join(project, '.agent-evals', id);
  const evalRun = join(evaluation, 'runs/001');
  mkdirSync(agent, { recursive: true });
  mkdirSync(evalRun, { recursive: true });
  const now = new Date().toISOString();
  const state = {
    id,
    project,
    directory: run,
    workspace: project,
    base: '0'.repeat(40),
    mode: 'normal',
    status: 'verifying',
    spec: {
      id: 'ui-observer',
      title: 'Caso UI de trazabilidad',
      objective: 'Observar estado en vivo',
      scope: ['Probar UI'],
      outOfScope: [],
      acceptance: [{ id: 'AC1', criterion: 'Evidencia visible' }],
      decisions: [],
    },
    plan: null,
    approval: false,
    completedTasks: [],
    attempts: {},
    round: 1,
    maxRounds: 2,
    maxTaskAttempts: 2,
    headed: false,
    message: 'Ejecutando checks',
    createdAt: now,
    updatedAt: now,
  };
  writeFileSync(join(run, 'state.json'), JSON.stringify(state));
  writeFileSync(join(run, 'running.lock'), String(process.pid));
  writeFileSync(
    join(run, 'events.jsonl'),
    `${JSON.stringify({ at: now, status: 'verifying', message: 'Ejecutando checks' })}\n`,
  );
  writeFileSync(
    join(agent, 'agent.json'),
    JSON.stringify({
      role: 'implementer',
      harness: 'codex',
      model: 'gpt-6-luna',
      sessionPersisted: true,
    }),
  );
  const agentEvents = [
    JSON.stringify({ type: 'thread.started', thread_id: '12345678-1234-1234-1234-123456789012' }),
    JSON.stringify({
      type: 'item.completed',
      item: { type: 'agent_message', text: 'Cambio entregado al controlador.' },
    }),
  ];
  writeFileSync(join(agent, 'agent.log'), `${agentEvents.join('\n')}\n`);
  writeFileSync(
    join(agent, 'result.json'),
    JSON.stringify({ summary: 'Resultado del implementador' }),
  );
  writeFileSync(join(evaluation, 'manifest.json'), JSON.stringify({ status: 'completed' }));
  writeFileSync(
    join(evalRun, 'result.json'),
    JSON.stringify({
      status: 'evaluated',
      outcome: 'pass',
      score: 7.5,
      judgeTaskVerdict: 'pass',
      repositoryChecksPassed: true,
      config: {
        task: 'Evaluación UI de trazabilidad',
        candidateKind: 'single-agent',
        harness: 'codex',
        model: 'gpt-6-luna',
      },
    }),
  );
  await page.route('**/api/campaigns', (route) =>
    route.fulfill({
      json: [
        {
          id,
          status: 'evaluated',
          config: { task: 'Evaluación UI de trazabilidad', model: 'gpt-6-luna' },
          runs: [{ id: '001', status: 'evaluated', score: 7.5, outcome: 'pass', passed: true }],
        },
      ],
    }),
  );
  await page.route(`**/api/campaigns/${id}/runs/001`, (route) =>
    route.fulfill({
      json: { id: '001', status: 'evaluated', score: 7.5, outcome: 'pass' },
    }),
  );
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Workflows', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Sala de control' })).toBeVisible();
    await page.getByRole('button', { name: /Caso UI de trazabilidad/ }).click();
    await expect(page.getByRole('heading', { name: 'Caso UI de trazabilidad' })).toBeVisible();
    await expect(page.getByText('Ejecutando checks').first()).toBeVisible();
    await page.getByRole('button', { name: 'Ver traza en vivo' }).click();
    await expect(page.getByText('Cambio entregado al controlador.')).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await page.getByRole('button', { name: 'Ver resultado' }).click();
    await expect(page.getByText(/Resultado del implementador/)).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: 'Copiar comando para reabrir' }).click();
    await expect(page.getByRole('button', { name: 'Comando copiado' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('codex -C');
    appendFileSync(join(agent, 'feedback.md'), 'El reviewer detectó que la URL pierde filtros.');
    appendFileSync(
      join(run, 'events.jsonl'),
      `${JSON.stringify({ at: new Date().toISOString(), status: 'failed', message: 'Falló el review' })}\n`,
    );
    state.status = 'failed';
    state.message = 'Falló el review';
    state.updatedAt = new Date().toISOString();
    writeFileSync(join(run, 'state.json'), JSON.stringify(state));
    await expect(page.getByText('Falló el review').first()).toBeVisible({ timeout: 7000 });
    await page.getByText(/Feedback · round-1\/implementation-1\/feedback.md/).click();
    await expect(page.getByText(/El reviewer detectó que la URL pierde filtros/)).toBeVisible({
      timeout: 7000,
    });
    await page.getByRole('button', { name: '＋ Lanzar workflow' }).click();
    await expect(page.getByRole('region', { name: 'Lanzar workflow' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar y observar →' })).toBeEnabled();
    await expect(page.locator('.workflow-list')).not.toContainText('Evaluación UI de trazabilidad');
    await expect(page.getByRole('combobox', { name: 'Tipo de ejecución' })).toHaveCount(0);
    await page.getByRole('button', { name: /^Evaluaciones/ }).click();
    await page.getByRole('button', { name: `Abrir run 001 de ${id}` }).click();
    await page.getByRole('button', { name: 'Ver recorrido' }).click();
    await expect(page.getByRole('heading', { name: 'Evaluación · recorrido' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recorrido de la evaluación' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Evaluación UI de trazabilidad' }),
    ).toBeVisible();
    await expect(page.getByText('7.5/10').first()).toBeVisible();
    await expect(page.getByText('Agente candidato')).toBeVisible();
    await expect(page.locator('.workflow-list')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '＋ Lanzar workflow' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Volver a evaluaciones' }).click();
    await expect(page.getByRole('heading', { name: 'Evaluaciones', exact: true })).toBeVisible();
  } finally {
    await page.close();
    rmSync(run, { recursive: true, force: true });
    rmSync(evaluation, { recursive: true, force: true });
  }
});

import type { WorkflowRun } from '../../../../scripts/workflow-observer/contracts';
import { expect, test } from './fixtures';

test('los resultados y mensajes finales muestran tareas, hallazgos y evidencias sin JSON en bruto', async ({
  page,
}) => {
  const cases = [
    {
      role: 'research-product',
      phase: 'research',
      expected: 'El filtro vive en el catálogo.',
      output: {
        summary: 'El filtro vive en el catálogo.',
        files: ['apps/web/src/catalog.tsx'],
        risks: ['La URL debe conservar sus filtros.'],
        blockers: [],
      },
    },
    {
      role: 'planner',
      phase: 'planning',
      expected: 'Conservar el filtro al paginar',
      output: {
        summary: 'Plan para mantener los filtros.',
        tasks: [
          {
            id: 'pagination',
            title: 'Conservar el filtro al paginar',
            instructions: 'Mantener el país al cambiar de página.',
            criteria: ['AC1'],
          },
        ],
        blockers: [],
      },
    },
    {
      role: 'implementer',
      phase: 'implementing',
      expected: 'La paginación conserva el país.',
      output: {
        status: 'implemented',
        summary: 'La paginación conserva el país.',
        blockers: [],
        extraContext: { retries: 0, reusedCache: false, pendingData: null },
      },
    },
    {
      role: 'reviewer',
      phase: 'reviewing',
      expected: 'La URL pierde el orden al volver atrás.',
      output: {
        status: 'changes-requested',
        summary: 'Hay una transición pendiente de corregir.',
        findings: [
          {
            path: 'apps/web/src/catalog.tsx',
            problem: 'La URL pierde el orden al volver atrás.',
            criterion: 'AC2',
          },
        ],
      },
    },
    {
      role: 'qa',
      phase: 'qa',
      expected: 'El país se conserva en la segunda página.',
      output: {
        passed: false,
        results: [
          {
            id: 'AC1',
            status: 'pass',
            observed: 'El país se conserva en la segunda página.',
            evidence: ['screen-01.png'],
          },
          {
            id: 'AC2',
            status: 'fail',
            observed: 'Al volver atrás, el orden seleccionado desaparece.',
            evidence: ['screen-02.png'],
          },
          {
            id: 'AC3',
            status: 'not-verified',
            observed: 'No se comprobó la recarga.',
            evidence: [],
          },
        ],
        history: [{ action: 'back', outcome: 'Página anterior cargada.' }],
        requests: [],
        scope: 'Catálogo sintético',
      },
    },
  ];
  const run: WorkflowRun = {
    ref: 'local:result-presentation',
    source: 'local',
    definitionId: 'delivery',
    title: 'Resultados legibles',
    runId: 'result-presentation',
    status: 'failed',
    rawStatus: 'failed',
    message: 'QA encontró un fallo.',
    startedAt: '2026-09-24T10:00:00Z',
    updatedAt: '2026-09-24T10:05:00Z',
    round: 1,
    score: null,
    agents: cases.map((entry) => ({
      id: entry.role,
      role: entry.role,
      harness: 'codex',
      model: 'gpt-6-luna',
      status: 'passed',
      startedAt: '2026-09-24T10:00:00Z',
      durationMs: 1000,
      traceAvailable: true,
      output: JSON.stringify(entry.output),
      sessionId: null,
      resumeCommand: null,
    })),
    steps: cases.map((entry) => ({
      id: entry.phase,
      phase: entry.phase,
      title: entry.phase,
      status: 'passed',
      at: '2026-09-24T10:00:00Z',
      message: entry.phase,
    })),
    checks: [],
    handoffs: [],
    artifacts: [],
  };
  await page.route('**/api/workflows?source=local', (route) => route.fulfill({ json: [run] }));
  await page.route('**/api/workflows/local%3Aresult-presentation**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/stream'))
      return route.fulfill({
        contentType: 'text/event-stream',
        body: `data: ${JSON.stringify(run)}\n\n`,
      });
    if (path.endsWith('/trace')) {
      const entry = cases.find((entry) => path.includes(`/agents/${entry.role}/`));
      const body = JSON.stringify(entry?.output);
      return route.fulfill({
        json: {
          items: [
            {
              index: 0,
              kind: 'message',
              title: 'Agente',
              body: entry?.role === 'planner' ? `\`\`\`json\n${body}\n\`\`\`` : body,
              status: null,
            },
          ],
          before: null,
          truncated: false,
        },
      });
    }
    return route.fulfill({ json: run });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Workflows', exact: true }).click();
  await page.getByRole('button', { name: /Resultados legibles/ }).click();
  for (const entry of cases) {
    const step = page
      .locator('.workflow-timeline > li')
      .filter({ has: page.locator('.workflow-step-head > strong', { hasText: entry.phase }) });
    for (const action of ['Ver resultado', 'Ver traza en vivo']) {
      await step.getByRole('button', { name: action }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByText(entry.expected, { exact: true })).toBeVisible();
      await expect(dialog.locator('.result-source pre')).toBeHidden();
      if (entry.role === 'qa') {
        await expect(dialog.getByText('Sin verificar', { exact: true })).toBeVisible();
        await expect(dialog.getByText('Falló', { exact: true })).toBeVisible();
        await expect(dialog.getByText('screen-02.png', { exact: true })).toBeVisible();
        await expect(dialog.getByText('Página anterior cargada.', { exact: true })).toBeHidden();
        if (action === 'Ver resultado')
          await page.screenshot({ path: '.agent-evals/ui/result-presentation.png' });
      }
      await dialog.getByText('Ver JSON original', { exact: true }).click();
      await expect(dialog.locator('.result-source pre')).toContainText(entry.expected);
      await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
    }
  }
});

import { randomUUID } from 'node:crypto';
import { unlinkSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { loadAccess } from '../../../../scripts/coding-eval-ui/access';
import { expect, test } from './fixtures';

// Exercise the real catalog and recipe API. Only model execution is replaced.
test('seleccionar skills, ruta por teclado y recuperar receta guardada', async ({ page }) => {
  const name = `ux-${randomUUID()}`;
  try {
    await page.goto('/');
    await page.getByRole('button', { name: '＋ Nueva evaluación' }).click();
    await page.getByLabel('Nombre', { exact: true }).fill(name);
    await page
      .getByRole('region', { name: 'Skills disponibles', exact: true })
      .getByRole('button', { name: 'Quitar todas' })
      .click();
    await page.getByRole('textbox', { name: 'Buscar skills disponibles' }).fill('testing');
    await page
      .getByRole('region', { name: 'Skills disponibles', exact: true })
      .getByRole('checkbox', { name: 'hoteles-testing', exact: true })
      .check();
    await page
      .getByRole('combobox', { name: 'Código de partida · rama o commit' })
      .fill('feature/mi-baseline');
    await page.getByRole('combobox', { name: 'Código de partida · rama o commit' }).press('Tab');
    await page.getByRole('button', { name: 'Guardar receta', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Receta guardada×');
    await page.reload();
    await page.getByRole('button', { name: 'Recetas', exact: true }).click();
    await page.getByRole('combobox', { name: 'Receta', exact: true }).selectOption(name);
    await expect(
      page.getByRole('button', { name: 'Quitar hoteles-testing', exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('region', { name: 'Skills disponibles', exact: true })
        .getByRole('checkbox', { name: 'hoteles-hexagonal', exact: true }),
    ).not.toBeChecked();
    await expect(
      page.getByRole('combobox', { name: 'Código de partida · rama o commit' }),
    ).toHaveValue('feature/mi-baseline');
    const submit = page.getByRole('button', { name: '▶ Ejecutar evaluación', exact: true });
    await expect(submit).toBeInViewport();
    await expect(
      page.getByRole('button', { name: 'Solo comprobar código de partida' }),
    ).not.toBeVisible();
  } finally {
    try {
      unlinkSync(resolve('.agent-evals/ui/recipes', `${name}.json`));
    } catch {}
  }
});

test('ejecutar lleva al progreso animado y actualiza al terminar sin llamar modelos', async ({
  page,
}) => {
  const name = `ux-${randomUUID()}`;
  let launched = false;
  let completed = false;
  const job = () => ({
    id: 'ux-controlled-job',
    recipe: name,
    mode: 'run',
    status: completed ? 'completed' : 'running',
    startedAt: new Date().toISOString(),
    finishedAt: completed ? new Date().toISOString() : null,
    exitCode: completed ? 0 : null,
    logPath: '',
    config: {},
    campaignId: null,
    phase: completed ? 'completed' : 'candidate',
    totalRuns: 1,
    completedRuns: completed ? 1 : 0,
  });
  await page.route('**/api/jobs', async (route) => {
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ name, mode: 'run' });
      launched = true;
      await route.fulfill({ status: 202, json: job() });
    } else await route.fulfill({ json: launched ? [job()] : [] });
  });
  await page.route('**/api/jobs/ux-controlled-job', (route) =>
    route.fulfill({ json: { ...job(), logTail: 'Salida controlada del candidato' } }),
  );
  try {
    await page.goto('/');
    await page.getByRole('button', { name: '＋ Nueva evaluación' }).click();
    await page.getByLabel('Nombre', { exact: true }).fill(name);
    await page.getByRole('button', { name: '▶ Ejecutar evaluación', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Ejecuciones', exact: true })).toBeVisible();
    const progress = page.getByRole('region', { name: 'Progreso de ejecución' });
    await expect(progress).toContainText('Candidato');
    await expect(progress.getByRole('status').locator('.spinner')).toBeVisible();
    await progress.getByText('Log de ejecución', { exact: true }).click();
    await expect(progress).toContainText('Salida controlada del candidato');
    completed = true;
    await expect(progress).toContainText('Finalizada', { timeout: 8000 });
    await expect(progress.locator('.spinner')).toHaveCount(0);
  } finally {
    try {
      unlinkSync(resolve('.agent-evals/ui/recipes', `${name}.json`));
    } catch {}
  }
});

test('tabla filtra, abre el detalle y vuelve con Escape', async ({ page }) => {
  await page.route('**/api/campaigns', (route) =>
    route.fulfill({
      json: [
        {
          id: 'fixture-campaign',
          config: { task: 'advanced-filters', model: 'fixture' },
          runs: [{ id: '001', status: 'evaluated', passed: true }],
        },
      ],
    }),
  );
  await page.route('**/api/campaigns/fixture-campaign/runs/001', (route) =>
    route.fulfill({ json: { id: '001', passed: true, judgeTaskVerdict: 'pass' } }),
  );
  await page.goto('/');
  const table = page.getByRole('table', { name: 'Ejecuciones', exact: true });
  await expect(table.getByRole('columnheader', { name: 'Nota juez', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Buscar ejecuciones' }).fill('ninguna-campana-coincide');
  await expect(table).toContainText('Sin ejecuciones');
  await page.getByRole('textbox', { name: 'Buscar ejecuciones' }).fill('');
  const firstRun = table.getByRole('button', { name: /^Abrir run 001 de/ }).first();
  await firstRun.click();
  const dialog = page.getByRole('dialog', { name: 'Run 001' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Calidad', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('editores exactos, skills iniciales, checks y biblioteca se guardan en una receta', async ({
  page,
}) => {
  const name = `ux-${randomUUID()}`;
  const specification = '  Implementa filtros sin tocar reservas.\n\nConserva la URL al volver.\n';
  const prompt = 'Primero inspecciona contratos.\nNo hagas refactors ajenos.  \n';
  try {
    await page.goto('/');
    await page.getByRole('button', { name: '＋ Nueva evaluación' }).click();
    await page.getByLabel('Nombre', { exact: true }).fill(name);
    await expect(page.getByRole('textbox', { name: 'Especificación', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Todas las skills', exact: true }).click();
    const library = page.getByRole('dialog', { name: 'Todas las skills', exact: true });
    await library.getByRole('button', { name: 'hoteles-testing', exact: true }).click();
    await expect(library.locator('pre')).toContainText('name: hoteles-testing');
    await library.getByRole('button', { name: 'Usar como prompt', exact: true }).click();
    await expect(
      page.getByRole('textbox', { name: 'Prompt de proceso', exact: true }),
    ).toContainText('name: hoteles-testing');
    await page.getByRole('textbox', { name: 'Especificación', exact: true }).fill(specification);
    await page.getByRole('textbox', { name: 'Prompt de proceso', exact: true }).fill(prompt);
    await page
      .getByRole('region', { name: 'Skills al inicio', exact: true })
      .getByRole('checkbox', { name: 'hoteles-hexagonal', exact: true })
      .check();
    await page
      .getByRole('region', { name: 'Skills disponibles', exact: true })
      .getByRole('button', { name: 'Quitar todas' })
      .click();
    await page.getByRole('button', { name: 'Ninguno', exact: true }).click();
    await page.getByRole('button', { name: 'Guardar receta', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Receta guardada');
    const saved = await (
      await page.request.get('/api/recipes', {
        headers: { Authorization: `Bearer ${loadAccess(resolve('.agent-evals/ui/access.json'))}` },
      })
    ).json();
    const recipe = saved.find((item: { name: string }) => item.name === name);
    expect(recipe.config.specificationText).toBe(specification);
    expect(recipe.config.promptText).toBe(prompt);
    expect(recipe.config.initialSkills).toEqual(['hoteles-hexagonal']);
    expect(recipe.config.skills).toEqual([]);
    expect(recipe.config.browserSkill).toBe(false);
    expect(recipe.config.candidateChecks).toEqual([]);
    await page.reload();
    await page.getByRole('button', { name: 'Recetas', exact: true }).click();
    await page.getByRole('combobox', { name: 'Receta', exact: true }).selectOption(name);
    await expect(page.getByRole('textbox', { name: 'Especificación', exact: true })).toHaveValue(
      specification,
    );
    await expect(page.getByRole('textbox', { name: 'Prompt de proceso', exact: true })).toHaveValue(
      prompt,
    );
  } finally {
    try {
      unlinkSync(resolve('.agent-evals/ui/recipes', `${name}.json`));
    } catch {}
  }
});

test('idioma global, excepción de testing y prompt propio se conservan al guardar', async ({
  page,
}) => {
  const name = `ux-${randomUUID()}`;
  try {
    await page.goto('/');
    await page.getByRole('button', { name: '＋ Nueva evaluación' }).click();
    await expect(page.getByRole('textbox', { name: 'Prompt de proceso', exact: true })).toHaveValue(
      /Approach a development task/,
    );
    await page
      .getByRole('combobox', { name: 'Idioma de las skills', exact: true })
      .selectOption('es');
    await expect(page.getByRole('textbox', { name: 'Prompt de proceso', exact: true })).toHaveValue(
      /Abordar una tarea de desarrollo/,
    );
    await page.getByText('Idioma por skill', { exact: true }).click();
    await page.getByRole('combobox', { name: 'hoteles-testing', exact: true }).selectOption('en');
    await page
      .getByRole('textbox', { name: 'Prompt de proceso', exact: true })
      .fill('MI PROMPT EDITADO');
    await page
      .getByRole('combobox', { name: 'Idioma de las skills', exact: true })
      .selectOption('en');
    await expect(page.getByRole('textbox', { name: 'Prompt de proceso', exact: true })).toHaveValue(
      'MI PROMPT EDITADO',
    );
    await page.getByLabel('Nombre', { exact: true }).fill(name);
    await page.getByRole('button', { name: 'Guardar receta', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Receta guardada×');
    await page.reload();
    await page.getByRole('button', { name: 'Recetas', exact: true }).click();
    await page.getByRole('combobox', { name: 'Receta', exact: true }).selectOption(name);
    await expect(
      page.getByRole('combobox', { name: 'Idioma de las skills', exact: true }),
    ).toHaveValue('en');
    await page.getByText('Idioma por skill', { exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'hoteles-testing', exact: true })).toHaveValue(
      'en',
    );
    await expect(page.getByRole('textbox', { name: 'Prompt de proceso', exact: true })).toHaveValue(
      'MI PROMPT EDITADO',
    );
  } finally {
    try {
      unlinkSync(resolve('.agent-evals/ui/recipes', `${name}.json`));
    } catch {}
  }
});

test('el acceso inicial protege los resultados y desaparece de la URL', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext();
  try {
    const denied = await context.request.get(`${baseURL}/api/campaigns`);
    expect(denied.status()).toBe(403);
    const page = await context.newPage();
    const token = loadAccess(resolve('.agent-evals/ui/access.json'));
    await page.goto(`${baseURL}/#access=${token}`);
    await expect(page.getByRole('heading', { name: 'Ejecuciones', exact: true })).toBeVisible();
    expect(new URL(page.url()).hash).toBe('');
    expect((await context.request.get(`${baseURL}/api/campaigns`)).status()).toBe(403);
    expect(
      (
        await context.request.get(`${baseURL}/api/campaigns`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ).status(),
    ).toBe(200);
    expect((await context.cookies()).some((cookie) => cookie.value === token)).toBe(false);
    let leaked = false;
    const otherPort = createServer((request, response) => {
      leaked ||= JSON.stringify(request.headers).includes(token);
      response.end('Other local app');
    });
    await new Promise<void>((ready) => otherPort.listen(0, '127.0.0.1', ready));
    try {
      const address = otherPort.address();
      if (!address || typeof address === 'string') throw new Error('Missing test port');
      await page.goto(`http://127.0.0.1:${address.port}`);
      await expect(page.locator('body')).toContainText('Other local app');
      expect(leaked).toBe(false);
      await page.goto(baseURL ?? '/');
    } finally {
      otherPort.closeAllConnections();
      await new Promise<void>((closed) => otherPort.close(() => closed()));
    }

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Ejecuciones', exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});

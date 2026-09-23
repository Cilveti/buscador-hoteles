import { expect, test } from './fixtures';

for (const retained of [true, false]) {
  test(`configuración histórica de solo lectura, textos ${retained ? 'conservados' : 'ausentes'}`, async ({
    page,
  }) => {
    const specification = '  Requisito histórico que ya no está en el catálogo.\n';
    const prompt = 'Proceso congelado\n\nRequired verification scenarios for this task\n';
    const config = {
      task: 'historical-task',
      taskFile: 'removed/specification.md',
      processSkill: '.agents/skills/removed/SKILL.md',
      promptText: null,
      specificationText: null,
      model: 'historical-model',
      effort: 'high',
      skillLanguage: 'es',
      skills: ['historical-skill'],
      initialSkills: ['historical-skill'],
      browserSkill: false,
      candidateChecks: [],
      baseline: 'main',
      repeats: 2,
      concurrency: 2,
    };
    let sourceReads = 0;
    let writes = 0;
    page.on('request', (request) => {
      if (request.url().includes('/api/sources')) sourceReads++;
      if (request.method() === 'POST') writes++;
    });
    await page.route('**/api/campaigns', (route) =>
      route.fulfill({
        json: [
          {
            id: 'historical-campaign',
            config,
            runs: [{ id: '002', status: 'evaluated', passed: true }],
          },
        ],
      }),
    );
    await page.route('**/api/campaigns/historical-campaign/runs/002', (route) =>
      route.fulfill({
        json: {
          id: '002',
          config,
          baselineCommit: 'frozen-commit',
          artifacts: retained ? ['specification', 'process'] : [],
        },
      }),
    );
    await page.route('**/artifacts/specification', (route) =>
      route.fulfill({ body: specification }),
    );
    await page.route('**/artifacts/process', (route) => route.fulfill({ body: prompt }));
    await page.goto('/');
    await page.getByRole('button', { name: '＋ Nueva evaluación' }).click();
    const processEditor = page.getByRole('textbox', { name: 'Prompt de proceso', exact: true });
    await expect(processEditor).toBeEnabled();
    await processEditor.fill('Mi borrador pendiente');
    await page.getByRole('button', { name: /^Evaluaciones/ }).click();
    const readsBefore = sourceReads;
    await page
      .getByRole('button', { name: 'Ver configuración de run 002 de historical-campaign' })
      .click();
    await expect(page.getByRole('heading', { name: 'Configuración · Run 002' })).toBeVisible();
    await expect(processEditor).toBeDisabled();
    await expect(processEditor).toHaveValue(retained ? prompt : '');
    await expect(page.getByRole('textbox', { name: 'Especificación', exact: true })).toHaveValue(
      retained ? specification : '',
    );
    await expect(page.getByLabel('Tarea de referencia')).toHaveValue('historical-task');
    await expect(page.getByLabel('Modelo', { exact: true })).toHaveValue('historical-model');
    await expect(page.getByLabel('Código de partida · rama o commit')).toHaveValue('frozen-commit');
    const form = page.getByRole('form', { name: 'Configuración de la run' });
    for (const input of await form.locator('input, select, textarea').all())
      await expect(input).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Guardar receta', exact: true })).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: '▶ Ejecutar evaluación', exact: true }),
    ).toHaveCount(0);
    await page
      .locator('.source-editor')
      .filter({ has: page.getByRole('heading', { name: 'Prompt de proceso', exact: true }) })
      .getByRole('button', { name: 'Ampliar' })
      .click();
    const expanded = page.getByRole('dialog', { name: 'Prompt de proceso', exact: true });
    await expect(expanded.getByRole('textbox')).toBeDisabled();
    await expect(expanded.getByRole('textbox')).toHaveValue(retained ? prompt : '');
    await page.keyboard.press('Escape');
    expect(sourceReads).toBe(readsBefore);
    expect(writes).toBe(0);
    await page.getByRole('button', { name: 'Volver a evaluaciones' }).click();
    await page.getByRole('button', { name: 'Abrir run 002 de historical-campaign' }).click();
    await page.getByRole('button', { name: 'Ver configuración', exact: true }).click();
    await expect(processEditor).toBeDisabled();
    await page.getByRole('button', { name: 'Recetas', exact: true }).click();
    await expect(processEditor).toBeEnabled();
    await expect(processEditor).toHaveValue('Mi borrador pendiente');
  });
}

import { expect, test } from './fixtures';

// Controlled campaign responses exercise table presentation and local view persistence.
// Model execution and runner correctness are outside this browser test.
test('vistas compactas, selección de columnas y vista personalizada sobreviven a recarga', async ({
  page,
}) => {
  await page.route('**/api/campaigns', (route) =>
    route.fulfill({
      json: [
        {
          id: '2026-09-15-legacy-comparison',
          status: 'evaluated',
          config: {
            task: 'advanced-filters',
            model: 'gpt-test',
            harness: 'codex',
            effort: 'high',
            skills: ['hoteles-testing'],
            initialSkills: ['abordar-tarea'],
            candidateChecks: ['tests'],
            baseline: 'experiment/legacy',
            concurrency: 1,
          },
          baselineCommit: '1234567890abcdef',
          inputProvenance: {
            specificationSha256: 'abc123specification',
            promptSha256: 'def456prompt',
          },
          runs: [
            {
              id: '001',
              status: 'evaluated',
              startedAt: '2026-09-15T12:00:00Z',
              finishedAt: '2026-09-15T12:02:12Z',
              passed: true,
              estimatedApiCostUsd: 0.12,
            },
          ],
        },
      ],
    }),
  );
  await page.goto('/');
  const table = page.getByRole('table', { name: 'Ejecuciones', exact: true });
  await expect(table.getByRole('columnheader')).toHaveCount(10);
  await expect(table.getByRole('columnheader', { name: 'Modelo', exact: true })).toBeVisible();
  const overflow = await page
    .locator('.runs-grid-scroll')
    .evaluate((element) => element.scrollWidth > element.clientWidth);
  expect(overflow).toBe(false);

  await page.getByRole('button', { name: 'Arnés', exact: true }).click();
  await expect(
    table.getByRole('columnheader', { name: 'Skills iniciales', exact: true }),
  ).toBeVisible();
  await expect(table).toContainText('abordar-tarea');
  await page.getByRole('button', { name: 'Resumen', exact: true }).click();
  await page.locator('.runs-columns > summary').click();
  await page.getByLabel('Buscar columnas').fill('Modelo');
  await page.getByRole('checkbox', { name: 'Modelo', exact: true }).uncheck();
  await expect(table.getByRole('columnheader', { name: 'Modelo', exact: true })).toHaveCount(0);
  await page.getByLabel('Nombre de la vista').fill('Revisión de filtros');
  await page.getByRole('button', { name: 'Guardar vista', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('Vista guardada')).toHaveValue('Revisión de filtros');
  await expect(table.getByRole('columnheader', { name: 'Modelo', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Resumen', exact: true }).click();
  await expect(table.getByRole('columnheader', { name: 'Modelo', exact: true })).toBeVisible();
  await page.getByLabel('Vista guardada').selectOption('Revisión de filtros');
  await expect(table.getByRole('columnheader', { name: 'Modelo', exact: true })).toHaveCount(0);
  await page.getByLabel('Buscar ejecuciones').fill('ninguna-coincidencia');
  await expect(table).toContainText('Sin ejecuciones');
  await page.reload();
  await expect(page.getByLabel('Buscar ejecuciones')).toHaveValue('ninguna-coincidencia');
  await page.getByLabel('Buscar ejecuciones').fill('experiment/legacy');
  await expect(table).toContainText('advanced-filters');

  await page.locator('.runs-columns > summary').click();
  await page
    .getByRole('button', { name: 'Eliminar vista «Revisión de filtros»', exact: true })
    .click();
  await expect(page.getByLabel('Vista guardada')).toHaveCount(0);
  await expect(table.getByRole('columnheader', { name: 'Modelo', exact: true })).toBeVisible();
});

test('migra las vistas antiguas sin perder las personalizadas', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'harness-lab.run-table.v1',
      JSON.stringify({
        active: 'Resumen',
        columns: [
          'startedAt',
          'status',
          'task',
          'model',
          'score',
          'estimatedApiCostUsd',
          'duration',
        ],
        custom: [{ name: 'Mi comparación', columns: ['passed', 'model', 'estimatedApiCostUsd'] }],
        sort: { key: 'passed', descending: true },
      }),
    );
  });
  await page.goto('/');
  const table = page.getByRole('table', { name: 'Ejecuciones', exact: true });
  await expect(table.getByRole('columnheader', { name: 'Tests', exact: true })).toBeVisible();
  await page.getByLabel('Vista guardada').selectOption('Mi comparación');
  await expect(table.getByRole('columnheader').first()).toHaveText('Estado');
  await expect(table.getByRole('columnheader', { name: 'Modelo', exact: true })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'Resultado', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('Vista guardada')).toHaveValue('Mi comparación');
});

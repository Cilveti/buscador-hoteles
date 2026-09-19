import { expect, test } from './fixtures';

test('quality scores coexist with real failures and explicit evaluation errors', async ({
  page,
}) => {
  await page.route('**/api/campaigns', (route) =>
    route.fulfill({
      json: [
        {
          id: 'quality-fixture',
          status: 'completed',
          config: { task: 'advanced-filters', model: 'gpt-5.6-luna' },
          runs: [
            {
              id: '001',
              status: 'evaluated',
              score: 6.8,
              outcome: 'fail',
              passed: false,
              repositoryChecksPassed: true,
              candidateTestsPassed: true,
              privateAcceptancePassed: true,
            },
            {
              id: '002',
              status: 'evaluated',
              score: 8,
              outcome: 'pass',
              passed: true,
              repositoryChecksPassed: true,
            },
            {
              id: '004',
              status: 'evaluated',
              score: 8.2,
              outcome: 'fail',
              passed: false,
              repositoryChecksPassed: true,
              privateAcceptancePassed: false,
            },
            { id: '005', status: 'evaluated' },
            { id: '006', status: 'running' },
            {
              id: '003',
              status: 'incomplete',
              score: null,
              outcome: 'evaluation_error',
              passed: null,
            },
          ],
        },
      ],
    }),
  );
  await page.goto('/');
  const table = page.getByRole('table', { name: 'Ejecuciones', exact: true });
  await expect(table).toContainText('6.8 / 10');
  await expect(table).toContainText('8.0 / 10');
  const headers = table.getByRole('columnheader');
  await expect(headers.first()).toHaveText('Estado');
  await expect(headers.nth(8)).toHaveText('Coste est.');
  await expect(table.getByRole('columnheader', { name: 'Resultado', exact: true })).toHaveCount(0);
  await expect(table.getByRole('columnheader', { name: 'Nota juez', exact: true })).toBeVisible();
  const run = (id: string) =>
    table.getByRole('row').filter({
      has: page.getByRole('button', { name: `Abrir run ${id} de quality-fixture`, exact: true }),
    });
  await expect(run('001').getByRole('cell').first()).toHaveText('Evaluada · fallida');
  await expect(run('001')).toContainText('Correctos');
  await expect(run('002').getByRole('cell').first()).toHaveText('Evaluada · exitosa');
  await expect(run('004')).toContainText('Fallidos');
  await expect(run('004')).toContainText('8.2 / 10');
  await expect(run('003').getByRole('cell').first()).toHaveText('Error de evaluación');
  await expect(run('003')).toContainText('Sin concluir');
  await expect(run('005').getByRole('cell').first().locator('.status')).toHaveClass('status info');
  await expect(run('006').getByRole('cell').first().locator('.spinner')).toBeVisible();
  await expect(run('006')).toContainText('Pendientes');
  await page.getByRole('button', { name: 'Verificación', exact: true }).click();
  await expect(table.getByRole('columnheader').first()).toHaveText('Estado');
  await expect(run('001')).toContainText('Evaluada · fallida');
  await expect(run('002')).toContainText('Evaluada · exitosa');
});

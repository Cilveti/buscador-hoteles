import { expect, test } from './fixtures';

test('la receta distingue agente único de workflow y muestra su spec pública', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '＋ Nueva evaluación' }).click();
  await page.getByRole('combobox', { name: /^Candidato/ }).selectOption('workflow');
  await page.getByLabel('Tarea de referencia').selectOption('review-order');
  await expect(page.getByLabel('Spec pública del workflow')).toHaveValue(
    'evals/coding/tasks/review-order/workflow-spec.json',
  );
  await expect(page.getByRole('textbox', { name: 'Prompt de proceso' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '▶ Ejecutar evaluación' })).toBeEnabled();
  await page.getByRole('combobox', { name: /^Candidato/ }).selectOption('single-agent');
  await expect(page.getByRole('textbox', { name: 'Prompt de proceso' })).toBeVisible();
});

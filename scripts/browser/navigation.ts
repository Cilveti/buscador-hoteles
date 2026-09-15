import type { Page } from '@playwright/test';

export const destinations = {
  search: '/',
  hotels: '/admin/collections/hotels',
  users: '/admin/collections/users',
} as const;

export async function loginAdmin(page: Page) {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Preparar primero el administrador local con seed.');
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/admin');
}

export async function navigateTo(page: Page, destination: keyof typeof destinations) {
  if (destination !== 'search') await loginAdmin(page);
  await page.goto(destinations[destination]);
  await page.getByRole('heading', { level: 1 }).waitFor();
}

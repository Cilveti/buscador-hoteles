import { chromium } from '@playwright/test';
import { destinations, navigateTo } from './navigation';

const target = process.argv[2] ?? 'hotels';
function isDestination(value: string): value is keyof typeof destinations {
  return value in destinations;
}
if (!isDestination(target))
  throw new Error(`Destino esperado: ${Object.keys(destinations).join(', ')}`);
const baseURL = 'http://127.0.0.1:3101';
try {
  const response = await fetch(`${baseURL}/api/health`, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error('Servidor no disponible');
} catch {
  throw new Error('Arranca primero la aplicación completa con bun run dev:full.');
}
const browser = await chromium.launch({ channel: 'chrome', headless: false });
const context = await browser.newContext({ baseURL });
const page = await context.newPage();
try {
  await navigateTo(page, target);
} catch (error) {
  await browser.close();
  throw error;
}
console.log(`Página ${target} preparada. Cierra esta ventana de Chrome para terminar la sesión.`);
await new Promise<void>((resolve) => browser.once('disconnected', () => resolve()));

import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { CatalogEmptyState } from './catalog-empty-state';

const markup = () => renderToStaticMarkup(<CatalogEmptyState onReset={() => undefined} />);

test('el estado sin resultados es una región accesible con título, ayuda y recuperación', () => {
  const html = markup();
  expect(html).toContain('aria-labelledby="catalog-empty-title"');
  expect(html).toContain('id="catalog-empty-title"');
  expect(html).toContain('Todavía no hemos encontrado tu hotel');
  expect(html).toContain('Prueba otro destino o amplía los filtros para descubrir más opciones.');
  expect(html).toContain('Ver todos los hoteles');
  expect(html).toContain('<section');
});

test('el icono decorativo del estado sin resultados queda oculto a lectores de pantalla', () => {
  expect(markup()).toContain('aria-hidden="true"');
});

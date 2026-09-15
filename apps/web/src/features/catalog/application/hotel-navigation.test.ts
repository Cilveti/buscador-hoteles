import { expect, test } from 'bun:test';
import { hotelHref, resultsHref } from './hotel-navigation';
import { readQuery } from './query';

test('la ficha conserva búsqueda, filtros y página al volver a resultados', () => {
  const query = readQuery(new URLSearchParams('q=Málaga&country=Spain&sort=rating&page=2'));
  const href = hotelHref('7343', query);
  expect(href).toBe('/hotels/7343?q=M%C3%A1laga&country=Spain&sort=rating&page=2');
  expect(resultsHref(new URLSearchParams(href.split('?')[1]))).toBe(
    '/?q=M%C3%A1laga&country=Spain&sort=rating&page=2',
  );
});

test('el retorno admite solo parámetros del catálogo y permanece en el listado local', () => {
  expect(resultsHref(new URLSearchParams('returnTo=https://example.com&q=playa'))).toBe(
    '/?q=playa',
  );
  expect(resultsHref(new URLSearchParams('page=-1'))).toBe('/');
});

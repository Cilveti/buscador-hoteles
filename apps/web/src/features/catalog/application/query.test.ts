import { expect, test } from 'bun:test';
import { changeQuery, readQuery, serializeQuery } from './query';

test('cambiar un filtro vuelve a la primera página y conserva la búsqueda', () => {
  const current = readQuery(new URLSearchParams('q=Malaga&page=3&pageSize=12'));
  expect(changeQuery(current, { country: 'Spain' })).toMatchObject({
    q: 'Malaga',
    country: 'Spain',
    page: 1,
    pageSize: 12,
  });
});

test('una búsqueda se puede compartir por URL sin perder filtros', () => {
  const query = readQuery(
    new URLSearchParams('q=Málaga&country=Spain&minRating=4&sort=rating&page=2'),
  );
  expect(readQuery(new URLSearchParams(serializeQuery(query)))).toEqual(query);
  expect(serializeQuery(query)).not.toContain('undefined');
});

test('una URL inválida recupera un estado válido sin romper la pantalla', () => {
  expect(readQuery(new URLSearchParams('page=-3&minRating=banana'))).toMatchObject({
    page: 1,
    sort: 'name',
  });
});

test('restaura todos los atributos de una dirección compartida', () => {
  const query = readQuery(
    new URLSearchParams(
      'country=Spain&sort=rating&destination=city%2Fmalaga&stars=5&services=pool%2Cparking&themes=beach&pets=allowed-or-conditional',
    ),
  );
  expect(query).toMatchObject({
    country: 'Spain',
    sort: 'rating',
    destination: 'city/malaga',
    stars: 5,
    services: ['pool', 'parking'],
    themes: ['beach'],
    pets: 'allowed-or-conditional',
  });
  expect(readQuery(new URLSearchParams(serializeQuery(query)))).toEqual(query);
  expect(serializeQuery(changeQuery(query, { services: [], themes: [] }))).not.toMatch(
    /services|themes/,
  );
});

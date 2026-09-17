import { expect, test } from 'bun:test';
import { hotelSlug } from './hotel-slug';

test('normaliza espacios y produce slug en minúsculas separado por guiones', () => {
  expect(hotelSlug('  Hotel Costa Azul  ')).toBe('hotel-costa-azul');
});

test('translitera tildes y convierte el ampersand en "and"', () => {
  expect(hotelSlug('Montaña & Mar')).toBe('montana-and-mar');
  expect(hotelSlug('Ático Norte')).toBe('atico-norte');
});

test('cadena vacía o solo espacios devuelve cadena vacía', () => {
  expect(hotelSlug('')).toBe('');
  expect(hotelSlug('   ')).toBe('');
});

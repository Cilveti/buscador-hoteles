import { describe, expect, it } from 'bun:test';

import { hotelSlug } from './hotel-slug';

describe('hotelSlug', () => {
  it('convierte el nombre en identificador de URL en minúsculas separadas por guion', () => {
    expect(hotelSlug('  Hotel Costa Azul  ')).toBe('hotel-costa-azul');
  });

  it('sustituye símbolos por "and" y elimina la puntuación restante', () => {
    expect(hotelSlug('Montaña & Mar')).toBe('montana-and-mar');
  });

  it('translitera tildes y diacríticos', () => {
    expect(hotelSlug('Ático Norte')).toBe('atico-norte');
  });

  it('devuelve cadena vacía para nombres vacíos o de solo espacios', () => {
    expect(hotelSlug('')).toBe('');
    expect(hotelSlug('   ')).toBe('');
  });
});

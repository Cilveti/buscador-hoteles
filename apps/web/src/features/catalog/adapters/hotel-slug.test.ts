import { describe, expect, it } from 'bun:test';
import { hotelSlug } from './hotel-slug';

describe('hotelSlug', () => {
  it('convierte un nombre con espacios sobrantes en un slug limpio', () => {
    expect(hotelSlug('  Hotel Costa Azul  ')).toBe('hotel-costa-azul');
  });

  it('elimina puntuación y translitera el ampersand como conector', () => {
    expect(hotelSlug('Montaña & Mar')).toBe('montana-and-mar');
  });

  it('translitera tildes a ASCII en minúsculas', () => {
    expect(hotelSlug('Ático Norte')).toBe('atico-norte');
  });

  it('devuelve cadena vacía para una cadena vacía', () => {
    expect(hotelSlug('')).toBe('');
  });

  it('devuelve cadena vacía para una cadena de solo espacios', () => {
    expect(hotelSlug('     ')).toBe('');
  });
});

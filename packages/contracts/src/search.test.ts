import { describe, expect, test } from 'bun:test';
import { StaySearchSchema } from './search';

const search = {
  hotelId: '7333',
  checkIn: '2028-02-29',
  checkOut: '2028-03-02',
  rooms: [{ adults: 2, childrenAges: [5, 7] }],
  currency: 'EUR',
};

describe('stay search application contract', () => {
  test('accepts leap days and multiple children without imposing provider limitations', () => {
    expect(StaySearchSchema.parse(search)).toEqual(search);
  });

  test.each([
    '2026-02-29',
    '2028-02-30',
    '2028-04-31',
    '2028-13-01',
    '2028-00-01',
    '2028-1-01',
    '2028-01-01T00:00:00Z',
  ])('rejects invalid calendar date %s', (checkIn) =>
    expect(StaySearchSchema.safeParse({ ...search, checkIn }).success).toBe(false),
  );

  test.each(['2028-02-28', '2028-02-29'])('checkout must follow checkin: %s', (checkOut) => {
    expect(StaySearchSchema.safeParse({ ...search, checkOut }).success).toBe(false);
  });

  test('does not invent dates, occupancy or child ages', () => {
    expect(StaySearchSchema.safeParse({ hotelId: '7333' }).success).toBe(false);
    expect(StaySearchSchema.safeParse({ ...search, rooms: [] }).success).toBe(false);
    expect(StaySearchSchema.safeParse({ ...search, rooms: [{ adults: 2 }] }).success).toBe(false);
    expect(
      StaySearchSchema.safeParse({ ...search, rooms: [{ adults: 0, childrenAges: [5] }] }).success,
    ).toBe(false);
    expect(
      StaySearchSchema.safeParse({ ...search, rooms: [{ adults: 1.5, childrenAges: [] }] }).success,
    ).toBe(false);
    expect(
      StaySearchSchema.safeParse({ ...search, rooms: [{ adults: 2, childrenAges: [-1] }] }).success,
    ).toBe(false);
    expect(
      StaySearchSchema.safeParse({ ...search, rooms: [{ adults: 2, childrenAges: [5.5] }] })
        .success,
    ).toBe(false);
  });
});

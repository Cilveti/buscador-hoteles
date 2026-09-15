import { describe, expect, test } from 'bun:test';
import { canOccupyRoom } from './eligibility';

describe('room eligibility', () => {
  const capacity = { maxAdults: 2, maxChildren: 1, maxGuests: 2 };
  test('enforces total guests independently of adult and child limits', () => {
    expect(canOccupyRoom({ adults: 2, childrenAges: [5] }, capacity, 13)).toBe(false);
    expect(canOccupyRoom({ adults: 1, childrenAges: [5] }, capacity, 13)).toBe(true);
    expect(canOccupyRoom({ adults: 2, childrenAges: [] }, capacity, 13)).toBe(true);
  });
  test('enforces every partial limit even when total capacity is available', () => {
    expect(canOccupyRoom({ adults: 3, childrenAges: [] }, { ...capacity, maxGuests: 5 }, 13)).toBe(
      false,
    );
    expect(
      canOccupyRoom({ adults: 1, childrenAges: [3, 5] }, { ...capacity, maxGuests: 5 }, 13),
    ).toBe(false);
  });
  test('uses the hotel age boundary without silently reclassifying guests', () => {
    expect(canOccupyRoom({ adults: 1, childrenAges: [12] }, capacity, 13)).toBe(true);
    expect(canOccupyRoom({ adults: 1, childrenAges: [13] }, capacity, 13)).toBe(false);
    expect(canOccupyRoom({ adults: 1, childrenAges: [13] }, capacity, 18)).toBe(true);
  });

  test('accepts babies represented by age zero', () => {
    expect(canOccupyRoom({ adults: 1, childrenAges: [0] }, capacity, 13)).toBe(true);
  });

  test('requires at least one whole adult', () => {
    expect(canOccupyRoom({ adults: 0, childrenAges: [5] }, capacity, 13)).toBe(false);
    expect(canOccupyRoom({ adults: 1.5, childrenAges: [] }, capacity, 13)).toBe(false);
  });

  test('does not admit negative or fractional child ages', () => {
    expect(canOccupyRoom({ adults: 1, childrenAges: [-1] }, capacity, 13)).toBe(false);
    expect(canOccupyRoom({ adults: 1, childrenAges: [4.5] }, capacity, 13)).toBe(false);
  });
});

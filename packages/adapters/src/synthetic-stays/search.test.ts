import { describe, expect, test } from 'bun:test';
import { StaySearchSchema } from '@hoteles/contracts/search';
import { syntheticStayFixtures } from './fixtures';
import { createSyntheticStaySearch } from './search';

const query = StaySearchSchema.parse({
  hotelId: 'synthetic-courtyard',
  checkIn: '2027-03-27',
  checkOut: '2027-03-29',
  rooms: [{ adults: 2, childrenAges: [] }],
  currency: 'EUR',
});

describe('synthetic stay search', () => {
  const search = createSyntheticStaySearch(syntheticStayFixtures);

  test('quotes exact nightly integer prices across a DST change and labels simulation', async () => {
    const offers = await search.search(query);
    const twin = offers.find((offer) => offer.rooms[0]?.roomTypeId === 'synthetic-twin');
    expect(twin?.total).toEqual({ value: 20003, currency: 'EUR', exponent: 2 });
    expect(twin?.rooms[0]?.nightly.map((night) => night.date)).toEqual([
      '2027-03-27',
      '2027-03-28',
    ]);
    expect(twin?.source).toEqual({ kind: 'synthetic', fixtureVersion: 'synthetic-v1' });
  });

  test('does not offer a two-guest room to two adults and a child', async () => {
    const offers = await search.search({ ...query, rooms: [{ adults: 2, childrenAges: [5] }] });
    expect(offers.map((offer) => offer.rooms.map((room) => room.roomTypeId))).toEqual([
      ['synthetic-family'],
    ]);
  });

  test('allocates inventory jointly across all requested rooms without consuming it', async () => {
    const twoRooms = {
      ...query,
      rooms: [
        { adults: 1, childrenAges: [] },
        { adults: 1, childrenAges: [] },
      ],
    };
    const offers = await search.search(twoRooms);
    expect(offers.map((offer) => offer.rooms.map((room) => room.roomTypeId))).toEqual([
      ['synthetic-twin', 'synthetic-family'],
      ['synthetic-family', 'synthetic-twin'],
    ]);
    expect(offers.map((offer) => offer.total.value)).toEqual([51003, 51003]);
    expect(await search.search(twoRooms)).toEqual(offers);
    expect(
      await search.search({
        ...twoRooms,
        rooms: [...twoRooms.rooms, { adults: 1, childrenAges: [] }],
      }),
    ).toEqual([]);
  });

  test('requires price and inventory for every night instead of extrapolating missing dates', async () => {
    expect(await search.search({ ...query, checkOut: '2027-03-30' })).toEqual([]);
    expect(await search.search({ ...query, hotelId: 'unknown-hotel' })).toEqual([]);
    expect(await search.search({ ...query, currency: 'USD' })).toEqual([]);
  });
});

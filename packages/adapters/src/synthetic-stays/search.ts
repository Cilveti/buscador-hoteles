import { StaySearchSchema } from '@hoteles/contracts/search';
import {
  canOccupyRoom,
  type Money,
  type StayOffer,
  type StaySearchPort,
} from '@hoteles/core/search';
import type { SyntheticStayFixtures } from './fixtures';

export type { SyntheticStayFixtures } from './fixtures';
export { syntheticStayFixtures } from './fixtures';

type RoomSelection = StayOffer['rooms'][number];
type Candidate = { selection: RoomSelection; inventory: number };

function stayDates(checkIn: string, checkOut: string): string[] {
  const dates: string[] = [];
  const checkout = Date.parse(`${checkOut}T00:00:00Z`);
  for (
    let timestamp = Date.parse(`${checkIn}T00:00:00Z`);
    timestamp < checkout;
    timestamp += 86_400_000
  ) {
    dates.push(new Date(timestamp).toISOString().slice(0, 10));
  }
  return dates;
}

/** A local quote source with joint room allocation. Searches do not decrement its fixture inventory. */
export function createSyntheticStaySearch(fixtures: SyntheticStayFixtures): StaySearchPort {
  const money = (value: number): Money => {
    if (!Number.isSafeInteger(value) || value < 0)
      throw new RangeError('Synthetic prices require nonnegative safe minor units');
    return { value, currency: fixtures.currency, exponent: fixtures.exponent };
  };

  return {
    async search(input) {
      const query = StaySearchSchema.parse(input);
      const hotel = fixtures.hotels.find((entry) => entry.id === query.hotelId);
      if (!hotel || query.currency !== fixtures.currency) return [];
      const dates = stayDates(query.checkIn, query.checkOut);

      const candidates = query.rooms.map((occupancy, requestRoomIndex) =>
        hotel.roomTypes.flatMap((room): Candidate[] => {
          if (!canOccupyRoom(occupancy, room.capacity, hotel.minimumAdultAge)) return [];
          const nightly: Array<RoomSelection['nightly'][number]> = [];
          let inventory = Number.POSITIVE_INFINITY;
          for (const date of dates) {
            const availability = room.nights[date];
            if (!availability || availability.inventory < 1) return [];
            inventory = Math.min(inventory, availability.inventory);
            nightly.push({ date, total: money(availability.totalMinor) });
          }
          return [
            {
              inventory,
              selection: {
                requestRoomIndex,
                roomTypeId: room.id,
                roomName: room.name,
                occupancy,
                nightly,
              },
            },
          ];
        }),
      );

      const offers: StayOffer[] = [];
      const usedInventory = new Map<string, number>();
      const selected: RoomSelection[] = [];

      function assignRoom(index: number): void {
        if (index === candidates.length) {
          const totalMinor = selected.reduce(
            (total, room) =>
              total + room.nightly.reduce((subtotal, night) => subtotal + night.total.value, 0),
            0,
          );
          offers.push({
            hotelId: query.hotelId,
            checkIn: query.checkIn,
            checkOut: query.checkOut,
            rooms: [...selected],
            total: money(totalMinor),
            source: { kind: 'synthetic', fixtureVersion: fixtures.version },
          });
          return;
        }
        for (const candidate of candidates[index] ?? []) {
          const id = candidate.selection.roomTypeId;
          const used = usedInventory.get(id) ?? 0;
          if (used >= candidate.inventory) continue;
          usedInventory.set(id, used + 1);
          selected.push(candidate.selection);
          assignRoom(index + 1);
          selected.pop();
          usedInventory.set(id, used);
        }
      }

      assignRoom(0);
      return offers;
    },
  };
}

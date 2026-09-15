export type RoomOccupancy = Readonly<{ adults: number; childrenAges: readonly number[] }>;

export type RoomCapacity = Readonly<{ maxAdults: number; maxChildren: number; maxGuests: number }>;

export type StayQuery = Readonly<{
  hotelId: string;
  checkIn: string;
  checkOut: string;
  rooms: readonly RoomOccupancy[];
  currency: string;
}>;

export type Money = Readonly<{ value: number; currency: string; exponent: number }>;

export type StayOffer = Readonly<{
  hotelId: string;
  checkIn: string;
  checkOut: string;
  rooms: readonly Readonly<{
    requestRoomIndex: number;
    roomTypeId: string;
    roomName: string;
    occupancy: RoomOccupancy;
    nightly: readonly Readonly<{ date: string; total: Money }>[];
  }>[];
  total: Money;
  source: Readonly<{ kind: 'synthetic'; fixtureVersion: string }>;
}>;

/** Searches are quotes only. A successful quote does not reserve or mutate inventory. */
export type StaySearchPort = { search(query: StayQuery): Promise<readonly StayOffer[]> };

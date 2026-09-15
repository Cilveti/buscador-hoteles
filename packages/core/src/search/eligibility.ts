import type { RoomCapacity, RoomOccupancy } from './types';

/** Hotel-specific child ages and partial limits must also satisfy the total room capacity. */
export function canOccupyRoom(
  occupancy: RoomOccupancy,
  capacity: RoomCapacity,
  minimumAdultAge: number,
): boolean {
  return (
    Number.isSafeInteger(occupancy.adults) &&
    occupancy.adults >= 1 &&
    occupancy.adults <= capacity.maxAdults &&
    occupancy.childrenAges.length <= capacity.maxChildren &&
    occupancy.adults + occupancy.childrenAges.length <= capacity.maxGuests &&
    occupancy.childrenAges.every(
      (age) => Number.isSafeInteger(age) && age >= 0 && age < minimumAdultAge,
    )
  );
}

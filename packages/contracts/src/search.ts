import { z } from 'zod';

const calendarDate = z.iso
  .date()
  .refine((date) => !date.startsWith('0000'), 'A calendar date must have a positive year');

export const RoomOccupancySchema = z.strictObject({
  adults: z.number().int().positive(),
  // Ages are supplied at checkout. Hotel-specific age boundaries belong to eligibility.
  childrenAges: z.array(z.number().int().nonnegative()),
});

/** Complete deterministic search input. Missing information belongs to the clarification flow. */
export const StaySearchSchema = z
  .strictObject({
    hotelId: z.string().trim().min(1),
    checkIn: calendarDate,
    checkOut: calendarDate,
    rooms: z.array(RoomOccupancySchema).min(1),
    currency: z.string().regex(/^[A-Z]{3}$/, 'Expected a three-letter currency code'),
  })
  .refine((search) => search.checkOut > search.checkIn, {
    message: 'Checkout must follow checkin',
    path: ['checkOut'],
  });

export type StaySearch = z.infer<typeof StaySearchSchema>;

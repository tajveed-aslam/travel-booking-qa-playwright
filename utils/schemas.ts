import { z } from 'zod';

/** Response contracts for Restful-Booker, as observed from the live API (see docs/AI_WORKFLOW.md, exploration). */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

export const bookingSchema = z
  .object({
    firstname: z.string().min(1),
    lastname: z.string().min(1),
    totalprice: z.number(),
    depositpaid: z.boolean(),
    bookingdates: z.object({ checkin: isoDate, checkout: isoDate }).strict(),
    additionalneeds: z.string().optional(),
  })
  .strict();

export const createdBookingSchema = z
  .object({
    bookingid: z.number().int().positive(),
    booking: bookingSchema,
  })
  .strict();

export const bookingIdListSchema = z.array(z.object({ bookingid: z.number().int().positive() }).strict());

export const tokenSchema = z.object({ token: z.string().min(10) }).strict();

export const badCredentialsSchema = z.object({ reason: z.literal('Bad credentials') }).strict();

export type BookingResponse = z.infer<typeof bookingSchema>;
export type CreatedBooking = z.infer<typeof createdBookingSchema>;

/**
 * Test data builders. Each call returns fresh, unique data so tests never depend on each other or on shared records,
 * and can run in parallel. Override any field per test: `aBooking({ totalprice: 99.99 })`.
 */
import { randomUUID } from 'node:crypto';

const uid = () => randomUUID().slice(0, 8);

// ---------------------------------------------------------------- UI: passenger + card for the BlazeDemo purchase form
export type CardType = 'visa' | 'amex' | 'dinersclub';

export interface Passenger {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  cardType: CardType;
  cardNumber: string;
  month: string;
  year: string;
  nameOnCard: string;
  rememberMe: boolean;
}

/** Standard test card numbers (never real cards). */
export const TEST_CARDS: Record<CardType, string> = {
  visa: '4111111111111111',
  amex: '378282246310005',
  dinersclub: '30569309025904',
};

export function aPassenger(overrides: Partial<Passenger> = {}): Passenger {
  const cardType = overrides.cardType ?? 'visa';
  const name = overrides.name ?? `Ayesha Traveller ${uid()}`;
  return {
    name,
    address: '12 Mall Road',
    city: 'Lahore',
    state: 'Punjab',
    zipCode: '54000',
    cardType,
    cardNumber: TEST_CARDS[cardType],
    month: '12',
    year: String(new Date().getFullYear() + 2),
    nameOnCard: name,
    rememberMe: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------- API: Restful-Booker booking payload
export interface BookingDates {
  checkin: string;
  checkout: string;
}

export interface Booking {
  firstname: string;
  lastname: string;
  totalprice: number;
  depositpaid: boolean;
  bookingdates: BookingDates;
  additionalneeds?: string;
}

/** YYYY-MM-DD, `days` from today (UTC), so bookings are always in the future. */
export function isoDate(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function aBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    firstname: 'Qa',
    // A unique last name lets a test find exactly its own booking with the name filter.
    lastname: `Traveller${uid()}`,
    totalprice: 432,
    depositpaid: true,
    bookingdates: { checkin: isoDate(30), checkout: isoDate(34) },
    additionalneeds: 'Breakfast',
    ...overrides,
  };
}

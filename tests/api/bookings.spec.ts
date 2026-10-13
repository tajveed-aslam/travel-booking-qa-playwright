import { bug, expect, test } from '../../fixtures';
import type { BookingApi } from '../../utils/BookingApi';
import { aBooking, isoDate } from '../../utils/builders';
import { bookingIdListSchema, bookingSchema } from '../../utils/schemas';

test.describe('Bookings: create, read, list', { tag: ['@api', '@regression'] }, () => {
  test('create returns the stored booking in the documented shape', { tag: '@smoke' }, async ({ api, cleanup }) => {
    const booking = aBooking();
    const res = await api.create(booking);
    // Note: 200, not 201 Created. Recorded as an observation in docs/BUG_REPORTS.md (OBS-API-02).
    expect(res.status()).toBe(200);
    const body = await res.json();
    cleanup(body.bookingid);
    expect(body.booking).toEqual(booking);
  });

  test('get by id returns exactly what was created', async ({ api, cleanup }) => {
    const booking = aBooking({ totalprice: 1250, depositpaid: false, additionalneeds: 'Airport transfer' });
    const { bookingid } = await api.createBooking(booking);
    cleanup(bookingid);

    const res = await api.get(bookingid);
    expect(res.status()).toBe(200);
    expect(bookingSchema.parse(await res.json())).toEqual(booking);
  });

  test('get by an unknown id returns 404', async ({ api }) => {
    expect((await api.get(999_999_999)).status()).toBe(404);
  });

  test('list filtered by first and last name finds only that booking', async ({ api, cleanup }) => {
    const booking = aBooking();
    const { bookingid } = await api.createBooking(booking);
    cleanup(bookingid);

    const res = await api.list({ firstname: booking.firstname, lastname: booking.lastname });
    expect(res.status()).toBe(200);
    expect(bookingIdListSchema.parse(await res.json())).toEqual([{ bookingid }]);
  });

  test(
    'list filtered by dates: checkin is strictly "after", so a booking on the filter date is excluded',
    { annotation: bug('OBS-API-03') },
    async ({ api, cleanup }) => {
      const checkin = isoDate(40);
      const checkout = isoDate(44);
      const booking = aBooking({ bookingdates: { checkin, checkout } });
      const { bookingid } = await api.createBooking(booking);
      cleanup(bookingid);
      const ids = async (filters: Record<string, string>) =>
        bookingIdListSchema
          .parse(await (await api.list({ lastname: booking.lastname, ...filters })).json())
          .map((b) => b.bookingid);

      // A window around the stay finds it.
      expect(await ids({ checkin: isoDate(39), checkout: isoDate(45) })).toEqual([bookingid]);
      // Real behaviour: filtering on the exact check-in date does NOT return it (exclusive bound). A traveller searching
      // "bookings arriving on the 40th day" would miss it. Asserted as observed and documented.
      expect(await ids({ checkin })).toEqual([]);
      // A window that ends before the stay starts finds nothing.
      expect(await ids({ checkin: isoDate(10), checkout: isoDate(20) })).toEqual([]);
    },
  );
});

test.describe('Bookings: update with and without a token', { tag: ['@api', '@regression'] }, () => {
  test('PUT with a token replaces the booking', async ({ api, token, cleanup }) => {
    const { bookingid } = await api.createBooking(aBooking());
    cleanup(bookingid);
    const replacement = aBooking({ totalprice: 980, depositpaid: false, additionalneeds: 'Late checkout' });

    const res = await api.update(bookingid, replacement, token);
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual(replacement);
    expect(await (await api.get(bookingid)).json()).toEqual(replacement);
  });

  test('PATCH with a token changes only the fields sent', async ({ api, token, cleanup }) => {
    const original = aBooking();
    const { bookingid } = await api.createBooking(original);
    cleanup(bookingid);

    const res = await api.partialUpdate(bookingid, { totalprice: 610, additionalneeds: 'Dinner' }, token);
    expect(res.status()).toBe(200);
    expect(await (await api.get(bookingid)).json()).toEqual({
      ...original,
      totalprice: 610,
      additionalneeds: 'Dinner',
    });
  });

  const unauthenticated = {
    PUT: (api: BookingApi, id: number) => api.update(id, aBooking({ totalprice: 1 })),
    PATCH: (api: BookingApi, id: number) => api.partialUpdate(id, { totalprice: 1 }),
    DELETE: (api: BookingApi, id: number) => api.delete(id),
  };
  for (const [call, send] of Object.entries(unauthenticated)) {
    test(`${call} without a token is rejected with 403 and changes nothing`, async ({ api, cleanup }) => {
      const original = aBooking();
      const { bookingid } = await api.createBooking(original);
      cleanup(bookingid);

      expect((await send(api, bookingid)).status()).toBe(403);
      expect(await (await api.get(bookingid)).json()).toEqual(original);
    });
  }
});

test.describe('Cancellation flow', { tag: ['@api', '@regression'] }, () => {
  test(
    'create -> modify -> cancel (delete) -> the booking is gone',
    { tag: '@smoke' },
    async ({ api, token, cleanup }) => {
      const { bookingid } = await api.createBooking(aBooking());
      cleanup(bookingid);

      const modified = await api.partialUpdate(bookingid, { additionalneeds: 'Cancel if flight delayed' }, token);
      expect(modified.status()).toBe(200);

      const del = await api.delete(bookingid, token);
      // Real behaviour: 201 Created for a delete (OBS-API-02).
      expect(del.status()).toBe(201);

      expect((await api.get(bookingid)).status()).toBe(404);
      // A second delete of the same booking returns 405, not 404 (OBS-API-02).
      expect((await api.delete(bookingid, token)).status()).toBe(405);
      const list = bookingIdListSchema.parse(await (await api.list()).json());
      expect(list.map((b) => b.bookingid)).not.toContain(bookingid);
    },
  );
});

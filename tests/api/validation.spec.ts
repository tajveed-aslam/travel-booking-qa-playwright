import type { APIResponse } from '@playwright/test';
import { bug, expect, test } from '../../fixtures';
import { aBooking, isoDate } from '../../utils/builders';

/**
 * Negative cases. Restful-Booker validates almost nothing, so several of these document real defects:
 * each such test states the CORRECT behaviour and is marked `test.fail()` with its bug id. It passes while the defect
 * exists and turns red the day the API is fixed, so the expectation can be flipped. Nothing is skipped.
 */

/** If the API accepted the bad payload, register the booking for cleanup before asserting anything. */
async function track(res: APIResponse, cleanup: (id: number) => void) {
  if (res.status() !== 200) return;
  const body = await res.json().catch(() => null);
  if (body && typeof body.bookingid === 'number') cleanup(body.bookingid);
}

test.describe('Booking validation', { tag: ['@api', '@regression'] }, () => {
  const { firstname: _f, ...withoutFirstname } = aBooking();
  const { bookingdates: _d, ...withoutDates } = aBooking();
  const missing: [string, unknown][] = [
    ['firstname', withoutFirstname],
    ['bookingdates', withoutDates],
    ['everything (empty object)', {}],
  ];
  for (const [what, payload] of missing) {
    test(`missing ${what} is rejected with 400`, { annotation: bug('BUG-008') }, async ({ api, cleanup }) => {
      test.fail(true, 'BUG-008: missing required fields crash the server with 500 instead of a 400');
      const res = await api.create(payload);
      await track(res, cleanup);
      expect(res.status()).toBe(400);
    });
  }

  test('malformed JSON is rejected with 400', async ({ request }) => {
    const res = await request.post('/booking', { headers: { 'Content-Type': 'application/json' }, data: '{"firstname":' });
    expect(res.status()).toBe(400);
  });

  test('a non-numeric price is rejected', { annotation: bug('BUG-010') }, async ({ api, cleanup }) => {
    test.fail(true, 'BUG-010: totalprice "abc" is accepted and stored as null');
    const res = await api.create({ ...aBooking(), totalprice: 'abc' });
    await track(res, cleanup);
    expect(res.status()).toBe(400);
  });

  test('a non-boolean depositpaid is rejected', { annotation: bug('BUG-010') }, async ({ api, cleanup }) => {
    test.fail(true, 'BUG-010: depositpaid "yes" is coerced to true');
    const res = await api.create({ ...aBooking(), depositpaid: 'yes' });
    await track(res, cleanup);
    expect(res.status()).toBe(400);
  });

  test('check-out before check-in is rejected', { annotation: bug('BUG-011') }, async ({ api, cleanup }) => {
    test.fail(true, 'BUG-011: a stay that ends before it starts is accepted');
    const res = await api.create(aBooking({ bookingdates: { checkin: isoDate(50), checkout: isoDate(45) } }));
    await track(res, cleanup);
    expect(res.status()).toBe(400);
  });

  test('an unparseable date is rejected', { annotation: bug('BUG-012') }, async ({ api, cleanup }) => {
    test.fail(true, 'BUG-012: "not-a-date" is accepted and stored as "0NaN-aN-aN"');
    const res = await api.create(aBooking({ bookingdates: { checkin: 'not-a-date', checkout: '2026-13-45' } }));
    await track(res, cleanup);
    expect(res.status()).toBe(400);
  });

  test('a negative price is rejected', { annotation: bug('BUG-013') }, async ({ api, cleanup }) => {
    test.fail(true, 'BUG-013: totalprice -50 is accepted');
    const res = await api.create(aBooking({ totalprice: -50 }));
    await track(res, cleanup);
    expect(res.status()).toBe(400);
  });

  test('a price with cents is stored exactly', { annotation: bug('BUG-009') }, async ({ api, cleanup }) => {
    test.fail(true, 'BUG-009: 99.99 is silently stored as 99 (price accuracy)');
    const res = await api.create(aBooking({ totalprice: 99.99 }));
    await track(res, cleanup);
    expect(res.status()).toBe(200);
    expect((await res.json()).booking.totalprice).toBe(99.99);
  });
});

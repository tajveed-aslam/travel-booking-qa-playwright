import { bug, expect, test } from '../../fixtures';
import { env } from '../../utils/env';
import { badCredentialsSchema, tokenSchema } from '../../utils/schemas';

test.describe('Auth token', { tag: ['@api', '@regression'] }, () => {
  test('valid credentials return a token', { tag: '@smoke' }, async ({ api }) => {
    const res = await api.auth(env.apiUsername, env.apiPassword);
    expect(res.status()).toBe(200);
    tokenSchema.parse(await res.json());
  });

  test(
    'invalid credentials are refused, but with HTTP 200 instead of 401',
    { annotation: bug('OBS-API-01') },
    async ({ api }) => {
      for (const [username, password] of [
        [env.apiUsername, 'wrong-password'],
        ['nobody', env.apiPassword],
        ['', ''],
      ] as const) {
        const res = await api.auth(username, password);
        // Real behaviour: no token, a "Bad credentials" reason, and status 200 (an API client checking only the status
        // code would treat this as a successful login). Recorded as an observation, not hidden.
        expect(res.status()).toBe(200);
        badCredentialsSchema.parse(await res.json());
      }
    },
  );

  test('a made-up token cannot modify bookings', async ({ api, cleanup }) => {
    const { bookingid } = await api.createBooking({
      firstname: 'Qa',
      lastname: `TokenProbe${Date.now()}`,
      totalprice: 100,
      depositpaid: true,
      bookingdates: { checkin: '2027-01-10', checkout: '2027-01-12' },
    });
    cleanup(bookingid);
    const res = await api.partialUpdate(bookingid, { totalprice: 1 }, 'not-a-real-token');
    expect(res.status()).toBe(403);
    const after = await (await api.get(bookingid)).json();
    expect(after.totalprice).toBe(100);
  });
});

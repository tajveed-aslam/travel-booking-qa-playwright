import { bug, expect, test } from '../../fixtures';

import type { HomePage } from '../../pages/HomePage';
import type { ReservePage } from '../../pages/ReservePage';

const ROUTES = [
  { from: 'Paris', to: 'Rome' },
  { from: 'Boston', to: 'London' },
  { from: 'São Paolo', to: 'New York' },
];

/** Searches a route and checks the results table: heading, columns, and a well-formed row per flight. */
async function checkRoute(home: HomePage, reserve: ReservePage, from: string, to: string) {
  await home.open();
  await home.searchFlights(from, to);
  await reserve.expectLoaded(from, to);

  await expect(reserve.columnHeaders).toHaveText([
    'Choose',
    'Flight #',
    'Airline',
    `Departs: ${from}`,
    `Arrives: ${to}`,
    'Price',
  ]);
  await expect(reserve.rows).not.toHaveCount(0);
  for (const flight of await reserve.flights()) {
    expect(flight.flightNumber).toMatch(/^\d+$/);
    expect(flight.airline).not.toBe('');
    expect(flight.departs).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
    expect(flight.arrives).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
    expect(flight.priceText).toMatch(/^\$\d+\.\d{2}$/);
  }
  await expect(reserve.rows.getByRole('button', { name: 'Choose This Flight' })).toHaveCount(
    await reserve.rows.count(),
  );
}

test.describe('Flight search', { tag: ['@ui', '@regression'] }, () => {
  test('search Paris -> Rome lists flights with the expected columns', { tag: '@smoke' }, async ({ home, reserve }) => {
    await checkRoute(home, reserve, 'Paris', 'Rome');
  });

  for (const { from, to } of ROUTES.slice(1)) {
    test(`search ${from} -> ${to} lists flights with the expected columns`, async ({ home, reserve }) => {
      await checkRoute(home, reserve, from, to);
    });
  }

  test(
    'every route returns the same flights and prices (results ignore the search)',
    { annotation: bug('BUG-005') },
    async ({ home, reserve }) => {
      // Real behaviour, asserted as observed: the result set is static. For a booking platform this means the search
      // criteria never reach pricing/availability; recorded in docs/BUG_REPORTS.md.
      const results = [];
      for (const { from, to } of ROUTES.slice(0, 2)) {
        await home.open();
        await home.searchFlights(from, to);
        await reserve.expectLoaded(from, to);
        results.push(
          (await reserve.flights()).map(({ flightNumber, airline, priceText }) => ({
            flightNumber,
            airline,
            priceText,
          })),
        );
      }
      expect(results[1]).toEqual(results[0]);
    },
  );

  test('the UI cannot pick the same city as departure and destination', async ({ home }) => {
    // Real behaviour, found while exploring: the two dropdowns have no city in common, so a same-city trip can't be
    // chosen in the UI at all.
    await home.open();
    const departures = await home.departureOptions();
    const destinations = await home.destinationOptions();
    expect(departures.length).toBeGreaterThan(0);
    expect(departures.filter((city) => destinations.includes(city))).toEqual([]);
  });

  test('the server refuses a same-city search sent directly', { annotation: bug('BUG-005') }, async ({ page }) => {
    test.fail(true, 'BUG-005: POST reserve.php with Paris -> Paris returns a full list of bookable flights');
    // The form is only a client-side restriction; the server is what must enforce it. Sent as the browser would.
    const res = await page.request.post('/reserve.php', { form: { fromPort: 'Paris', toPort: 'Paris' } });
    expect(res.status()).toBe(200);
    // Correct behaviour: no flights offered for a trip that goes nowhere.
    expect(await res.text()).not.toContain('Choose This Flight');
  });
});

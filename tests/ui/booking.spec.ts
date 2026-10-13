import { bug, expect, test } from '../../fixtures';
import { openPurchaseForm } from '../../pages/flows';
import { aPassenger } from '../../utils/builders';

test.describe('Book a flight end to end', { tag: ['@ui', '@regression'] }, () => {
  test(
    'search, choose the cheapest flight, pay, and get a confirmation',
    { tag: '@smoke' },
    async ({ home, reserve, purchase, confirmation }) => {
      await home.open();
      await home.searchFlights('Boston', 'London');
      await reserve.expectLoaded('Boston', 'London');
      await reserve.chooseCheapestFlight();
      await purchase.expectLoaded();

      await purchase.fill(aPassenger());
      await purchase.submit();

      await confirmation.expectLoaded();
      // The booking id is a 13-digit number (it is the time of purchase in milliseconds; see BUG_REPORTS OBS-UI-02).
      expect(await confirmation.value('Id')).toMatch(/^\d{13}$/);
      expect(await confirmation.value('Status')).toBe('PendingCapture');
      expect(await confirmation.value('Amount')).toMatch(/^\d+(\.\d{1,2})? USD$/);
      expect(await confirmation.value('Auth Code')).toMatch(/^\d{6}$/);
    },
  );

  test(
    'the purchase page shows the flight and price that were chosen',
    { annotation: bug('BUG-001') },
    async ({ home, reserve, purchase }) => {
      test.fail(true, 'BUG-001: the purchase page always shows United UA954 TLV->SFO for $400, whatever was chosen');
      const chosen = await openPurchaseForm({ home, reserve, purchase }, { row: 0 });
      expect(await purchase.summaryValue('Airline')).toBe(chosen.airline);
      expect(await purchase.summaryCents('Price')).toBe(chosen.priceCents);
    },
  );

  test(
    'the amount on the confirmation matches the total on the purchase page',
    { annotation: bug('BUG-002') },
    async ({ home, reserve, purchase, confirmation }) => {
      test.fail(true, 'BUG-002: the confirmation always charges 555 USD; the purchase page says 914.76');
      await openPurchaseForm({ home, reserve, purchase });
      const total = await purchase.summaryCents('Total Cost');
      await purchase.fill(aPassenger());
      await purchase.submit();
      await confirmation.expectLoaded();
      const amount = Math.round(Number((await confirmation.value('Amount')).replace(/[^\d.]/g, '')) * 100);
      expect(amount).toBe(total);
    },
  );
});

test.describe('Navigation', { tag: ['@ui', '@regression'] }, () => {
  test('back from the purchase form returns to the same results, and forward returns to the form', async ({
    page,
    home,
    reserve,
    purchase,
  }) => {
    await home.open();
    await home.searchFlights('Philadelphia', 'Berlin');
    await reserve.expectLoaded('Philadelphia', 'Berlin');
    const results = await reserve.flights();
    await reserve.chooseFlight(1);
    await purchase.expectLoaded();

    await page.goBack();
    await reserve.expectLoaded('Philadelphia', 'Berlin');
    expect(await reserve.flights()).toEqual(results);

    await page.goForward();
    await purchase.expectLoaded();
  });
});

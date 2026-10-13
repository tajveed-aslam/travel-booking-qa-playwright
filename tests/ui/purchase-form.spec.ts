import type { Page } from '@playwright/test';
import { bug, expect, test } from '../../fixtures';
import { openPurchaseForm } from '../../pages/flows';
import { aPassenger, TEST_CARDS, type CardType } from '../../utils/builders';

/**
 * Proves a submission was NOT accepted: waits (bounded) for the navigation to the confirmation page and reports
 * whether it happened. Asserting "still on purchase.php" right after the click would pass before the browser even
 * starts navigating (a race that WebKit exposed), so absence has to be shown by waiting for the event itself.
 */
async function reachedConfirmation(page: Page, within = 5_000): Promise<boolean> {
  return page.waitForURL(/\/confirmation\.php$/, { timeout: within }).then(
    () => true,
    () => false,
  );
}

test.describe('Purchase form behaviour', { tag: ['@ui', '@regression'] }, () => {
  test.beforeEach(async ({ home, reserve, purchase }) => {
    await openPurchaseForm({ home, reserve, purchase });
  });

  test('an empty form cannot be submitted', { annotation: bug('BUG-003') }, async ({ page, purchase }) => {
    test.fail(true, 'BUG-003: the form has no validation; an empty submission is "purchased"');
    await purchase.submit();
    // Correct behaviour: stay on the form (or show errors) instead of confirming a payment.
    expect(await reachedConfirmation(page)).toBe(false);
  });

  test('a card number with letters is rejected', { annotation: bug('BUG-003') }, async ({ page, purchase }) => {
    test.fail(true, 'BUG-003: "abcd-efgh" is accepted as a card number');
    await purchase.fill(aPassenger({ cardNumber: 'abcd-efgh', month: '13', year: '1999' }));
    await purchase.submit();
    expect(await reachedConfirmation(page)).toBe(false);
  });

  test('boundary values: very long and non-ASCII names are accepted', async ({ purchase, confirmation }) => {
    // Real behaviour: no length limit and full Unicode support. Accepting these is correct for names; the 300-character
    // case is noted in the test plan because downstream systems (tickets, airline APIs) usually cap name length.
    const longName = 'A'.repeat(300);
    await purchase.fill(
      aPassenger({ name: longName, nameOnCard: "Zoë Ñúñez-O'Brien 李", address: '1'.repeat(200), zipCode: '0' }),
    );
    await expect(purchase.name).toHaveValue(longName);
    await purchase.submit();
    await confirmation.expectLoaded();
  });

  test(
    'the confirmation shows the card that was entered',
    { annotation: bug('BUG-004') },
    async ({ purchase, confirmation }) => {
      test.fail(true, 'BUG-004: the confirmation always shows card ...1111 expiring 11/2018');
      const passenger = aPassenger({ cardType: 'amex', month: '03', year: '2031' });
      await purchase.fill(passenger);
      await purchase.submit();
      await confirmation.expectLoaded();
      expect(await confirmation.value('Card Number')).toBe(
        `xxxxxxxxxxx${passenger.cardNumber.slice(-4)}`.slice(-passenger.cardNumber.length),
      );
      expect(await confirmation.value('Expiration')).toBe('03 /2031');
    },
  );

  test(
    'the card expiry is not pre-filled with a date in the past',
    { annotation: bug('BUG-006') },
    async ({ purchase }) => {
      test.fail(true, 'BUG-006: month/year default to 11 / 2017');
      const year = Number(await purchase.year.inputValue());
      expect(year).toBeGreaterThanOrEqual(new Date().getFullYear());
    },
  );

  test('"Remember me" has no observable effect on the next booking', async ({
    page,
    home,
    reserve,
    purchase,
    confirmation,
  }) => {
    const passenger = aPassenger({ rememberMe: true });
    await purchase.fill(passenger);
    await expect(purchase.rememberMe).toBeChecked();
    await purchase.submit();
    await confirmation.expectLoaded();

    await openPurchaseForm({ home, reserve, purchase });
    // Real behaviour: nothing is pre-filled, the box is unchecked, and no cookie or storage entry is written.
    // Recorded as an observation (OBS-UI-01): the checkbox promises a feature that doesn't exist.
    await expect(purchase.name).toHaveValue('');
    await expect(purchase.rememberMe).not.toBeChecked();
    expect(await page.context().cookies()).toEqual([]);
    expect(await page.evaluate(() => Object.keys(localStorage).length)).toBe(0);
  });
});

test.describe('Card types', { tag: ['@ui', '@regression'] }, () => {
  for (const cardType of Object.keys(TEST_CARDS) as CardType[]) {
    test(`a ${cardType} card can complete a purchase`, async ({ home, reserve, purchase, confirmation }) => {
      await openPurchaseForm({ home, reserve, purchase });
      await purchase.fill(aPassenger({ cardType }));
      await expect(purchase.cardType).toHaveValue(cardType);
      await purchase.submit();
      await confirmation.expectLoaded();
      expect(await confirmation.value('Status')).toBe('PendingCapture');
    });
  }
});

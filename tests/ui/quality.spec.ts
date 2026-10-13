import AxeBuilder from '@axe-core/playwright';
import { bug, expect, test } from '../../fixtures';
import { openPurchaseForm } from '../../pages/flows';

/**
 * Visual and accessibility checks. Both run on desktop Chromium only: the screenshot baseline is engine-specific, and
 * axe's rule results don't depend on the browser. Other projects report these as skipped, with this reason.
 */
test.describe('Visual and accessibility', { tag: ['@ui', '@regression'] }, () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Visual baseline and axe scan are kept for desktop Chromium only');
  });

  test('flight results table matches the visual baseline', async ({ home, reserve }) => {
    await home.open();
    await home.searchFlights('Paris', 'Rome');
    await reserve.expectLoaded('Paris', 'Rome');
    await expect(reserve.table).toHaveScreenshot('results-table.png');
  });

  test(
    'accessibility: no WCAG A/AA violations beyond the known baseline',
    { annotation: bug('BUG-007') },
    async ({ page, home, reserve, purchase }, testInfo) => {
      // Known violations, found on first scan and reported as BUG-007. Any NEW violation fails this test; a fixed one
      // also fails it, so the baseline is kept honest.
      const KNOWN: Record<string, string[]> = {
        home: ['color-contrast', 'select-name'],
        purchase: ['select-name'],
      };
      const scan = async (name: string) => {
        const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        await testInfo.attach(`axe-${name}.json`, {
          body: JSON.stringify(result.violations, null, 2),
          contentType: 'application/json',
        });
        return result.violations.map((v) => v.id).sort();
      };

      await home.open();
      expect(await scan('home')).toEqual(KNOWN.home);

      await openPurchaseForm({ home, reserve, purchase });
      expect(await scan('purchase')).toEqual(KNOWN.purchase);
    },
  );
});

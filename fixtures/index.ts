import { test as base } from '@playwright/test';
import { ConfirmationPage } from '../pages/ConfirmationPage';
import { HomePage } from '../pages/HomePage';
import { PurchasePage } from '../pages/PurchasePage';
import { ReservePage } from '../pages/ReservePage';
import { BookingApi } from '../utils/BookingApi';
import { env } from '../utils/env';

interface UiFixtures {
  home: HomePage;
  reserve: ReservePage;
  purchase: PurchasePage;
  confirmation: ConfirmationPage;
}

interface ApiFixtures {
  api: BookingApi;
  /** Admin token for authenticated calls. */
  token: string;
  /**
   * Register a booking id the test created; it is deleted after the test whether the test passed or failed, so every
   * test leaves the shared practice API as it found it.
   */
  cleanup: (id: number) => void;
}

export const test = base.extend<UiFixtures & ApiFixtures>({
  home: async ({ page }, use) => use(new HomePage(page)),
  reserve: async ({ page }, use) => use(new ReservePage(page)),
  purchase: async ({ page }, use) => use(new PurchasePage(page)),
  confirmation: async ({ page }, use) => use(new ConfirmationPage(page)),

  api: async ({ request }, use) => use(new BookingApi(request)),

  token: async ({ api }, use) => use(await api.getToken(env.apiUsername, env.apiPassword)),

  cleanup: async ({ api }, use) => {
    const ids = new Set<number>();
    await use((id) => ids.add(id));
    if (ids.size === 0) return;
    const token = await api.getToken(env.apiUsername, env.apiPassword);
    for (const id of ids) {
      const res = await api.delete(id, token);
      // 201 = deleted; 405 = already gone (the test deleted it itself). Anything else is worth a warning, not a failure.
      if (![201, 405].includes(res.status())) console.warn(`cleanup: DELETE /booking/${id} -> ${res.status()}`);
    }
  },
});

export { expect } from '@playwright/test';

/** Marks a test as tracking a known defect in the target site; see docs/BUG_REPORTS.md. */
export const bug = (id: string) => ({ type: 'issue', description: `${id} (docs/BUG_REPORTS.md)` });

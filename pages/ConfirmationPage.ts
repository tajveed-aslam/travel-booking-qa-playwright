import { expect, type Locator, type Page } from '@playwright/test';

type Field = 'Id' | 'Status' | 'Amount' | 'Card Number' | 'Expiration' | 'Auth Code' | 'Date';

/** Confirmation (confirmation.php): a two-column table of the payment result. */
export class ConfirmationPage {
  readonly heading: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Thank you for your purchase today!' });
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/confirmation\.php$/);
    await expect(this.heading).toBeVisible();
    await expect(this.page).toHaveTitle('BlazeDemo Confirmation');
  }

  /** The value cell next to a label cell, whitespace-normalised ("11\n /2018" -> "11 /2018"). */
  async value(field: Field): Promise<string> {
    const row = this.page.getByRole('row').filter({ has: this.page.getByRole('cell', { name: field, exact: true }) });
    const text = await row.getByRole('cell').nth(1).innerText();
    return text.replace(/\s+/g, ' ').trim();
  }
}

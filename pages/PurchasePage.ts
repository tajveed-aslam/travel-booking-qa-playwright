import { expect, type Locator, type Page } from '@playwright/test';
import type { Passenger } from '../utils/builders';
import { toCents } from './ReservePage';

/** Purchase form (purchase.php): a reservation summary plus passenger and card details. */
export class PurchasePage {
  readonly heading: Locator;
  readonly name: Locator;
  readonly address: Locator;
  readonly city: Locator;
  readonly state: Locator;
  readonly zipCode: Locator;
  readonly cardType: Locator;
  readonly cardNumber: Locator;
  readonly month: Locator;
  readonly year: Locator;
  readonly nameOnCard: Locator;
  readonly rememberMe: Locator;
  readonly purchase: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 2 });
    this.name = page.getByLabel('Name', { exact: true });
    this.address = page.getByLabel('Address', { exact: true });
    this.city = page.getByLabel('City', { exact: true });
    this.state = page.getByLabel('State', { exact: true });
    this.zipCode = page.getByLabel('Zip Code', { exact: true });
    // The "Card Type" label points at a non-existent id (for="creditCardType"; the select is #cardType), so it can't be
    // found by its label. Documented as an accessibility finding.
    this.cardType = page.locator('#cardType');
    this.cardNumber = page.getByLabel('Credit Card Number', { exact: true });
    this.month = page.getByLabel('Month', { exact: true });
    this.year = page.getByLabel('Year', { exact: true });
    this.nameOnCard = page.getByLabel('Name on Card', { exact: true });
    this.rememberMe = page.getByLabel('Remember me');
    this.purchase = page.getByRole('button', { name: 'Purchase Flight' });
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/purchase\.php$/);
    await expect(this.purchase).toBeVisible();
  }

  /** A line of the reservation summary, e.g. summaryValue('Price') -> "400". */
  async summaryValue(label: 'Airline' | 'Flight Number' | 'Price' | 'Arbitrary Fees and Taxes' | 'Total Cost'): Promise<string> {
    const line = this.page.locator('p', { hasText: `${label}:` }).first();
    const text = await line.innerText();
    return text.slice(text.indexOf(':') + 1).trim();
  }

  async summaryCents(label: 'Price' | 'Arbitrary Fees and Taxes' | 'Total Cost'): Promise<number> {
    return toCents(await this.summaryValue(label));
  }

  async fill(p: Passenger) {
    await this.name.fill(p.name);
    await this.address.fill(p.address);
    await this.city.fill(p.city);
    await this.state.fill(p.state);
    await this.zipCode.fill(p.zipCode);
    await this.cardType.selectOption(p.cardType);
    await this.cardNumber.fill(p.cardNumber);
    await this.month.fill(p.month);
    await this.year.fill(p.year);
    await this.nameOnCard.fill(p.nameOnCard);
    if (p.rememberMe) await this.rememberMe.check();
  }

  async submit() {
    await this.purchase.click();
  }
}

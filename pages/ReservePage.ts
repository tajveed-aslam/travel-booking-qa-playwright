import { expect, type Locator, type Page } from '@playwright/test';

export interface FlightOption {
  flightNumber: string;
  airline: string;
  departs: string;
  arrives: string;
  /** Price as displayed, e.g. "$472.56". */
  priceText: string;
  /** Price in cents, so comparisons are exact. */
  priceCents: number;
}

/** "$472.56" -> 47256 */
export function toCents(price: string): number {
  const match = price.replace(/,/g, '').match(/-?\d+(\.\d{1,2})?/);
  if (!match) throw new Error(`No price in "${price}"`);
  return Math.round(Number(match[0]) * 100);
}

/** Flight results (reserve.php): a table with one "Choose This Flight" form per row. */
export class ReservePage {
  readonly heading: Locator;
  readonly table: Locator;
  readonly columnHeaders: Locator;
  readonly rows: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 3 });
    this.table = page.getByRole('table');
    this.columnHeaders = this.table.locator('thead th');
    this.rows = this.table.locator('tbody tr');
  }

  async expectLoaded(from: string, to: string) {
    await expect(this.page).toHaveURL(/\/reserve\.php$/);
    await expect(this.heading).toHaveText(`Flights from ${from} to ${to}:`);
  }

  async flights(): Promise<FlightOption[]> {
    await expect(this.rows.first()).toBeVisible();
    const flights: FlightOption[] = [];
    for (const row of await this.rows.all()) {
      const cells = await row.locator('td').allInnerTexts();
      const [, flightNumber = '', airline = '', departs = '', arrives = '', priceText = ''] = cells.map((c) => c.trim());
      flights.push({ flightNumber, airline, departs, arrives, priceText, priceCents: toCents(priceText) });
    }
    return flights;
  }

  /** Chooses the flight in the given row and returns what was shown for it. */
  async chooseFlight(index: number): Promise<FlightOption> {
    const flight = (await this.flights())[index];
    if (!flight) throw new Error(`No flight at row ${index}`);
    await this.rows.nth(index).getByRole('button', { name: 'Choose This Flight' }).click();
    return flight;
  }

  async chooseCheapestFlight(): Promise<FlightOption> {
    const flights = await this.flights();
    const cheapest = flights.reduce((best, f, i) => (f.priceCents < flights[best]!.priceCents ? i : best), 0);
    return this.chooseFlight(cheapest);
  }
}

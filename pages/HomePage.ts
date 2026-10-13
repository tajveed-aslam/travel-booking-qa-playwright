import { expect, type Locator, type Page } from '@playwright/test';

/** BlazeDemo home: pick departure and destination, then "Find Flights". */
export class HomePage {
  readonly departure: Locator;
  readonly destination: Locator;
  readonly findFlights: Locator;

  constructor(private readonly page: Page) {
    // The two selects have no <label>, so there is no accessible name to select them by (see the a11y test);
    // the form field names are the most stable hook.
    this.departure = page.locator('select[name="fromPort"]');
    this.destination = page.locator('select[name="toPort"]');
    this.findFlights = page.getByRole('button', { name: 'Find Flights' });
  }

  async open() {
    await this.page.goto('/');
    await expect(this.page.getByRole('heading', { name: 'Welcome to the Simple Travel Agency!' })).toBeVisible();
  }

  async departureOptions(): Promise<string[]> {
    return this.departure.locator('option').allInnerTexts();
  }

  async destinationOptions(): Promise<string[]> {
    return this.destination.locator('option').allInnerTexts();
  }

  async searchFlights(from: string, to: string) {
    await this.departure.selectOption(from);
    await this.destination.selectOption(to);
    await this.findFlights.click();
  }
}

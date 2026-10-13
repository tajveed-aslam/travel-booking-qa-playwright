import type { HomePage } from './HomePage';
import type { FlightOption, ReservePage } from './ReservePage';
import type { PurchasePage } from './PurchasePage';

/**
 * The purchase form is only reachable by POSTing a chosen flight, so tests that start at the form walk the real
 * route: home -> Find Flights -> Choose This Flight. Returns the flight that was chosen.
 */
export async function openPurchaseForm(
  pages: { home: HomePage; reserve: ReservePage; purchase: PurchasePage },
  { from = 'Boston', to = 'London', row = 0 }: { from?: string; to?: string; row?: number } = {},
): Promise<FlightOption> {
  await pages.home.open();
  await pages.home.searchFlights(from, to);
  await pages.reserve.expectLoaded(from, to);
  const flight = await pages.reserve.chooseFlight(row);
  await pages.purchase.expectLoaded();
  return flight;
}

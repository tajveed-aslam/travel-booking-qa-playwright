# Travel booking QA: Playwright + TypeScript

[![Playwright tests](https://github.com/tajveed-aslam/travel-booking-qa-playwright/actions/workflows/playwright.yml/badge.svg)](https://github.com/tajveed-aslam/travel-booking-qa-playwright/actions/workflows/playwright.yml)

A test automation sample for a **travel booking platform**: search, booking, payment, cancellation. It shows how I
build and run a Playwright suite the way a product team would: Page Object Model, API and UI layers, contract checks,
cross-browser and mobile runs, GitHub Actions on every pull request, and clear reporting of what was found.

It runs against two **public practice sites** that stand in for parts of a booking product:

| Layer | Target                                                                   | What it plays                                                                                   |
| ----- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| UI    | [BlazeDemo](https://blazedemo.com)                                       | Customer journey: choose route → find flights → choose flight → pay → confirmation              |
| API   | [Restful-Booker](https://restful-booker.herokuapp.com/apidoc/index.html) | Booking records: auth, create, read, list/filter, update, partial update, delete (cancellation) |

**Results:** 45 tests (21 UI × 5 browser/device projects + 24 API = 129 test runs per full run). Three consecutive full
runs passed: 0 failures, 0 flaky. **13 real defects and 6 observations** were found in the target sites and are
documented in [docs/BUG_REPORTS.md](docs/BUG_REPORTS.md), each tracked by a test.

## Run it

Requires Node 22+.

```bash
npm ci
npx playwright install --with-deps   # Chromium, Firefox, WebKit

npm test              # everything: API + 5 browser/device projects
npm run test:smoke    # @smoke on Chromium + API (what runs on every PR)
npm run test:ui       # UI tests only, all browsers
npm run test:api      # API tests only
npm run report        # open the HTML report of the last run

npx playwright test --project=webkit          # one browser
npx playwright test -g "cancellation"         # by title
npx playwright test --project=chromium --trace on   # with a full trace for every test
```

Base URLs and the API's demo credentials default to the public sites; override them in `.env` (see `.env.example`).

## What's covered

**UI (BlazeDemo), 21 tests, on desktop Chromium, Firefox, WebKit and emulated Pixel 7 and iPhone 14:**

- Search, data-driven over three routes: heading, the six columns, and a well-formed row per flight (number, airline,
  times, price).
- End-to-end booking (smoke): search, choose the cheapest flight, pay, confirmation with booking id, status, amount
  and auth code.
- Price accuracy through the journey: chosen flight → purchase page → amount charged.
- Purchase form behaviour: empty form, invalid card data, boundary values (300-character and non-ASCII names), each
  card type (Visa, Amex, Diners), card shown on the receipt, default expiry, "remember me".
- Search rules: results vs. route, same-city trips (UI and server side).
- Back/forward navigation through the POST-driven flow.
- Visual regression of the results table (`toHaveScreenshot`) and an axe-core WCAG 2.1 A/AA scan, both on desktop
  Chromium.

**API (Restful-Booker), 24 tests:**

- Auth: valid credentials, invalid credentials, a made-up token.
- Create with strict response-schema validation (zod), get by id, unknown id, list filtered by name and by dates.
- Full update (PUT) and partial update (PATCH) with a token; PUT, PATCH and DELETE **without** a token are rejected
  and change nothing.
- Cancellation flow: create → modify → delete → the booking is gone (get 404, not listed).
- Negative cases: missing fields, wrong types, check-out before check-in, invalid dates, negative and decimal prices,
  malformed JSON.
- Every test creates its own booking with a builder and deletes it afterwards (even if the test fails), so tests are
  independent and run in parallel.

## Results

Three consecutive full local runs on 2026-10-13 (Windows 11, Playwright 1.64, 4 workers, about 2 minutes each):

| Project           |   Tests | Passed | Known defect (expected fail) | Failed | Flaky | Skipped |
| ----------------- | ------: | -----: | ---------------------------: | -----: | ----: | ------: |
| api               |      24 |     15 |                            9 |      0 |     0 |       0 |
| chromium          |      21 |     14 |                            7 |      0 |     0 |       0 |
| firefox           |      21 |     12 |                            7 |      0 |     0 |       2 |
| webkit            |      21 |     12 |                            7 |      0 |     0 |       2 |
| pixel-7           |      21 |     12 |                            7 |      0 |     0 |       2 |
| iphone-14         |      21 |     12 |                            7 |      0 |     0 |       2 |
| **Total per run** | **129** | **77** |                       **44** |  **0** | **0** |   **8** |

The figures were identical in all three runs: no test changed outcome, so there is no flakiness. The 8 skips are the
visual and accessibility tests on the non-Chromium projects (baseline and axe kept for desktop Chromium; the reason
shows in the report). The same suite runs in GitHub Actions (see CI below).

**Known defect** means: the site has a bug, the test asserts the **correct** behaviour and is marked `test.fail()`
with the bug id. It passes while the bug exists and fails the day it's fixed, prompting the expectation to be flipped.
Nothing is skipped or deleted to make the run green.

## Findings (summary)

Full Jira-style reports: [docs/BUG_REPORTS.md](docs/BUG_REPORTS.md).

| Id      | Finding                                                                  | Severity |
| ------- | ------------------------------------------------------------------------ | -------- |
| BUG-001 | Purchase page ignores the chosen flight and price (always TLV→SFO, $400) | Critical |
| BUG-002 | Confirmation charges a fixed 555 USD, not the quoted 914.76              | Critical |
| BUG-009 | API truncates prices with cents (99.99 → 99)                             | Critical |
| BUG-003 | Purchase form has no validation: empty or junk card data is "paid"       | Major    |
| BUG-004 | Receipt shows a fixed card (…1111, 11/2018), not the one entered         | Major    |
| BUG-005 | Results ignore the route; the server accepts Paris → Paris               | Major    |
| BUG-007 | Three selects have no accessible name; one low-contrast link             | Major    |
| BUG-008 | Missing required fields crash the API with 500                           | Major    |
| BUG-010 | Wrong types silently coerced (`"abc"` price → `null`, `"yes"` → `true`)  | Major    |
| BUG-011 | Check-out before check-in accepted                                       | Major    |
| BUG-012 | Unparseable dates stored as `"0NaN-aN-aN"`                               | Major    |
| BUG-013 | Negative prices accepted                                                 | Major    |
| BUG-006 | Card expiry pre-filled with 11/2017                                      | Minor    |

Plus 6 observations: 200 for bad credentials; 200 on create, 201 on delete, 405 on a repeat delete; an exclusive
check-in filter; "remember me" does nothing; predictable timestamp booking ids; a flight-number mismatch.

## Project structure

```
pages/                 Page Object Model: HomePage, ReservePage, PurchasePage, ConfirmationPage, flows.ts
fixtures/index.ts      Custom test fixtures: page objects, API client, auth token, automatic booking cleanup
utils/
  builders.ts          Test-data builders (passengers, cards, bookings), unique per call
  schemas.ts           zod contracts for API responses (strict: unknown fields fail)
  BookingApi.ts        Thin API client returning raw responses
  env.ts               Base URLs and credentials from the environment
tests/
  ui/                  search, booking (+ navigation), purchase-form (+ card types), quality (visual + axe)
  ui/__screenshots__/  Visual baselines (Windows and Linux)
  api/                 auth, bookings (CRUD, filters, auth, cancellation), validation (negative cases)
docs/                  TEST_PLAN, TEST_CASES, BUG_REPORTS, AI_WORKFLOW
scripts/ci-summary.mjs JUnit → Markdown summary for the GitHub Actions run page
.github/workflows/     playwright.yml (PR smoke, full matrix), update-snapshots.yml (Linux baselines)
```

## Design decisions

- **Explore before writing.** Every selector, status code and response field was observed on the live sites first
  (raw requests plus a real browser); see [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md).
- **Locators:** roles and labels first (`getByRole`, `getByLabel`). Where the site gives a control no accessible name
  (the city and card-type selects), the form field name is used, and the missing name is reported as an accessibility
  defect rather than silently worked around.
- **Separate API project.** API tests make HTTP calls only, so they run once, not once per browser.
- **Web-first assertions only;** no `waitForTimeout` (enforced by ESLint). Proving something does _not_ happen (an
  invalid form isn't submitted) uses a bounded wait for the event itself, because asserting "still on the page" right
  after a click passes before navigation even starts. WebKit exposed that race.
- **Money in cents.** Prices are parsed to integer cents before comparison, so 472.56 vs 472.559 can't hide.
- **Strict contracts.** zod schemas are `.strict()`, so an extra or renamed field fails a test instead of passing
  unnoticed.
- **Self-cleaning data.** A `cleanup` fixture deletes every booking a test created, after the test, pass or fail.
- **Polite to shared sites.** 2 workers in CI and 4 locally, no retries locally, no load testing, and only the
  bookings each test creates are touched.
- **OS-specific visual baselines.** Font rendering differs between Windows and Linux, so the platform is part of the
  baseline file name. Windows baselines are made locally; the Linux ones by a manual workflow in CI.

## CI: GitHub Actions

`.github/workflows/playwright.yml`:

| Trigger                                     | Runs                                                                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Pull request                                | Typecheck, lint, format check; **@smoke** on Chromium + API                                                          |
| Push to `main`, nightly (02:00 UTC), manual | Typecheck, lint, format check; **full suite** as a 6-job matrix (api, chromium, firefox, webkit, pixel-7, iphone-14) |

Dependencies and browsers are cached; each job uploads the HTML report and `test-results/` (traces, screenshots,
videos on failure) as artifacts, retries once in CI with `trace: on-first-retry`, and writes a short summary table
(tests, passed, failed, skipped, known defects) to the run page.

`.github/workflows/update-snapshots.yml` regenerates the Linux visual baseline on demand and commits it.

## Limitations (honest)

- **These are practice sites, not your platform.** BlazeDemo and Restful-Booker are public demos with simplified
  behaviour; many defects found are deliberate or neglected parts of a demo. The point is the approach and the
  engineering, which carry over to a real product.
- **No payments or refunds.** BlazeDemo's "payment" is a static page, and Restful-Booker has no payment or refund
  endpoints. Nothing here fakes them. Payment and refund testing for a real platform is described in
  [docs/TEST_PLAN.md](docs/TEST_PLAN.md) and the manual cases (TC-10, TC-15, TC-17, TC-18).
- **Mobile is emulated** (Playwright device profiles on desktop engines), not real devices. A real-device cloud would
  be the next step.
- **Shared, resetting data.** Restful-Booker is public and resets periodically; tests avoid relying on any data they
  didn't create.
- **One visual check and one accessibility scan,** deliberately small: a demonstration of the technique, not full
  visual or accessibility coverage. axe catches a subset of WCAG issues; keyboard and screen-reader testing is manual.
- **Playwright MCP was not used.** It wasn't available in the session that built this; exploration was scripted
  instead (see AI_WORKFLOW).

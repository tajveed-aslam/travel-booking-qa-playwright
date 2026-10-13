# Test plan: travel booking (search → book → pay → cancel → refund)

This plan is written for a travel booking SaaS. The automated suite in this repository exercises two public practice
systems that stand in for parts of such a platform (BlazeDemo for the customer UI, Restful-Booker for the booking API);
the plan covers the whole product, and marks what the suite here actually automates.

## 1. Scope

| Area                  | In scope for the product                                                            | Automated here                                                              |
| --------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Flight / hotel search | criteria, results, sorting, availability, pricing shown                             | Yes (UI, BlazeDemo)                                                         |
| Selection and booking | chosen item and price carried through, passenger details                            | Yes (UI, BlazeDemo)                                                         |
| Payment               | card validation, amount charged = amount quoted, declines, 3-D Secure, retries      | Partly: form behaviour and the confirmation (BlazeDemo has no real payment) |
| Booking records       | create, read, search/filter, update, partial update                                 | Yes (API, Restful-Booker)                                                   |
| Cancellation          | cancel, booking no longer retrievable, idempotency                                  | Yes (API delete flow)                                                       |
| Refunds               | refund rules, partial refunds, refund to original method                            | **No**: neither practice system has refunds, and none are faked             |
| Supplier integrations | GDS / airline / hotel API failures, timeouts, price changes between search and book | No (test plan and charters only)                                            |
| Commission            | agent/affiliate commission calculation and reporting                                | No (test plan only)                                                         |
| Non-functional        | accessibility, visual stability, cross-browser and mobile                           | Yes (axe, `toHaveScreenshot`, 5 browser/device projects)                    |
| Performance / load    |                                                                                     | **Out of scope**: the targets are shared public sites; no load is sent      |

## 2. Risks and how they are tested

Ranked by impact × likelihood for a travel booking business.

| #   | Risk                                                                                                               | Why it matters                                        | How it's covered                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Price accuracy**: the price charged differs from the price shown, or loses precision                             | Direct revenue loss, chargebacks, regulatory exposure | UI: chosen price → purchase page → confirmation amount (BUG-001, BUG-002 found). API: decimal prices stored exactly (BUG-009 found) |
| R2  | **Double booking / duplicate charge**: retries, double clicks, two agents editing one booking                      | Over-sold inventory, double charges                   | API: each booking is independent and idempotent delete is checked (OBS-API-02); manual cases TC-15, charter C2                      |
| R3  | **Payment failures**: declined, expired or invalid cards; gateway timeouts; payment taken but booking not created  | Lost sales or charged customers without a booking     | UI: invalid and empty card data (BUG-003), card types, expiry defaults (BUG-006); manual cases TC-08 to TC-11                       |
| R4  | **Cancellation and refund rules**: free-cancellation windows, fees, partial refunds, refund to the original method | Customer complaints, financial errors                 | API: cancel flow (create → modify → delete → gone); refunds manual only (TC-17, TC-18)                                              |
| R5  | **Supplier API failures and timeouts**: availability or price changes between search and booking                   | Booking failures at the last step; stale prices       | Charter C3; contract checks (zod schemas) catch response-shape drift early                                                          |
| R6  | **Dates and time zones**: check-out before check-in, invalid dates, time zone shifts at midnight, DST, leap days   | Wrong nights booked, wrong pricing                    | API: check-out before check-in (BUG-011), invalid dates (BUG-012), filter boundaries (OBS-API-03); manual TC-05, TC-06              |
| R7  | **Commission calculation**: wrong rate, rounding, currency                                                         | Partner disputes, revenue leakage                     | Manual TC-19, TC-20 (no practice system has commissions)                                                                            |
| R8  | **Data validation and integrity**: wrong types coerced, required fields missing, negative amounts                  | Corrupt records, 500 errors in production             | API: BUG-008, BUG-010, BUG-013                                                                                                      |
| R9  | **Access control**: changing or cancelling someone else's booking                                                  | Fraud, data breach                                    | API: PUT, PATCH and DELETE without or with a fake token are rejected (403)                                                          |
| R10 | **Accessibility and device coverage**                                                                              | Legal exposure, lost mobile customers                 | axe scan with a locked baseline (BUG-007); Pixel 7 and iPhone 14 projects                                                           |

## 3. Approach

- **API first for business rules** (fast, stable): pricing, dates, validation, auth, cancellation.
- **UI for customer journeys** (search → choose → pay → confirm) and what only a browser can show: what the customer sees,
  accessibility, visual layout, mobile.
- **Contract checks**: every API response used by a test is validated against a strict zod schema, so a renamed or
  extra field fails loudly.
- **Independent data**: each test creates its own data with builders and removes it afterwards, so tests run in
  parallel and in any order.
- **Known defects stay visible**: a defect is written as the correct expectation and marked `test.fail()` with its bug
  id. Nothing is skipped or deleted to make a run green.
- **Exploratory testing** for supplier failures, concurrency and edge cases that are expensive to automate (charters
  in TEST_CASES.md).

## 4. Priorities

| Priority | Meaning                               | Examples                                                                                       |
| -------- | ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| P1       | Blocks release; must pass on every PR | Search works, booking completes, amount charged = amount quoted, auth on changes, cancellation |
| P2       | Must pass before release              | Validation errors, card types, filters, accessibility baseline, cross-browser                  |
| P3       | Fix soon; doesn't block               | Cosmetic, convention deviations (status codes), "remember me"                                  |

`@smoke` = the P1 paths, run on every pull request (Chromium + API). `@regression` = everything, run on push to main,
nightly and on demand across all five browser/device projects.

## 5. Entry criteria

- The build deploys to the test environment and its health check passes (here: `/ping` returns 201, home page 200).
- Test data can be created and removed (API reachable with test credentials).
- Smoke suite green on the previous build, or its failures are understood.

## 6. Exit criteria

- All P1 tests pass; all P2 tests pass or have an agreed, documented exception.
- No open Critical defects; Major defects have an owner and a decision (fix / accept / mitigate).
- Flaky tests: none tolerated in `@smoke`. A flaky regression test is quarantined only with a ticket and a date.
- Cross-browser and mobile matrix green.

## 7. Release go / no-go checklist

- [ ] Smoke suite green on the release candidate.
- [ ] Full regression matrix green (Chromium, Firefox, WebKit, Pixel 7, iPhone 14, API).
- [ ] **Price check**: amount charged equals the amount quoted, on at least one booking per currency and payment method.
- [ ] Cancellation and refund rules verified for each fare/rate type changed in this release.
- [ ] No new accessibility violations against the baseline.
- [ ] No Critical defects open; Major defects triaged and signed off.
- [ ] Supplier sandbox checks run if any integration changed (timeouts, price-change-on-book, availability gone).
- [ ] Monitoring and alerting ready for payment failure rate and booking error rate after release.
- [ ] Rollback plan confirmed.

## 8. Current status against this plan (2026-10-13)

On the practice systems, release would be **no-go**: two Critical price-accuracy defects (BUG-001, BUG-002) and one
Critical money-precision defect in the API (BUG-009) are open. See BUG_REPORTS.md.

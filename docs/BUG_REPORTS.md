# Bug reports

Every issue below was **observed directly** against the live practice sites on 2026-10-13, first while exploring
(raw HTTP requests and a real browser) and then again by the automated suite. Nothing here is hypothetical.

Each defect has a test that states the **correct** behaviour and is marked `test.fail()` with the bug id: it passes
while the defect exists and fails as soon as the site is fixed, so the expectation can be flipped. To collect evidence
for any of them, run it with a trace and open the report, which shows the failed assertion (the actual value), every
action, network call and DOM snapshot:

```bash
npx playwright test -g "<test title>" --project=chromium --trace on
npx playwright show-report
```

These sites are public demos. The reports are written as they would be for a real travel booking product, to show
how each issue would be raised; they were not filed with the site owners.

Severity scale: **Critical** (money, data loss or security) · **Major** (wrong behaviour in a core flow) · **Minor**
(degraded but workable) · **Trivial**. Observations (`OBS-*`) are deviations from common API/UX conventions that are
worth a conversation but are not clearly bugs.

| Id         | Summary                                                                       | Area | Severity    |
| ---------- | ----------------------------------------------------------------------------- | ---- | ----------- |
| BUG-001    | Purchase page ignores the chosen flight and price                             | UI   | Critical    |
| BUG-002    | Confirmation charges a fixed 555 USD, not the quoted total                    | UI   | Critical    |
| BUG-003    | Purchase form has no validation (empty form and junk card data are "paid")    | UI   | Major       |
| BUG-004    | Confirmation shows a fixed card (…1111, 11/2018), not the one entered         | UI   | Major       |
| BUG-005    | Search results ignore the route; server accepts a same-city trip              | UI   | Major       |
| BUG-006    | Card expiry is pre-filled with a past date (11/2017)                          | UI   | Minor       |
| BUG-007    | Accessibility: three selects without accessible names; low-contrast link      | UI   | Major       |
| BUG-008    | Missing required fields crash the API (500 instead of 400)                    | API  | Major       |
| BUG-009    | Prices with cents are silently truncated (99.99 → 99)                         | API  | Critical    |
| BUG-010    | Wrong types are silently coerced or nulled instead of rejected                | API  | Major       |
| BUG-011    | A stay whose check-out is before its check-in is accepted                     | API  | Major       |
| BUG-012    | Unparseable dates are stored as `"0NaN-aN-aN"`                                | API  | Major       |
| BUG-013    | Negative prices are accepted                                                  | API  | Major       |
| OBS-API-01 | Wrong credentials return 200 with a reason, not 401                           | API  | Observation |
| OBS-API-02 | Create returns 200 (not 201); delete returns 201; a repeat delete returns 405 | API  | Observation |
| OBS-API-03 | The `checkin` filter is exclusive: a booking on that date is not returned     | API  | Observation |
| OBS-UI-01  | "Remember me" has no observable effect                                        | UI   | Observation |
| OBS-UI-02  | Booking id is the purchase time in milliseconds (predictable, can collide)    | UI   | Observation |
| OBS-UI-03  | Results row named `AL969` posts flight number `9696`                          | UI   | Observation |

---

## BUG-001: Purchase page ignores the chosen flight and price

|                 |                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| **Severity**    | Critical (price accuracy: the customer is shown a different flight and price from the one they chose) |
| **Environment** | https://blazedemo.com, Chromium/Firefox/WebKit desktop, Pixel 7 and iPhone 14 emulation               |
| **Test**        | `tests/ui/booking.spec.ts` › "the purchase page shows the flight and price that were chosen"          |

**Steps**

1. Open https://blazedemo.com, choose Boston → London, click **Find Flights**.
2. On the first row (Virgin America, flight 43, **$472.56**) click **Choose This Flight**.

**Expected:** the purchase page summarises Virgin America flight 43, Boston → London, $472.56.

**Actual:** the page always reads _"Your flight from TLV to SFO has been reserved. Airline: United. Flight Number:
UA954. Price: 400. Arbitrary Fees and Taxes: 514.76. Total Cost: 914.76"_, whichever flight or route was chosen. The
chosen flight is posted correctly (form fields `flight=43&price=472.56&airline=Virgin America…`) and ignored.

**Evidence:** run the test above with `--trace on`: the assertion shows `Expected: "Virgin America"` /
`Received: "United"`, and the trace's network tab shows the POST body with the chosen flight.

## BUG-002: Confirmation charges a fixed 555 USD, not the quoted total

|                 |                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| **Severity**    | Critical (the amount charged differs from the amount quoted)                                         |
| **Environment** | as BUG-001                                                                                           |
| **Test**        | `tests/ui/booking.spec.ts` › "the amount on the confirmation matches the total on the purchase page" |

**Steps:** choose any flight, fill the form with valid data, click **Purchase Flight**.

**Expected:** the confirmed amount equals the purchase page's _Total Cost_ (914.76), or at least the chosen flight's
price.

**Actual:** the confirmation always shows **Amount 555 USD** (status `PendingCapture`). Seen on every purchase made
during exploration and by the suite.

## BUG-003: Purchase form has no validation

|              |                                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| **Severity** | Major (payment submitted with no customer or card data)                                                          |
| **Tests**    | `tests/ui/purchase-form.spec.ts` › "an empty form cannot be submitted"; "a card number with letters is rejected" |

**Steps:** open the purchase form; (a) click **Purchase Flight** without filling anything; (b) enter card number
`abcd-efgh`, month `13`, year `1999` and submit.

**Expected:** the form is not submitted; errors identify the missing or invalid fields.

**Actual:** both go straight to "Thank you for your purchase today!" with a booking id and status `PendingCapture`. No
input has a `required` attribute and there is no server-side check.

## BUG-004: Confirmation shows a fixed card, not the one entered

|              |                                                                                       |
| ------------ | ------------------------------------------------------------------------------------- |
| **Severity** | Major (the receipt doesn't describe the payment that was made)                        |
| **Test**     | `tests/ui/purchase-form.spec.ts` › "the confirmation shows the card that was entered" |

**Steps:** pay with American Express `378282246310005`, expiry 03/2031.

**Expected:** the confirmation shows the last four digits `0005` and expiry 03/2031.

**Actual:** always `xxxxxxxxxxxx1111` and expiry `11 /2018`, whatever was entered (also for an empty card field).

## BUG-005: Search results ignore the route; the server accepts a same-city trip

|              |                                                                                                                                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity** | Major                                                                                                                                                                                                           |
| **Tests**    | `tests/ui/search.spec.ts` › "every route returns the same flights and prices (results ignore the search)" (asserts the observed behaviour); "the server refuses a same-city search sent directly" (`test.fail`) |

**Observed**

1. Every route returns the same five flights with the same prices (43 Virgin America $472.56, 234 United $432.98,
   9696 Aer Lingus $200.98, 12 Virgin America $765.32, 4346 Lufthansa $233.98); only the heading changes.
2. The UI dropdowns share no city, so a same-city trip can't be chosen in the browser. But the server doesn't enforce
   it: `POST /reserve.php` with `fromPort=Paris&toPort=Paris` returns _"Flights from Paris to Paris"_ with all five
   flights bookable.

**Expected:** results depend on the route; the server rejects departure = destination.

## BUG-006: Card expiry is pre-filled with a past date

|              |                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------- |
| **Severity** | Minor                                                                                          |
| **Test**     | `tests/ui/purchase-form.spec.ts` › "the card expiry is not pre-filled with a date in the past" |

**Actual:** Month and Year are pre-filled with `11` and `2017`. A customer who doesn't notice submits an expired card.
**Expected:** empty fields or a future default.

## BUG-007: Accessibility violations (axe-core, WCAG 2.1 A/AA)

|              |                                                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **Severity** | Major (screen-reader users can't tell what the city and card-type pickers are)                                                    |
| **Test**     | `tests/ui/quality.spec.ts` › "accessibility: no WCAG A/AA violations beyond the known baseline" (axe JSON attached to the report) |

| Page     | Rule             | Impact   | Element                                                                                      |
| -------- | ---------------- | -------- | -------------------------------------------------------------------------------------------- |
| Home     | `select-name`    | critical | `select[name="fromPort"]`, `select[name="toPort"]`: headings sit above them but no `<label>` |
| Home     | `color-contrast` | serious  | the "destination of the week" link                                                           |
| Purchase | `select-name`    | critical | `#cardType`: its label says `for="creditCardType"`, an id that doesn't exist                 |

The results page has no violations. The test locks this baseline: a new violation, or a fixed one, fails it.

## BUG-008: Missing required fields crash the API

|                 |                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| **Severity**    | Major                                                                                                 |
| **Environment** | https://restful-booker.herokuapp.com                                                                  |
| **Test**        | `tests/api/validation.spec.ts` › "missing firstname / bookingdates / everything is rejected with 400" |

**Request:** `POST /booking` with `firstname` omitted (or `bookingdates` omitted, or `{}`).
**Expected:** `400 Bad Request` naming the missing field. **Actual:** `500 Internal Server Error`, body `Internal Server Error`.
(Malformed JSON is handled correctly with 400.)

## BUG-009: Prices with cents are silently truncated

|              |                                                                           |
| ------------ | ------------------------------------------------------------------------- |
| **Severity** | Critical (money: every price with cents is under-charged or mis-recorded) |
| **Test**     | `tests/api/validation.spec.ts` › "a price with cents is stored exactly"   |

**Request:** `POST /booking` with `"totalprice": 99.99`. **Expected:** stored and returned as `99.99` (or rejected if
only whole units are supported). **Actual:** `200`, and the booking is stored with `"totalprice": 99`.

## BUG-010: Wrong types are silently coerced or nulled

|              |                                                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| **Severity** | Major                                                                                                       |
| **Tests**    | `tests/api/validation.spec.ts` › "a non-numeric price is rejected"; "a non-boolean depositpaid is rejected" |

`"totalprice": "abc"` → `200`, stored as `"totalprice": null`. `"depositpaid": "yes"` → `200`, stored as `true`.
**Expected:** `400`. A booking with no price, or a deposit recorded from a typo, are both silent data corruption.

## BUG-011: Check-out before check-in is accepted

|              |                                                                          |
| ------------ | ------------------------------------------------------------------------ |
| **Severity** | Major                                                                    |
| **Test**     | `tests/api/validation.spec.ts` › "check-out before check-in is rejected" |

`checkin` 50 days out, `checkout` 45 days out → `200`, stored as sent. **Expected:** `400`.

## BUG-012: Unparseable dates are stored as "0NaN-aN-aN"

|              |                                                                    |
| ------------ | ------------------------------------------------------------------ |
| **Severity** | Major                                                              |
| **Test**     | `tests/api/validation.spec.ts` › "an unparseable date is rejected" |

`"checkin": "not-a-date", "checkout": "2026-13-45"` → `200`, both stored as `"0NaN-aN-aN"`. **Expected:** `400`.

## BUG-013: Negative prices are accepted

|              |                                                                 |
| ------------ | --------------------------------------------------------------- |
| **Severity** | Major                                                           |
| **Test**     | `tests/api/validation.spec.ts` › "a negative price is rejected" |

`"totalprice": -50` → `200`, stored. **Expected:** `400` (refunds are a separate flow, never a negative booking price).

---

## Observations

**OBS-API-01:** `POST /auth` with wrong credentials returns **200** `{"reason":"Bad credentials"}`. A client that only
checks the status code treats it as a successful login. Test: `tests/api/auth.spec.ts` asserts this as observed.

**OBS-API-02:** `POST /booking` returns **200** rather than 201 Created; `DELETE /booking/{id}` returns **201
Created**; deleting an already-deleted booking returns **405** rather than 404. All asserted as observed in the
cancellation-flow test.

**OBS-API-03:** `GET /booking?checkin=YYYY-MM-DD` only returns bookings checking in **after** that date, so a search
for "arrivals on the 1st" misses bookings arriving on the 1st. Asserted as observed in `tests/api/bookings.spec.ts`.

**OBS-UI-01:** Ticking "Remember me" and buying sets no cookie or local storage, and the next purchase form is empty
and unticked. Asserted as observed in `tests/ui/purchase-form.spec.ts`.

**OBS-UI-02:** The confirmation's booking id is the purchase time in milliseconds (e.g. `1791874294373` on
2026-10-13 06:51:34 UTC). Ids are predictable, and two purchases in the same millisecond would collide.

**OBS-UI-03:** In the results table the Aer Lingus row's form is named `AL969` but posts `flight=9696` (shown as
"9696"). Harmless here, but the kind of mismatch that breaks supplier reconciliation.

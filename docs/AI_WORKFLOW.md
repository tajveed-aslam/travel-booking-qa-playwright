# How AI was used to build this suite

This project was built with **Claude Code** (Anthropic's coding agent) working in the repository, directed and reviewed
by me. This page records how, including what the AI got wrong and how its output was checked before it was trusted.

## Tools actually used

| Tool                             | Used?                                       | For                                                                                |
| -------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------- |
| Claude Code                      | Yes                                         | Exploration scripts, page objects, tests, fixtures, CI workflows, documents        |
| Playwright MCP server            | **No**: it wasn't connected in this session | —                                                                                  |
| `npx playwright codegen`         | No                                          | Exploration was done with scripts instead (below), which leave a reviewable record |
| curl + a small Playwright script | Yes                                         | Step 0 exploration of both sites before any test was written                       |
| axe-core (via a one-off script)  | Yes                                         | Finding the real accessibility baseline before writing the a11y test               |
| GitHub CLI (`gh`)                | Yes                                         | Creating the repo, running the baseline workflow, reading CI logs                  |

## The workflow

1. **Explore first, never guess.** The agent was told not to guess selectors, field names, status codes or response
   shapes. Before any test existed it:
   - fetched each BlazeDemo page's HTML (home, results, purchase, confirmation) and drove the flow in a real browser to
     read roles, labels, titles and back/forward behaviour;
   - called every Restful-Booker endpoint with valid and invalid input and recorded status codes and bodies;
   - ran axe on each page to get the real violation list.
     Most findings in BUG_REPORTS.md were discovered here, before a test was written.
2. **Write tests against what was observed.** Selectors come from the explored DOM (roles and labels where they work;
   field names where the site has no accessible name, which is itself a finding). Schemas come from real responses.
3. **Run, read failures, decide: test bug or site bug?** Every failure was investigated before changing anything.
4. **Encode site bugs as known defects, never hide them.** The correct expectation is kept and marked `test.fail()`
   with a bug id.
5. **Run the whole suite repeatedly** to catch flakiness (results in the README).

## Example prompts

The project brief itself was a prompt (scope, targets, stack, quality bar, honesty rules). Follow-ups during the work
looked like:

- _"Before writing tests, POST to reserve.php for three routes and tell me if the results differ."_ (They don't:
  BUG-005.)
- _"Call /booking with missing fields, wrong types, bad dates, negative and decimal prices; show status and stored
  values."_ (BUG-008 to BUG-013.)
- _"The WebKit run says 'expected to fail, but passed' for the empty-form test. Is the site different in WebKit, or is
  the test wrong?"_
- _"Check every claim in BUG_REPORTS.md against what the code and config actually do."_

## What had to be corrected (by me or by the agent after review)

These are real, from this build:

| What went wrong                                                                                             | How it was caught                                                        | Fix                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A "same-city search is refused" test hung for 30 s                                                          | The run timed out instead of failing                                     | Exploration in the browser showed the destination list has **no** city in common with the departure list, so the UI can't select one. Split into two tests: the UI prevents it (passes); the server accepts it when sent directly (BUG-005) |
| Negative tests ("an empty form is not submitted") checked `toHaveURL(/purchase.php/)` right after the click | WebKit and iPhone reported "expected to fail, but passed"                | The check passed _before_ the browser started navigating: a race that Chromium happened to hide. Replaced with a bounded wait for navigation to the confirmation page                                                                       |
| The CI workflow YAML had `run: … "Full suite: …"` (a colon inside a plain value) and was pushed broken      | Prettier's YAML parse failed on the next lint run                        | Block scalars for `run:`; the YAML is now format-checked in CI                                                                                                                                                                              |
| The CI summary counted known defects from a guessed JUnit attribute and reported 0                          | Compared the output with the real JUnit file                             | Count `<property name="fail">`, which is what Playwright actually writes                                                                                                                                                                    |
| The bug reports said each defect had a trace in the HTML report                                             | A claims review against `playwright.config.ts` (`trace: on-first-retry`) | Reworded: traces are recorded on retries in CI; locally, run with `--trace on`                                                                                                                                                              |
| The axe exploration script used `browser.newPage()`                                                         | axe-core threw "Please use browser.newContext()"                         | Created a context first                                                                                                                                                                                                                     |
| Lint: conditional tags and non-null assertions in tests                                                     | `eslint-plugin-playwright` and `typescript-eslint` strict                | Restructured tests; no rules disabled                                                                                                                                                                                                       |
| `tsconfig` used `moduleResolution: node`, deprecated in TypeScript 6                                        | `tsc` error                                                              | `module: preserve` + `moduleResolution: bundler`                                                                                                                                                                                            |

## How AI output is reviewed before it is trusted

- **Nothing unobserved is asserted.** A selector, status code or field is only used if it was seen in exploration or
  in a real response. Schemas are strict, so a wrong assumption fails loudly instead of passing quietly.
- **Every failure gets a root cause** before the test or the expectation changes. "Make it green" is not a fix.
- **Known defects use `test.fail()`, not `skip`.** ESLint forbids unconditional skips; the only skips are the
  visual/axe tests outside desktop Chromium, with the reason shown in the report.
- **Repeated runs:** the full suite ran three times locally, and CI runs it on every push and nightly.
- **Static checks:** strict TypeScript, ESLint (`typescript-eslint` strict and `eslint-plugin-playwright`), Prettier,
  all enforced in CI.
- **Documentation is checked against the code**, as the corrections above show. The README's numbers come from the
  actual runs.
- **I review every diff** before it's committed: page objects for stable locators, tests for real assertions (not just
  "no exception"), and data cleanup.

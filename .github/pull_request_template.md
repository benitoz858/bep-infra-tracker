<!--
Data corrections do not need a PR — open a data submission issue instead, and a
maintainer commits the change. That route exists so a number in the tracker can
always be traced to a human who accepted it.

This template is for code.
-->

## What this changes

<!-- One or two sentences. If it closes an issue, say "Closes #123". -->

## Why

<!-- What was wrong or missing. For anything non-obvious, the reasoning belongs
in a code comment too — the house style documents *why*, not what. -->

## Checks

```
npm run check      # typecheck + lint + tests
npm run test:e2e   # Playwright
```

- [ ] Both pass locally
- [ ] New behaviour has a test, or I have said below why it does not need one

## The four rules this project turns on

Confirm each, or say which one you had to bend and why. These are the reasons a
figure here is worth citing, so a PR that breaks one gets sent back even when
the code is good.

- [ ] **Unknown is not zero.** No `|| 0`, no `if (!mw)`. A missing value renders
      as "Not disclosed"; a confirmed zero renders as `0`. Formatting goes
      through `lib/format.ts`.
- [ ] **Estimates and confirmed figures stay separate.** Nothing averages
      `estimatedPowerMw` with `confirmedPowerMw`, and every surface says which
      it is showing.
- [ ] **No machine promotes its own claim.** Extractors cap at `LOW`; raising
      confidence stays a human act, enforced in the service layer.
- [ ] **Business logic is in `lib/services/*`,** not in components, so it stays
      callable from a script, a test and a route handler alike.

## Anything reviewers should look at closely

<!-- Trade-offs you are unsure about, or a decision that looks wrong until you
know what went wrong without it. -->

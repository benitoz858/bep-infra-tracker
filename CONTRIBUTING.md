# Contributing

Two very different kinds of contribution, with different bars.

---

## Contributing data

This is the useful one. The tracker is only worth anything if its numbers are
right, and the hard part is not the software — it is finding the filing that says
how many megawatts a campus actually drew.

**The rule the whole project turns on: a proposer suggests, a human commits.**

Nothing you submit lands in the live figures directly. It arrives as a
*candidate*, gets reviewed, and only then becomes evidence. That is not
gatekeeping for its own sake — it is the reason a number here is worth citing at
all. A tracker anyone can silently edit is a tracker nobody can quote.

### What makes a good submission

- **A source, always.** Preferably primary: the owner's own announcement, an SEC
  filing, a permit docket, an interconnection queue entry. A news article that
  cites one is fine; a news article that cites nothing is weak.
- **Quote the sentence** the number came from. If a later reader has to re-open
  the source to check, the submission is half-finished.
- **Say how you got there.** "450 MW stated in the filing" and "450 MW derived
  from 90,000 GPUs at 5 kW all-in" are both acceptable; pretending the second is
  the first is not.
- **Leave unknowns blank.** Never enter `0` for a value you do not have. A blank
  means "not disclosed"; `0` is a claim that the value is zero, and the codebase
  treats them as genuinely different things.
- **Confidence, honestly.** `CONFIRMED` means the source states it outright.
  If you inferred it, it is an estimate — say so. Overstated confidence is worse
  than a missing row.

### How to submit

**Use the form at [tracker.bepresearch.com/submit](https://tracker.bepresearch.com/submit).**
No account, no GitHub, no setup. Paste the URL, quote the sentence the figure
comes from, and add the figures if you have them. It lands in the same review
queue the automated watchers feed, and a maintainer decides what it changes.

**Or open an issue** using the data template, if you would rather work in git.
Both paths end in the same place; neither is faster than the other.

An account is optional and grants no editing rights — it exists so your
submissions are attributed and you can see at
[/account](https://tracker.bepresearch.com/account) what a reviewer decided.

> **Do not open a pull request against `data/`.** Those files are a *generated
> snapshot*, exported from the live database and refreshed every night. A change
> merged into them would be overwritten within a day, and your work would vanish
> for reasons that had nothing to do with whether it was right. The database is
> the source of truth; `data/` is what falls out of it.

A maintainer reads your source, records the claim with its confidence level, and
replies on the issue with a link to the updated project page — so you can check
that what landed matches what you meant. Code pull requests are a different
story and are very welcome; see below.

Corrections are as welcome as additions. If a figure here is wrong, say so and
show why; that is more valuable than a new row.

---

## Contributing code

Please open an issue before anything large, so you do not build something that
gets turned down on direction.

```bash
npm install
docker compose up -d          # or a local Postgres — see the README
npx prisma migrate dev
npm run db:seed               # demo data, all flagged isDemoData
npm run dev
```

Before opening a PR:

```bash
npm run check                 # typecheck + lint + 190 tests
npm run test:e2e              # Playwright
```

CI runs all of that against a real Postgres container.

### Things that will get a PR sent back

- **Treating unknown as zero.** `lib/format.ts` exists to prevent this. No
  `|| 0`, no `if (!mw)` — a confirmed zero must not render as "Not disclosed",
  and a missing value must not render as `0`.
- **Letting a machine promote its own claim.** Extractors cap at `LOW`. Raising
  confidence is a human act, enforced in the service layer rather than the UI.
- **Business logic in components.** It goes in `lib/services/*` so it stays
  callable from a script, a test and a route handler alike.
- **Inferring links from location strings.** Restrictions attach to projects
  explicitly. A wrong inference silently moves the headline MW-at-risk figure,
  which is the one number the siting page exists to produce.
- **A material edit with no revision.** History is the product.

Comments should explain *why*, not restate the code. The existing ones are the
house style — several document a decision that looks wrong until you know what
went wrong without it.

---

## Licensing

Code is MIT. Data is CC BY 4.0 — see `LICENSE` and `LICENSE-DATA`. By
contributing you agree your work is released under those terms.

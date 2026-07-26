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

**Open an issue** using the data template. Fastest, no setup, good for one-offs.

**Open a pull request** against the data files if you are comfortable with git.
CI validates every row against the same Zod schemas the application uses, so you
get the same errors an analyst would — bad enum, negative megawatts, a
`CONFIRMED` claim with no source — before a human ever looks.

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

---

## Conduct

[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) applies to every issue, PR and
review. The short version, for a project that exists to argue about numbers:
attack the figure, never the person who entered it. Everyone here will be
confidently wrong in public eventually, maintainers included.

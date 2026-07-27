# Data snapshot

Machine-readable export of the live tracker, refreshed automatically.

> **Generated — do not edit.** These files are rebuilt from the database every
> night and force-committed, so an edit here is overwritten within a day. To
> correct a figure, [open an issue](https://github.com/benitoz858/bep-infra-tracker/issues/new?labels=data)
> with a source; see [CONTRIBUTING.md](../CONTRIBUTING.md).

| File | Contents |
| --- | --- |
| `projects.csv` / `projects.json` | One row per project. Estimated and confirmed figures are **separate columns** — `power_mw_basis` tells you which one to trust for that row. |
| `companies.csv` | Owners, operators and vendors, with tickers where listed. |
| `sources.csv` | Every source cited, with publisher and reliability score. |
| `metrics.csv` | One row per individual claim, with its confidence level, methodology and the source backing it. This is the provenance trail. |

## Reading it honestly

- **A blank cell means "not disclosed", never zero.** Do not fill blanks with 0
  before summing — you will invent capacity that nobody announced.
- **Announced is not confirmed.** Most capacity in this dataset is announced and
  not yet energised. Use `power_mw_basis`, and check `metrics.csv` for the
  confidence level behind any figure you intend to cite.
- **Rows with `is_demo_data=TRUE` are illustrative** and must not be used in
  analysis. Production should contain none; the column exists so that promise is
  checkable rather than merely stated.

Licensed **CC BY 4.0**. Credit: BEP AI Infrastructure Tracker (BEP Research),
https://tracker.bepresearch.com

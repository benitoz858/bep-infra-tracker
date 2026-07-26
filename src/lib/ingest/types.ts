import type { SourceType } from "@/generated/prisma/enums";

/**
 * Watcher and extractor contracts.
 *
 * A watcher answers "what is new out there"; an extractor answers "what does
 * this item claim". They are separate so a watcher can be swapped without
 * touching claim parsing, and so an extractor can be tested on fixed input.
 *
 * Neither is allowed to write to the database. Both return plain data, which
 * lib/services/ingestion.ts stages for human review.
 */

/** One item a watcher found. Nothing here is a fact yet. */
export type WatchedItem = {
  url: string;
  title: string;
  publisher?: string;
  publicationDate?: Date;
  sourceType?: SourceType;
  /** Raw text the extractor will read: feed summary, filing abstract, etc. */
  text?: string;
};

export interface Watcher {
  /** Stable id, recorded on every run and candidate: "rss:microsoft-newsroom". */
  readonly key: string;
  readonly label: string;
  /** Publisher applied to items that do not carry their own. */
  readonly publisher?: string;
  readonly defaultSourceType?: SourceType;
  run(options: { since?: Date; limit?: number }): Promise<WatchedItem[]>;
}

/** A claim an extractor proposes. Mirrors candidateClaimSchema. */
export type ProposedClaim = {
  metricType:
    | "POWER_MW"
    | "GPU_COUNT"
    | "CAPEX_USD"
    | "SQUARE_FEET"
    | "RACK_COUNT"
    | "LAND_ACRES"
    | "PUE"
    | "OPENING_DATE"
    | "OTHER";
  numericValue: number | null;
  textValue: string | null;
  unit: string | null;
  /**
   * Machine-proposed claims are capped at LOW by lib/services/ingestion.ts on
   * accept. An extractor cannot promote its own output to CONFIRMED — that
   * judgement is the reviewer's, and it is the entire point of the queue.
   */
  confidenceLevel: "LOW" | "ESTIMATED";
  methodology: string;
};

export interface ClaimExtractor {
  /** Recorded on the candidate: "heuristic", "claude:<model>", "none". */
  readonly key: string;
  extract(item: WatchedItem): Promise<ProposedClaim[]>;
}

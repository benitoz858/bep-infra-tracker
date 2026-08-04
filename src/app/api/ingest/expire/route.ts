import { handler, ok } from "@/lib/api";
import { requireCapability } from "@/lib/permissions";
import { expireStaleCandidates } from "@/lib/services/ingestion";

/**
 * Expire watcher candidates that have sat unreviewed past the expiry window.
 * The scheduled ingest run does this automatically; this endpoint is the same
 * operation on demand, for clearing a backlog without waiting for the cron.
 * Expiring changes review state, so it needs the same rights as reviewing.
 */
export const POST = handler(async () => {
  await requireCapability("record:create");
  const expired = await expireStaleCandidates();
  return ok({ expired });
});

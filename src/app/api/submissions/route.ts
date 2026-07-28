import { handler, ok, parseJson } from "@/lib/api";
import { getSessionUser } from "@/lib/permissions";
import { createPublicSubmission } from "@/lib/services/submissions";
import { publicSubmissionSchema } from "@/lib/validations/submission";

/**
 * The one write endpoint with no capability check.
 *
 * That is safe because of what it writes: a PENDING IngestionCandidate, which
 * is a proposal and nothing more. It cannot reach Project, Source or
 * ProjectMetric — only a reviewer accepting it at /ingest can do that. So the
 * worst an abuser achieves is noise in a queue a human already reads, which is
 * what the rate limits in the service are sized against.
 */
export const POST = handler(async (request: Request) => {
  // A session is optional here. When present it attributes the submission so
  // the submitter can follow it; when absent the submission is still welcome.
  const user = await getSessionUser();
  const input = await parseJson(request, publicSubmissionSchema);

  // Cloudflare sets CF-Connecting-IP on every request it proxies and strips any
  // client-supplied copy, so it cannot be spoofed the way X-Forwarded-For can.
  // The fallbacks only matter in local development.
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  const result = await createPublicSubmission(input, { ip, userId: user?.id });

  return ok(result, { status: 201 });
});

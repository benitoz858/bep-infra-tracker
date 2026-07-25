import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthError } from "@/lib/permissions";
import { ServiceError } from "@/lib/services/errors";

/**
 * One response shape for every API route.
 *
 * Success: { data: T }
 * Failure: { error: { code, message, details? } }
 *
 * Clients can therefore branch on the presence of `error` without knowing
 * which endpoint they called.
 */
export type ApiError = {
  error: { code: string; message: string; details?: unknown };
};

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function fail(
  code: string,
  message: string,
  status: number,
  details?: unknown,
): NextResponse<ApiError> {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

/**
 * Wraps a route handler so thrown domain errors become correct status codes
 * instead of a generic 500. Keeps every handler free of try/catch boilerplate.
 */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export function toErrorResponse(error: unknown): NextResponse<ApiError> {
  if (error instanceof AuthError) {
    return fail(
      error.status === 401 ? "unauthenticated" : "forbidden",
      error.message,
      error.status,
    );
  }

  if (error instanceof ZodError) {
    return fail("validation_failed", "The submitted data is invalid.", 422, {
      issues: error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
  }

  if (error instanceof ServiceError) {
    return fail(error.code, error.message, error.status, error.details);
  }

  // Unexpected: log server-side, return an opaque message so internal details
  // (table names, connection strings) never reach the client.
  console.error("[api] unhandled error", error);
  return fail("internal_error", "An unexpected error occurred.", 500);
}

/** Parse and validate a JSON body, letting ZodError bubble to the handler. */
export async function parseJson<T>(
  request: Request,
  schema: { parse: (input: unknown) => T },
): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ServiceError("invalid_json", "Request body is not valid JSON.", 400);
  }
  return schema.parse(body);
}

/**
 * Domain errors raised by the service layer. Services must not import
 * next/server or return HTTP responses — they throw these, and lib/api.ts maps
 * them to status codes. That keeps every service callable from a script, a
 * test, or a server component as well as from a route handler.
 */
export class ServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number = 400,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export class NotFoundError extends ServiceError {
  constructor(what: string) {
    super("not_found", `${what} not found.`, 404);
  }
}

export class ConflictError extends ServiceError {
  constructor(message: string, details?: unknown) {
    super("conflict", message, 409, details);
  }
}

/** Raised when a data-quality rule blocks a write. */
export class DataQualityError extends ServiceError {
  constructor(message: string, details?: unknown) {
    super("data_quality", message, 422, details);
  }
}

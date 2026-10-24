// Typed application errors. Services throw these; `withRouteHandler` maps them to the API
// error format (API_SPECIFICATION §1.2). Messages must be safe to show to users.

export type FieldErrors = Record<string, string>;

type AppErrorOptions = {
  code?: string;
  fields?: FieldErrors;
  cause?: unknown;
};

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: FieldErrors | undefined;

  constructor(status: number, defaultCode: string, message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.status = status;
    this.code = options.code ?? defaultCode;
    this.fields = options.fields;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Some details need fixing.", options: AppErrorOptions = {}) {
    super(400, "VALIDATION_ERROR", message, options);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Please sign in to continue.", options: AppErrorOptions = {}) {
    super(401, "UNAUTHENTICATED", message, options);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You can't do that.", options: AppErrorOptions = {}) {
    super(403, "FORBIDDEN", message, options);
  }
}

/** Also used for resources that exist but are not visible to the actor (never reveal existence). */
export class NotFoundError extends AppError {
  constructor(message = "We couldn't find that.", options: AppErrorOptions = {}) {
    super(404, "NOT_FOUND", message, options);
  }
}

export class ConflictError extends AppError {
  constructor(message = "That already exists.", options: AppErrorOptions = {}) {
    super(409, "CONFLICT", message, options);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = "That file is too large.", options: AppErrorOptions = {}) {
    super(413, "PAYLOAD_TOO_LARGE", message, options);
  }
}

export class UnprocessableError extends AppError {
  constructor(message = "We couldn't complete that.", options: AppErrorOptions = {}) {
    super(422, "UNPROCESSABLE", message, options);
  }
}

/** An outside service we depend on (e.g. email) failed; the user can try again later. */
export class ServiceUnavailableError extends AppError {
  constructor(
    message = "That didn't work on our side. Please try again in a few minutes.",
    options: AppErrorOptions = {},
  ) {
    super(503, "SERVICE_UNAVAILABLE", message, options);
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterSeconds: number;

  constructor(
    retryAfterSeconds: number,
    message = "Too many attempts. Please wait a moment and try again.",
    options: AppErrorOptions = {},
  ) {
    super(429, "RATE_LIMITED", message, options);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

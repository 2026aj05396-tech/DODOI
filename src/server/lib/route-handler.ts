import "server-only";

import { unstable_rethrow } from "next/navigation";
import type { NextRequest } from "next/server";
import type { z } from "zod";

import type { ApiErrorBody } from "@/lib/types/api";
import { getActor } from "@/server/auth";
import type { Actor, AuthenticatedActor } from "@/server/lib/actor";
import {
  AppError,
  ForbiddenError,
  RateLimitError,
  UnauthenticatedError,
  ValidationError,
  type FieldErrors,
} from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { isSameOriginRequest } from "@/server/lib/origin";

// Every API route handler is wrapped with `withRouteHandler` (CODE_QUALITY §9.1). It owns:
// request ids, cross-site request rejection, session lookup, input parsing, AppError → HTTP mapping
// and error logging.

type RouteSchemas = {
  /**
   * Who may call the route. Required, so every route states it: "user" answers 401 to signed-out
   * callers and hands the handler a non-null actor; "public" passes the actor, which may be null.
   */
  auth: "public" | "user";
  /**
   * Signed-in users who have not passed the 18+ check get 403 AGE_CHECK_REQUIRED on every route
   * (API_SPECIFICATION §3). Only the age check itself sets this.
   */
  allowBeforeAgeCheck?: true;
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
};

type Parsed<TSchema> = TSchema extends z.ZodType ? z.output<TSchema> : undefined;

export type RouteHandlerInput<TSchemas extends RouteSchemas> = {
  request: NextRequest;
  requestId: string;
  actor: TSchemas["auth"] extends "user" ? AuthenticatedActor : Actor;
  body: Parsed<TSchemas["body"]>;
  query: Parsed<TSchemas["query"]>;
  params: Parsed<TSchemas["params"]>;
};

type NextRouteContext = { params: Promise<Record<string, string | string[] | undefined>> };

const GENERIC_ERROR_MESSAGE = "Something went wrong on our side. Please try again.";

export function createRequestId(): string {
  return `req_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function toFieldErrors(issues: readonly z.core.$ZodIssue[]): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "_";
    fields[key] ??= issue.message;
  }
  return fields;
}

function parseInput<TSchema extends z.ZodType | undefined>(
  schema: TSchema,
  input: unknown,
): Parsed<TSchema> {
  if (schema === undefined) return undefined as Parsed<TSchema>;
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(undefined, { fields: toFieldErrors(result.error.issues) });
  }
  return result.data as Parsed<TSchema>;
}

async function readJsonBody(request: NextRequest): Promise<unknown> {
  const text = await request.text();
  if (text.length === 0) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new ValidationError("The request body is not valid JSON.", { cause: error });
  }
}

function errorResponse(error: unknown, requestId: string, request: NextRequest): Response {
  const headers = new Headers({ "x-request-id": requestId, "cache-control": "private, no-store" });

  if (error instanceof AppError) {
    if (error instanceof RateLimitError) {
      headers.set("retry-after", String(error.retryAfterSeconds));
    }
    const body: ApiErrorBody = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.fields ? { fields: error.fields } : {}),
        requestId,
      },
    };
    return Response.json(body, { status: error.status, headers });
  }

  logger.error("Unhandled error in route handler", {
    requestId,
    method: request.method,
    path: request.nextUrl.pathname,
    error,
  });
  const body: ApiErrorBody = {
    error: { code: "INTERNAL_ERROR", message: GENERIC_ERROR_MESSAGE, requestId },
  };
  return Response.json(body, { status: 500, headers });
}

export function withRouteHandler<TSchemas extends RouteSchemas>(
  schemas: TSchemas,
  handler: (input: RouteHandlerInput<TSchemas>) => Promise<Response>,
): (request: NextRequest, context: NextRouteContext) => Promise<Response> {
  return async (request, context) => {
    const requestId = createRequestId();
    try {
      if (!isSameOriginRequest(request)) {
        throw new ForbiddenError("This request didn't come from dodoi.", {
          code: "CROSS_ORIGIN_REQUEST",
        });
      }
      const actor = await getActor();
      if (schemas.auth === "user" && actor === null) throw new UnauthenticatedError();
      if (actor && !actor.isAgeConfirmed && !schemas.allowBeforeAgeCheck) {
        throw new ForbiddenError("Please confirm your date of birth to continue.", {
          code: "AGE_CHECK_REQUIRED",
        });
      }

      const params = parseInput<TSchemas["params"]>(schemas.params, await context.params);
      const query = parseInput<TSchemas["query"]>(
        schemas.query,
        Object.fromEntries(request.nextUrl.searchParams.entries()),
      );
      const body = parseInput<TSchemas["body"]>(
        schemas.body,
        schemas.body === undefined ? undefined : await readJsonBody(request),
      );

      const response = await handler({
        request,
        requestId,
        // Narrowed by the 401 check above when `auth` is "user".
        actor: actor as RouteHandlerInput<TSchemas>["actor"],
        body,
        query,
        params,
      });
      response.headers.set("x-request-id", requestId);
      if (!response.headers.has("cache-control")) {
        response.headers.set("cache-control", "private, no-store");
      }
      return response;
    } catch (error) {
      // Next.js signals (e.g. "this route reads the request, so it can't be prerendered") are
      // control flow, not failures: let Next handle them instead of answering 500.
      unstable_rethrow(error);
      return errorResponse(error, requestId, request);
    }
  };
}

/** 200 with a JSON body. */
export function ok(data: unknown): Response {
  return Response.json(data, { status: 200 });
}

/** 201 with a JSON body. */
export function created(data: unknown): Response {
  return Response.json(data, { status: 201 });
}

/** 204 without a body. */
export function noContent(): Response {
  return new Response(null, { status: 204 });
}

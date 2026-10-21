import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { ApiErrorBody } from "@/lib/types/api";
import { NotFoundError, RateLimitError } from "@/server/lib/errors";
import { noContent, ok, withRouteHandler } from "@/server/lib/route-handler";

const noParams = { params: Promise.resolve({}) };

function jsonRequest(body: string, url = "http://localhost/api/test"): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    body,
    headers: { "content-type": "application/json" },
  });
}

async function readError(response: Response): Promise<ApiErrorBody["error"]> {
  const body = (await response.json()) as ApiErrorBody;
  return body.error;
}

describe("withRouteHandler", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it("passes parsed input to the handler and adds request id and no-store headers", async () => {
    const handler = withRouteHandler(
      {
        body: z.object({ name: z.string() }),
        query: z.object({ limit: z.coerce.number() }),
        params: z.object({ id: z.string() }),
      },
      async ({ body, query, params }) => ok({ name: body.name, limit: query.limit, id: params.id }),
    );

    const response = await handler(
      jsonRequest('{"name":"Crochet"}', "http://localhost/api/x?limit=5"),
      {
        params: Promise.resolve({ id: "abc" }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ name: "Crochet", limit: 5, id: "abc" });
    expect(response.headers.get("x-request-id")).toMatch(/^req_[0-9a-f]{32}$/);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("returns 400 VALIDATION_ERROR with field messages when the body is invalid", async () => {
    const handler = withRouteHandler({ body: z.object({ name: z.string().min(2) }) }, async () =>
      noContent(),
    );

    const response = await handler(jsonRequest('{"name":"a"}'), noParams);
    const error = await readError(response);

    expect(response.status).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.fields).toHaveProperty("name");
    expect(error.requestId).toBe(response.headers.get("x-request-id"));
  });

  it("returns 400 when the body is not valid JSON", async () => {
    const handler = withRouteHandler({ body: z.object({}) }, async () => noContent());

    const response = await handler(jsonRequest("{not json"), noParams);

    expect(response.status).toBe(400);
    expect((await readError(response)).code).toBe("VALIDATION_ERROR");
  });

  it("maps AppError subclasses to their status and code", async () => {
    const handler = withRouteHandler({}, async () => {
      throw new NotFoundError();
    });

    const response = await handler(jsonRequest(""), noParams);

    expect(response.status).toBe(404);
    expect((await readError(response)).code).toBe("NOT_FOUND");
  });

  it("uses a custom error code when one is given", async () => {
    const handler = withRouteHandler({}, async () => {
      throw new NotFoundError(undefined, { code: "POST_NOT_FOUND" });
    });

    const response = await handler(jsonRequest(""), noParams);

    expect((await readError(response)).code).toBe("POST_NOT_FOUND");
  });

  it("sets Retry-After for rate-limit errors", async () => {
    const handler = withRouteHandler({}, async () => {
      throw new RateLimitError(30);
    });

    const response = await handler(jsonRequest(""), noParams);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
  });

  it("rejects a mutation sent from another site before running the handler", async () => {
    let handlerRan = false;
    const handler = withRouteHandler({}, async () => {
      handlerRan = true;
      return noContent();
    });
    const request = new NextRequest("http://dodoi.test/api/test", {
      method: "POST",
      headers: { origin: "https://evil.example", host: "dodoi.test" },
    });

    const response = await handler(request, noParams);

    expect(response.status).toBe(403);
    expect((await readError(response)).code).toBe("CROSS_ORIGIN_REQUEST");
    expect(handlerRan).toBe(false);
  });

  it("returns a generic 500 for unexpected errors without leaking internals", async () => {
    const handler = withRouteHandler({}, async () => {
      throw new Error("relation users does not exist");
    });

    const response = await handler(jsonRequest(""), noParams);
    const error = await readError(response);

    expect(response.status).toBe(500);
    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.message).not.toContain("relation");
    expect(stderrSpy).toHaveBeenCalledOnce();
  });
});

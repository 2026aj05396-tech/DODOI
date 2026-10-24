import type { ApiErrorBody } from "@/lib/types/api";

// Browser → /api calls (CODE_QUALITY §3.3). Errors arrive in the API error format
// (API_SPECIFICATION §1.2) and are thrown as ApiRequestError with a message safe to show.

const NETWORK_ERROR_MESSAGE = "We couldn't reach dodoi. Check your connection and try again.";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string>;

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === "object" && value !== null && "error" in value;
}

/** POSTs JSON and returns the parsed response body (undefined for 204). */
export async function postJson<TResponse = undefined>(
  path: string,
  body?: unknown,
): Promise<TResponse> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiRequestError(0, "NETWORK_ERROR", NETWORK_ERROR_MESSAGE);
  }

  if (response.status === 204) return undefined as TResponse;
  const data: unknown = await response.json().catch(() => undefined);
  if (response.ok) return data as TResponse;
  if (isApiErrorBody(data)) {
    const { code, message, fields } = data.error;
    throw new ApiRequestError(response.status, code, message, fields);
  }
  throw new ApiRequestError(response.status, "INTERNAL_ERROR", NETWORK_ERROR_MESSAGE);
}

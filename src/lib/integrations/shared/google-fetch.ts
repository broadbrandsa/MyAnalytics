import "server-only";

/**
 * Thin JSON fetch wrapper for Google REST APIs (GA4, GSC, Ads). Adds the bearer
 * token, parses JSON, and raises a typed error carrying the HTTP status + the
 * Google error `status` string (e.g. UNAUTHENTICATED, PERMISSION_DENIED,
 * RESOURCE_EXHAUSTED) so callers can map to the doc 04–07 action tables.
 * Never logs the token.
 */
export class GoogleApiError extends Error {
  httpStatus: number;
  statusCode?: string; // e.g. "PERMISSION_DENIED"
  constructor(message: string, httpStatus: number, statusCode?: string) {
    super(message);
    this.name = "GoogleApiError";
    this.httpStatus = httpStatus;
    this.statusCode = statusCode;
  }
}

export async function googleFetchJson(
  url: string,
  accessToken: string,
  init?: RequestInit,
): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const text = await res.text();
  const json = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const err = (json as { error?: { message?: string; status?: string } })
      ?.error;
    throw new GoogleApiError(
      err?.message ?? `Google API error (HTTP ${res.status})`,
      res.status,
      err?.status,
    );
  }
  return json;
}

export function isUnauthenticated(err: unknown): boolean {
  return (
    err instanceof GoogleApiError &&
    (err.httpStatus === 401 || err.statusCode === "UNAUTHENTICATED")
  );
}

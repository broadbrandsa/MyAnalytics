import { GoogleApiError } from "@/lib/integrations/shared/google-fetch";
import { InvalidGrantError } from "@/lib/integrations/shared/google-auth";
import { MetaApiError } from "@/lib/integrations/meta/client";

/**
 * Maps platform errors to the actions in docs 04–07:
 *  - needs_reauth : credential is dead (invalid_grant, Meta 190) → flag creds
 *  - deactivate   : source lost access (PERMISSION_DENIED, account gone)
 *  - defer        : transient/quota (429, RESOURCE_EXHAUSTED, Meta 80000/4)
 *  - fail         : anything else — record and move on
 */
export type SyncAction = "needs_reauth" | "deactivate" | "defer" | "fail";

export interface ClassifiedError {
  action: SyncAction;
  errorCode: string;
  errorMessage: string;
}

export function classifyError(err: unknown): ClassifiedError {
  if (err instanceof InvalidGrantError) {
    return {
      action: "needs_reauth",
      errorCode: "invalid_grant",
      errorMessage: "Google authorization expired.",
    };
  }

  if (err instanceof GoogleApiError) {
    const code = err.statusCode ?? `HTTP_${err.httpStatus}`;
    if (err.httpStatus === 401 || err.statusCode === "UNAUTHENTICATED") {
      return { action: "needs_reauth", errorCode: code, errorMessage: err.message };
    }
    if (err.statusCode === "PERMISSION_DENIED" || err.httpStatus === 403) {
      return { action: "deactivate", errorCode: code, errorMessage: err.message };
    }
    if (err.statusCode === "RESOURCE_EXHAUSTED" || err.httpStatus === 429) {
      return { action: "defer", errorCode: code, errorMessage: err.message };
    }
    return { action: "fail", errorCode: code, errorMessage: err.message };
  }

  if (err instanceof MetaApiError) {
    const code = `meta_${err.code ?? "err"}${err.subcode ? `_${err.subcode}` : ""}`;
    if (err.code === 190) {
      return { action: "needs_reauth", errorCode: code, errorMessage: err.message };
    }
    // 80000 throttle, 4 global load-shed → defer
    if (err.code === 80000 || err.code === 4) {
      return { action: "defer", errorCode: code, errorMessage: err.message };
    }
    // 100/1487534 data-per-call cap is handled inside the sync (window halving);
    // if it bubbles up, treat as failure.
    return { action: "fail", errorCode: code, errorMessage: err.message };
  }

  return {
    action: "fail",
    errorCode: "unknown",
    errorMessage: err instanceof Error ? err.message : "Unknown sync error",
  };
}

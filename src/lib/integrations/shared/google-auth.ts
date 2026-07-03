import "server-only";
import {
  GOOGLE_TOKEN_URL,
  GOOGLE_AUTH_URL,
  GOOGLE_SCOPES,
} from "@/lib/constants";
import { readSecret } from "@/lib/integrations/shared/vault";

/**
 * Google access-token minting from the single agency refresh token.
 * One refresh token mints access tokens for GA4 + GSC + Google Ads.
 *
 * Access tokens are cached in-memory PER INVOCATION only (module-scope map that
 * lives for the lifetime of a serverless function instance) — never persisted.
 *
 * `invalid_grant` → caller marks the credential `needs_reauth` (docs 04–07).
 *
 * Phase 2 wires this into the OAuth callback + source pickers; Phase 3 uses it
 * from the sync workers.
 */

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

const cache = new Map<string, CachedToken>();

export class InvalidGrantError extends Error {
  constructor(message = "invalid_grant") {
    super(message);
    this.name = "InvalidGrantError";
  }
}

/**
 * Returns a valid access token for the given credential, minting a fresh one
 * from the Vault-stored refresh token when the cached token is missing/stale.
 */
export async function getGoogleAccessToken(
  vaultSecretId: string,
): Promise<string> {
  const now = Date.now();
  const cached = cache.get(vaultSecretId);
  // 60s safety margin before expiry.
  if (cached && cached.expiresAt - 60_000 > now) return cached.accessToken;

  const refreshToken = await readSecret(vaultSecretId);

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!res.ok || !json.access_token) {
    if (json.error === "invalid_grant") throw new InvalidGrantError();
    throw new Error(`Google token refresh failed: ${json.error ?? res.status}`);
  }

  const token: CachedToken = {
    accessToken: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600) * 1000,
  };
  cache.set(vaultSecretId, token);
  return token.accessToken;
}

/**
 * Builds the Google OAuth consent URL for the one agency grant.
 * `access_type=offline` + `prompt=consent` guarantees a refresh token every
 * time (doc 08 §A.5). `include_granted_scopes` merges previously granted scopes.
 */
export function buildGoogleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export interface GoogleTokenExchange {
  refreshToken: string;
  accessToken: string;
  scopes: string[];
  expiresIn: number;
}

/**
 * Exchanges an OAuth authorization code for tokens. Returns the refresh token
 * (to store in Vault) plus granted scopes. Throws if no refresh token comes
 * back (happens when the user previously granted without prompt=consent).
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<GoogleTokenExchange> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code,
    }),
  });

  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !json.access_token) {
    throw new Error(
      `Google code exchange failed: ${json.error_description ?? json.error ?? res.status}`,
    );
  }
  if (!json.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Re-authorize with consent (revoke prior access at myaccount.google.com/permissions).",
    );
  }

  return {
    refreshToken: json.refresh_token,
    accessToken: json.access_token,
    scopes: json.scope ? json.scope.split(" ") : [],
    expiresIn: json.expires_in ?? 3600,
  };
}

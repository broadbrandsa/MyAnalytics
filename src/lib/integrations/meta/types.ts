// Meta Ads (Marketing API) — zod schemas for API responses (CLAUDE.md rule #10)
// and normalized types. Sync-metric schemas are added in Phase 3.
import { z } from "zod";

/** GET /me?fields=id,name — token validation. */
export const metaMeSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
});

/** GET /oauth/access_token — long-lived token exchange. */
export const metaTokenExchangeSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  expires_in: z.number().optional(), // seconds; may be absent for non-expiring
});

/** GET /me/adaccounts — one page. */
export const metaAdAccountSchema = z.object({
  id: z.string(), // "act_<ACCOUNT_ID>"
  name: z.string().optional(),
  account_status: z.number().optional(), // 1 = active
  currency: z.string().optional(),
  timezone_name: z.string().optional(),
});

export const metaAdAccountsPageSchema = z.object({
  data: z.array(metaAdAccountSchema),
  paging: z
    .object({
      next: z.string().optional(),
      cursors: z.object({ after: z.string().optional() }).optional(),
    })
    .optional(),
});

/** Meta error envelope. */
export const metaErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string().optional(),
    code: z.number().optional(),
    error_subcode: z.number().optional(),
    fbtrace_id: z.string().optional(),
  }),
});

export type MetaAdAccount = z.infer<typeof metaAdAccountSchema>;

/** Pure parse of one /me/adaccounts page (unit-testable). */
export function parseMetaAdAccountsPage(json: unknown): {
  accounts: MetaAdAccount[];
  after?: string;
} {
  const page = metaAdAccountsPageSchema.parse(json);
  return {
    accounts: page.data,
    after: page.paging?.next ? page.paging?.cursors?.after : undefined,
  };
}

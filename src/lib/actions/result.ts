/** Shared discriminated result type for form Server Actions. */
export type ActionResult =
  | { ok: true; message?: string; redirectTo?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Flatten a zod error into a flat field->message map for form display. */
export function fieldErrorsFromZod(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0] != null ? String(issue.path[0]) : "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

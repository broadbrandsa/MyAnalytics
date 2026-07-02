import { z } from "zod";

/** kebab-case a display name into a URL-safe slug. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Enter a hex color, e.g. #4f46e5");

// Client org create/update. Slug is derived server-side from name when omitted.
export const clientSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(120),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only")
    .max(60)
    .optional()
    .or(z.literal("")),
  brand_color: hexColor.optional().or(z.literal("")),
  logo_url: z.url("Enter a valid URL").optional().or(z.literal("")),
  timezone: z.string().trim().min(1).default("Africa/Johannesburg"),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, "Use a 3-letter code, e.g. ZAR")
    .default("ZAR"),
});

export type ClientInput = z.infer<typeof clientSchema>;

export const APP_ROLES = ["super_admin", "admin", "client_viewer"] as const;

// User invite. client_id is required for client_viewers, forbidden for admins.
export const inviteSchema = z
  .object({
    email: z.email("Enter a valid email").trim().toLowerCase(),
    full_name: z.string().trim().min(1, "Name is required").max(120),
    role: z.enum(APP_ROLES),
    client_id: z.uuid().optional().or(z.literal("")),
  })
  .refine(
    (v) => v.role !== "client_viewer" || (v.client_id && v.client_id !== ""),
    { message: "Select a client for viewer accounts", path: ["client_id"] },
  );

export type InviteInput = z.infer<typeof inviteSchema>;

export const roleChangeSchema = z.object({
  user_id: z.uuid(),
  role: z.enum(APP_ROLES),
});

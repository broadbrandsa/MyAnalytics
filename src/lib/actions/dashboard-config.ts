"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeSections, type SectionSetting } from "@/lib/dashboard/sections";
import { RANGE_PRESETS, type RangePreset } from "@/lib/dashboard/range";
import { type ActionResult } from "@/lib/actions/result";
import type { Json } from "@/lib/database.types";

const VALID_PRESETS = new Set(RANGE_PRESETS.map((p) => p.value));

export interface DashboardConfigInput {
  sections: SectionSetting[];
  defaultDateRange: string;
  notes: string;
  metaPrimaryAction?: string;
}

/**
 * Persist a client's dashboard configuration (section order/visibility, default
 * date range, annotation note) to dashboard_configs, and the Meta primary
 * action onto the client's Meta data sources. The client dashboard reads this
 * immediately (revalidated).
 */
export async function updateDashboardConfig(
  clientId: string,
  input: DashboardConfigInput,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const sections = normalizeSections(input.sections);
  const defaultDateRange = VALID_PRESETS.has(input.defaultDateRange as RangePreset)
    ? input.defaultDateRange
    : "last_28_days";
  const notes = input.notes.trim().slice(0, 2000);

  const supabase = await createClient();
  const { error } = await supabase.from("dashboard_configs").upsert(
    {
      client_id: clientId,
      config: { sections } as unknown as Json,
      default_date_range: defaultDateRange,
      notes: notes || null,
      updated_by: admin.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id" },
  );
  if (error) return { ok: false, error: error.message };

  // Meta primary action lives on the meta_ads data source(s).
  if (input.metaPrimaryAction !== undefined) {
    const action = input.metaPrimaryAction.trim();
    const { data: metaSources } = await supabase
      .from("data_sources")
      .select("id, config")
      .eq("client_id", clientId)
      .eq("source", "meta_ads");
    for (const s of metaSources ?? []) {
      const cfg = { ...(s.config as Record<string, unknown>) };
      if (action) cfg.primary_action = action;
      else delete cfg.primary_action;
      await supabase
        .from("data_sources")
        .update({ config: cfg as unknown as Json })
        .eq("id", s.id);
    }
  }

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath(`/admin/clients/${clientId}/preview`);
  return { ok: true, message: "Dashboard settings saved." };
}

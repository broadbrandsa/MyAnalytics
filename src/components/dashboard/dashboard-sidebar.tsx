import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtAgo } from "@/lib/dashboard/format";
import { SECTION_LABELS, type SectionSetting } from "@/lib/dashboard/sections";
import type { Source } from "@/lib/constants";
import type { DashboardData } from "@/lib/dashboard/types";

const SOURCE_ORDER: { key: Source; section: string }[] = [
  { key: "ga4", section: "ga4" },
  { key: "gsc", section: "gsc" },
  { key: "google_ads", section: "google_ads" },
  { key: "meta_ads", section: "meta_ads" },
];

/**
 * Left rail for the client dashboard (design direction 1a): brand, Overview +
 * per-source nav (anchors to sections), connection status, and Exit. Nav shows
 * only connected + enabled sources.
 */
export function DashboardSidebar({
  clientName,
  brandColor,
  connected,
  lastSyncedAt,
  sections,
}: {
  clientName: string;
  brandColor: string | null;
  connected: DashboardData["connected"];
  lastSyncedAt: string | null;
  sections: SectionSetting[];
}) {
  const enabled = new Set(sections.filter((s) => s.enabled).map((s) => s.key));
  const navSources = SOURCE_ORDER.filter(
    (s) => connected[s.key] && enabled.has(s.key),
  );
  const connectedCount = Object.values(connected).filter(Boolean).length;

  return (
    <aside className="bg-sidebar border-sidebar-border flex w-56 flex-none flex-col gap-1 border-r p-4 print:hidden">
      <div className="flex items-center gap-2.5 px-1 pb-3">
        <span
          className="border-foreground/80 inline-block size-7 flex-none rounded-md border"
          style={{ backgroundColor: brandColor ?? "var(--primary)" }}
          aria-hidden
        />
        <span className="truncate font-semibold" title={clientName}>
          {clientName}
        </span>
      </div>

      <a
        href="#overview"
        className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-semibold"
      >
        Overview
      </a>

      {navSources.length > 0 && (
        <>
          <p className="text-muted-foreground px-3 pt-3 pb-1 font-mono text-[10px] tracking-wide uppercase">
            Sources
          </p>
          {navSources.map((s) => (
            <a
              key={s.key}
              href={`#${s.section}`}
              className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg px-3 py-2 text-sm transition-colors"
            >
              {SECTION_LABELS[s.key]}
            </a>
          ))}
        </>
      )}

      <div className="mt-auto flex flex-col gap-3 pt-4">
        <div className="border-border rounded-lg border px-3 py-2">
          <p className="text-muted-foreground font-mono text-[10px] tracking-wide uppercase">
            Connected
          </p>
          <p className="text-sm font-semibold">{connectedCount} / 4 sources</p>
          <p className="text-muted-foreground text-xs">
            {lastSyncedAt ? `Updated ${fmtAgo(lastSyncedAt)}` : "Not synced yet"}
          </p>
        </div>
        <form action="/access/exit" method="post">
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full justify-start"
          >
            <LogOut className="size-4" />
            Exit
          </Button>
        </form>
      </div>
    </aside>
  );
}

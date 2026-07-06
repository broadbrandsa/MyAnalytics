"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SECTION_LABELS,
  type SectionSetting,
} from "@/lib/dashboard/sections";
import { RANGE_PRESETS } from "@/lib/dashboard/range";
import { updateDashboardConfig } from "@/lib/actions/dashboard-config";

const META_ACTION_OPTIONS = [
  { value: "", label: "Default (purchase → lead)" },
  { value: "offsite_conversion.fb_pixel_purchase", label: "Pixel purchase" },
  { value: "purchase", label: "Purchase" },
  { value: "lead", label: "Lead" },
  { value: "offsite_conversion.fb_pixel_lead", label: "Pixel lead" },
];

export function DashboardEditor({
  clientId,
  initialSections,
  initialDefaultRange,
  initialNotes,
  initialMetaAction,
}: {
  clientId: string;
  initialSections: SectionSetting[];
  initialDefaultRange: string;
  initialNotes: string;
  initialMetaAction: string;
}) {
  const [sections, setSections] = useState(initialSections);
  const [defaultRange, setDefaultRange] = useState(initialDefaultRange);
  const [notes, setNotes] = useState(initialNotes);
  const [metaAction, setMetaAction] = useState(initialMetaAction);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function move(index: number, dir: -1 | 1) {
    const next = [...sections];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSections(next);
  }

  function toggle(index: number, enabled: boolean) {
    const next = [...sections];
    next[index] = { ...next[index], enabled };
    setSections(next);
  }

  function save() {
    startTransition(async () => {
      const res = await updateDashboardConfig(clientId, {
        sections,
        defaultDateRange: defaultRange,
        notes,
        metaPrimaryAction: metaAction,
      });
      if (res.ok) {
        toast.success(res.message ?? "Saved.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label>Sections</Label>
        <p className="text-muted-foreground text-xs">
          Toggle visibility and reorder how sections appear on the client&apos;s
          dashboard.
        </p>
        <ul className="flex flex-col gap-1.5">
          {sections.map((s, i) => (
            <li
              key={s.key}
              className="flex items-center gap-3 rounded-md border px-3 py-2"
            >
              <GripVertical className="text-muted-foreground size-4" />
              <Checkbox
                checked={s.enabled}
                onCheckedChange={(v) => toggle(i, !!v)}
                aria-label={`Show ${SECTION_LABELS[s.key]}`}
              />
              <span className="flex-1 text-sm font-medium">
                {SECTION_LABELS[s.key]}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                aria-label="Move up"
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={i === sections.length - 1}
                onClick={() => move(i, 1)}
                aria-label="Move down"
              >
                <ArrowDown className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="default-range">Default date range</Label>
          <select
            id="default-range"
            value={defaultRange}
            onChange={(e) => setDefaultRange(e.target.value)}
            className="border-input bg-background h-8 rounded-lg border px-2.5 text-sm"
          >
            {RANGE_PRESETS.filter((p) => p.value !== "custom").map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="meta-action">Meta primary conversion</Label>
          <select
            id="meta-action"
            value={metaAction}
            onChange={(e) => setMetaAction(e.target.value)}
            className="border-input bg-background h-8 rounded-lg border px-2.5 text-sm"
          >
            {META_ACTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Annotation note</Label>
        <p className="text-muted-foreground text-xs">
          Optional message shown at the top of the client&apos;s dashboard.
        </p>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="e.g. Note: Meta data is paused this month while we migrate accounts."
        />
      </div>

      <div>
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save dashboard settings"}
        </Button>
      </div>
    </div>
  );
}

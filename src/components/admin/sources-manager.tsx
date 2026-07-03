"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchAvailableSources,
  assignSource,
  removeSource,
  type SourceOption,
} from "@/lib/actions/sources";
import { SOURCE_META, type DataSourceRow } from "@/lib/sources-shared";
import { SOURCES, type Source } from "@/lib/constants";

export function SourcesManager({
  clientId,
  sources,
}: {
  clientId: string;
  sources: DataSourceRow[];
}) {
  const [picker, setPicker] = useState<Source | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {SOURCES.map((source) => {
        const assigned = sources.filter((s) => s.source === source);
        return (
          <div
            key={source}
            className="flex flex-col gap-3 rounded-lg border p-4"
          >
            <div className="flex items-center justify-between">
              <div className="font-medium">{SOURCE_META[source].label}</div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPicker(source)}
              >
                <Plus className="size-4" />
                Add
              </Button>
            </div>

            {assigned.length === 0 ? (
              <p className="text-muted-foreground text-sm">Not connected.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {assigned.map((s) => (
                  <AssignedRow key={s.id} source={s} clientId={clientId} />
                ))}
              </ul>
            )}
          </div>
        );
      })}

      {picker && (
        <AddSourceDialog
          clientId={clientId}
          source={picker}
          assignedExternalIds={sources
            .filter((s) => s.source === picker)
            .map((s) => s.external_id)}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

function AssignedRow({
  source,
  clientId,
}: {
  source: DataSourceRow;
  clientId: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const currency = (source.config as { currency?: string } | null)?.currency;

  function remove() {
    startTransition(async () => {
      const res = await removeSource(source.id, clientId);
      if (res.ok) {
        toast.success(res.message ?? "Removed.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <li className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
      <div className="min-w-0">
        <div className="truncate font-medium">{source.display_name}</div>
        <div className="text-muted-foreground truncate text-xs">
          {source.external_id}
          {currency ? ` · ${currency}` : ""}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!source.is_active && <Badge variant="outline">Inactive</Badge>}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={remove}
          disabled={pending}
        >
          <Trash2 className="size-4" />
          <span className="sr-only">Remove</span>
        </Button>
      </div>
    </li>
  );
}

function AddSourceDialog({
  clientId,
  source,
  assignedExternalIds,
  onClose,
}: {
  clientId: string;
  source: Source;
  assignedExternalIds: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, startLoad] = useTransition();
  const [assigning, startAssign] = useTransition();
  const [options, setOptions] = useState<SourceOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    startLoad(async () => {
      setError(null);
      const res = await fetchAvailableSources(source);
      if (res.ok) setOptions(res.options);
      else {
        setError(res.error);
        setOptions(null);
      }
    });
  }, [source]);

  // Load once when the dialog opens.
  useEffect(() => {
    load();
  }, [load]);

  function choose(opt: SourceOption) {
    startAssign(async () => {
      const res = await assignSource({
        clientId,
        source,
        externalId: opt.externalId,
        displayName: opt.label,
        currency: opt.currency ?? null,
        timezone: opt.timezone ?? null,
      });
      if (res.ok) {
        toast.success(res.message ?? "Assigned.");
        router.refresh();
        onClose();
      } else {
        toast.error(res.error);
      }
    });
  }

  const available = (options ?? []).filter(
    (o) => !assignedExternalIds.includes(o.externalId),
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[80dvh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add {SOURCE_META[source].label}</DialogTitle>
          <DialogDescription>
            Select an account to assign to this client.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading accounts…
          </div>
        )}

        {error && (
          <div className="flex flex-col gap-3 py-4">
            <p className="text-destructive text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={load} className="w-fit">
              <RefreshCw className="size-4" />
              Retry
            </Button>
          </div>
        )}

        {options && !loading && (
          <div className="max-h-[50dvh] overflow-y-auto">
            {available.length === 0 ? (
              <p className="text-muted-foreground py-6 text-sm">
                No new accounts available to assign.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {available.map((opt) => (
                  <li key={opt.externalId}>
                    <button
                      type="button"
                      disabled={assigning}
                      onClick={() => choose(opt)}
                      className="hover:bg-muted flex w-full flex-col items-start rounded-md px-3 py-2 text-left text-sm transition-colors disabled:opacity-50"
                    >
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-muted-foreground text-xs">
                        {opt.externalId}
                        {opt.sublabel ? ` · ${opt.sublabel}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

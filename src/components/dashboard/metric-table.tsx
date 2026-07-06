import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: keyof T & string;
  label: string;
  numeric?: boolean;
  format?: (value: T[keyof T & string]) => string;
}

/** Compact data table for campaigns / queries / landing pages. */
export function MetricTable<
  T extends Record<string, string | number | null>,
>({
  columns,
  rows,
  empty = "No data for this period.",
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
}) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground p-4 text-sm">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead
                key={c.key}
                className={cn(c.numeric && "text-right")}
              >
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {columns.map((c) => (
                <TableCell
                  key={c.key}
                  className={cn(
                    c.numeric && "text-right tabular-nums",
                    !c.numeric && "max-w-[280px] truncate",
                  )}
                >
                  {c.format
                    ? c.format(row[c.key])
                    : row[c.key] == null
                      ? "—"
                      : String(row[c.key])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

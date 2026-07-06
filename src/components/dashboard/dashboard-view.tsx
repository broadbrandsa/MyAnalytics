import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MetricTable, type Column } from "@/components/dashboard/metric-table";
import { TimeSeries } from "@/components/dashboard/charts/time-series";
import { Donut } from "@/components/dashboard/charts/donut";
import {
  fmtCurrency,
  fmtNumber,
  fmtPct,
  fmtPosition,
} from "@/lib/dashboard/format";
import type { DashboardData } from "@/lib/dashboard/types";

export type SectionKey = "overview" | "ga4" | "google_ads" | "meta_ads" | "gsc";
export interface SectionSetting {
  key: SectionKey;
  enabled: boolean;
}

const DEFAULT_ORDER: SectionKey[] = [
  "overview",
  "ga4",
  "google_ads",
  "meta_ads",
  "gsc",
];

/**
 * The read-only dashboard body: combined Overview + per-source sections. Pure
 * presentation over already-fetched, serialized data (RSC parent does the DB
 * read). Charts are the only client components. `sections` (from
 * dashboard_configs) controls order + visibility; falls back to a sensible
 * default.
 */
export function DashboardView({
  data,
  sections,
}: {
  data: DashboardData;
  sections?: SectionSetting[];
}) {
  const anyConnected = Object.values(data.connected).some(Boolean);

  const order: SectionKey[] =
    sections && sections.length
      ? sections.filter((s) => s.enabled).map((s) => s.key)
      : DEFAULT_ORDER;

  const rendered: Record<SectionKey, React.ReactNode> = {
    overview: <OverviewSection key="overview" data={data} />,
    ga4: data.ga4 ? <Ga4Section key="ga4" data={data} /> : null,
    google_ads: data.gads ? <AdsSection key="google_ads" data={data} /> : null,
    meta_ads: data.meta ? <MetaSection key="meta_ads" data={data} /> : null,
    gsc: data.gsc ? <GscSection key="gsc" data={data} /> : null,
  };

  return (
    <div className="flex flex-col gap-8">
      {order.map((k) => rendered[k])}

      {!anyConnected && (
        <Card>
          <CardHeader>
            <CardTitle>No data sources connected</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Once your Broadbrand account manager connects your Meta, Google Ads,
            GA4, and Search Console accounts, your dashboard will populate here.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function OverviewSection({ data }: { data: DashboardData }) {
  const cur = (v: number) => fmtCurrency(v, data.currency);
  const num = (v: number) => fmtNumber(v);
  return (
    <Section title="Overview">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total spend" kpi={data.overview.spend} format={cur} />
        <KpiCard label="Sessions" kpi={data.overview.sessions} format={num} />
        <KpiCard label="Key events" kpi={data.overview.keyEvents} format={num} />
        <KpiCard
          label="Conversions"
          kpi={data.overview.conversions}
          format={num}
        />
      </div>
    </Section>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Ga4Section({ data }: { data: DashboardData }) {
  const g = data.ga4!;
  const num = (v: number) => fmtNumber(v);
  const pageCols: Column<(typeof g.landingPages)[number]>[] = [
    { key: "page", label: "Landing page" },
    { key: "sessions", label: "Sessions", numeric: true, format: (v) => num(Number(v)) },
    { key: "keyEvents", label: "Key events", numeric: true, format: (v) => num(Number(v)) },
  ];
  const deviceCols: Column<(typeof g.deviceSplit)[number]>[] = [
    { key: "device", label: "Device" },
    { key: "sessions", label: "Sessions", numeric: true, format: (v) => num(Number(v)) },
  ];

  return (
    <Section title="Google Analytics 4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard label="Sessions" kpi={g.kpis.sessions} format={num} />
        <KpiCard label="Total users" kpi={g.kpis.totalUsers} format={num} />
        <KpiCard label="New users" kpi={g.kpis.newUsers} format={num} />
        <KpiCard
          label="Engagement rate"
          kpi={g.kpis.engagementRate}
          format={(v) => fmtPct(v)}
        />
        <KpiCard label="Key events" kpi={g.kpis.keyEvents} format={num} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Sessions over time">
          <TimeSeries
            data={g.sessionsSeries}
            series={[{ key: "sessions", label: "Sessions" }]}
          />
        </ChartCard>
        <ChartCard title="Sessions by channel">
          <Donut data={g.channelDonut} nameKey="channel" valueKey="sessions" />
        </ChartCard>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Top landing pages
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <MetricTable columns={pageCols} rows={g.landingPages} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Devices</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <MetricTable columns={deviceCols} rows={g.deviceSplit} />
          </CardContent>
        </Card>
      </div>
    </Section>
  );
}

function AdsSection({ data }: { data: DashboardData }) {
  const a = data.gads!;
  const num = (v: number) => fmtNumber(v);
  const cur = (v: number) => fmtCurrency(v, data.currency);
  const cols: Column<(typeof a.campaigns)[number]>[] = [
    { key: "name", label: "Campaign" },
    { key: "cost", label: "Cost", numeric: true, format: (v) => cur(Number(v)) },
    { key: "impressions", label: "Impr.", numeric: true, format: (v) => num(Number(v)) },
    { key: "clicks", label: "Clicks", numeric: true, format: (v) => num(Number(v)) },
    { key: "conversions", label: "Conv.", numeric: true, format: (v) => num(Number(v)) },
  ];

  return (
    <Section title="Google Ads">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <KpiCard label="Cost" kpi={a.kpis.cost} format={cur} />
        <KpiCard label="Impressions" kpi={a.kpis.impressions} format={num} />
        <KpiCard label="Clicks" kpi={a.kpis.clicks} format={num} />
        <KpiCard label="CTR" kpi={a.kpis.ctr} format={(v) => fmtPct(v, 2)} />
        <KpiCard
          label="Avg CPC"
          kpi={a.kpis.cpc}
          format={cur}
          higherIsBetter={false}
        />
        <KpiCard label="Conversions" kpi={a.kpis.conversions} format={num} />
        <KpiCard
          label="Conv. value"
          kpi={a.kpis.conversionsValue}
          format={cur}
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Spend over time">
          <TimeSeries
            data={a.series}
            series={[{ key: "cost", label: "Spend" }]}
          />
        </ChartCard>
        <ChartCard title="Conversions over time">
          <TimeSeries
            data={a.series}
            series={[{ key: "conversions", label: "Conversions" }]}
            kind="bar"
          />
        </ChartCard>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">By campaign</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <MetricTable columns={cols} rows={a.campaigns} />
        </CardContent>
      </Card>
    </Section>
  );
}

function MetaSection({ data }: { data: DashboardData }) {
  const m = data.meta!;
  const num = (v: number) => fmtNumber(v);
  const cur = (v: number) => fmtCurrency(v, data.currency);
  const cols: Column<(typeof m.campaigns)[number]>[] = [
    { key: "name", label: "Campaign" },
    { key: "spend", label: "Spend", numeric: true, format: (v) => cur(Number(v)) },
    { key: "impressions", label: "Impr.", numeric: true, format: (v) => num(Number(v)) },
    { key: "clicks", label: "Clicks", numeric: true, format: (v) => num(Number(v)) },
    { key: "conversions", label: "Conv.", numeric: true, format: (v) => num(Number(v)) },
  ];

  return (
    <Section title="Meta Ads">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <KpiCard label="Spend" kpi={m.kpis.spend} format={cur} />
        <KpiCard label="Impressions" kpi={m.kpis.impressions} format={num} />
        <KpiCard label="Reach" kpi={m.kpis.reach} format={num} />
        <KpiCard label="Clicks" kpi={m.kpis.clicks} format={num} />
        <KpiCard label="CTR" kpi={m.kpis.ctr} format={(v) => fmtPct(v, 2)} />
        <KpiCard
          label="CPC"
          kpi={m.kpis.cpc}
          format={cur}
          higherIsBetter={false}
        />
        <KpiCard
          label="CPM"
          kpi={m.kpis.cpm}
          format={cur}
          higherIsBetter={false}
        />
        <KpiCard label="Conversions" kpi={m.kpis.conversions} format={num} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Spend over time">
          <TimeSeries
            data={m.series}
            series={[{ key: "spend", label: "Spend" }]}
          />
        </ChartCard>
        <ChartCard title="Conversions over time">
          <TimeSeries
            data={m.series}
            series={[{ key: "conversions", label: "Conversions" }]}
            kind="bar"
          />
        </ChartCard>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">By campaign</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <MetricTable columns={cols} rows={m.campaigns} />
        </CardContent>
      </Card>
    </Section>
  );
}

function GscSection({ data }: { data: DashboardData }) {
  const s = data.gsc!;
  const num = (v: number) => fmtNumber(v);
  const queryCols: Column<(typeof s.queries)[number]>[] = [
    { key: "query", label: "Query" },
    { key: "clicks", label: "Clicks", numeric: true, format: (v) => num(Number(v)) },
    { key: "impressions", label: "Impr.", numeric: true, format: (v) => num(Number(v)) },
    { key: "position", label: "Pos.", numeric: true, format: (v) => fmtPosition(Number(v)) },
  ];
  const pageCols: Column<(typeof s.pages)[number]>[] = [
    { key: "page", label: "Page" },
    { key: "clicks", label: "Clicks", numeric: true, format: (v) => num(Number(v)) },
    { key: "impressions", label: "Impr.", numeric: true, format: (v) => num(Number(v)) },
    { key: "position", label: "Pos.", numeric: true, format: (v) => fmtPosition(Number(v)) },
  ];

  return (
    <Section title="Search Console">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Clicks" kpi={s.kpis.clicks} format={num} />
        <KpiCard label="Impressions" kpi={s.kpis.impressions} format={num} />
        <KpiCard label="CTR" kpi={s.kpis.ctr} format={(v) => fmtPct(v, 2)} />
        <KpiCard
          label="Avg position"
          kpi={s.kpis.position}
          format={fmtPosition}
          higherIsBetter={false}
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Clicks & impressions">
          <TimeSeries
            data={s.series}
            series={[
              { key: "clicks", label: "Clicks" },
              { key: "impressions", label: "Impressions" },
            ]}
          />
        </ChartCard>
        <ChartCard title="Average position">
          <TimeSeries
            data={s.series}
            series={[{ key: "position", label: "Position" }]}
          />
        </ChartCard>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top queries</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <MetricTable columns={queryCols} rows={s.queries} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top pages</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <MetricTable columns={pageCols} rows={s.pages} />
          </CardContent>
        </Card>
      </div>
    </Section>
  );
}

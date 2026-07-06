// Shared dashboard data shapes (client-safe — imported by chart components).
import type { Source } from "@/lib/constants";

/** A metric value with its previous-period comparison (null = no comparison). */
export interface Kpi {
  value: number;
  prev: number | null;
}

export interface Ga4Data {
  kpis: {
    sessions: Kpi;
    totalUsers: Kpi;
    newUsers: Kpi;
    engagementRate: Kpi;
    keyEvents: Kpi;
  };
  sessionsSeries: { date: string; sessions: number }[];
  channelDonut: { channel: string; sessions: number }[];
  landingPages: { page: string; sessions: number; keyEvents: number }[];
  deviceSplit: { device: string; sessions: number }[];
}

export interface AdsData {
  kpis: {
    cost: Kpi;
    impressions: Kpi;
    clicks: Kpi;
    ctr: Kpi;
    cpc: Kpi;
    conversions: Kpi;
    conversionsValue: Kpi;
  };
  series: { date: string; cost: number; conversions: number }[];
  campaigns: {
    id: string;
    name: string;
    cost: number;
    impressions: number;
    clicks: number;
    conversions: number;
  }[];
}

export interface MetaData {
  kpis: {
    spend: Kpi;
    impressions: Kpi;
    reach: Kpi;
    clicks: Kpi;
    ctr: Kpi;
    cpc: Kpi;
    cpm: Kpi;
    conversions: Kpi;
  };
  series: { date: string; spend: number; conversions: number }[];
  campaigns: {
    id: string;
    name: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
  }[];
}

export interface GscData {
  kpis: { clicks: Kpi; impressions: Kpi; ctr: Kpi; position: Kpi };
  series: { date: string; clicks: number; impressions: number; position: number }[];
  queries: { query: string; clicks: number; impressions: number; position: number }[];
  pages: { page: string; clicks: number; impressions: number; position: number }[];
}

export interface DashboardData {
  connected: Record<Source, boolean>;
  lastSyncedAt: string | null;
  currency: string;
  range: { start: string; end: string; label: string; compare: boolean };
  overview: {
    spend: Kpi;
    sessions: Kpi;
    keyEvents: Kpi;
    conversions: Kpi;
  };
  ga4: Ga4Data | null;
  gads: AdsData | null;
  meta: MetaData | null;
  gsc: GscData | null;
}

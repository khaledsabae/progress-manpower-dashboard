// src/types/monthly.ts
export type YearMonth = string; // Must match /^\d{4}-\d{2}$/

export interface MonthlyTabMeta {
  sheetId: number;
  sheetTitle: string;         // Original tab name
  yearMonth: YearMonth;       // Canonical "YYYY-MM"
  year: number;               // 4-digit
  month: number;              // 1-12
  index: number;              // Position in Sheets list
  lastUpdated?: string;       // Optional, if available from Sheets metadata
}

export interface MechanicalPlanRow {
  SnapshotDate?: string;      // ISO date if present, else omitted
  DataSource?: string;
  AreaOrBuilding?: string;
  MechanicalActivity?: string;
  OriginalDuration?: number | null;
  CurrentProgressPct?: number | null; // 0-100
  ManpowerTotal?: number | null;
  Remarks?: string;
  // ... include other normalized columns already handled in parsing logic
}

export interface MonthlySnapshot {
  month: YearMonth;
  rows: MechanicalPlanRow[];
  summary?: {
    totalRows: number;
    avgProgressPct?: number | null;
    totalManpower?: number | null;
  };
}

export interface MonthlyIndexResponse {
  months: YearMonth[];                // Sorted desc or asc per query param
  metaByMonth: Record<YearMonth, MonthlyTabMeta>;
  latestMonth?: YearMonth;
}

export interface MonthlySnapshotsResponse {
  month: YearMonth;
  snapshot: MonthlySnapshot;
}

// src/types/index.ts

// --- Import base Task type ---
import type { Task as OriginalGanttTask } from 'gantt-task-react';

// Re-export core sheet row types for easy imports (EXCLUDING HistoricalProgressRow)
export type {
    ProgressSheetRow,
    ManpowerSheetRow,
    MaterialStatusRow,
    MechanicalPlanRow,
    // HistoricalProgressRow, // Removed from here, will be defined below
} from '../services/google-sheets'; // Adjust path as needed

// Sorting state types
export type SortDirection = 'asc' | 'desc' | null;

export type ProgressSortColumn = keyof import('../services/google-sheets').ProgressSheetRow | 'id';
export type ManpowerSortColumn = keyof import('../services/google-sheets').ManpowerSheetRow | 'totalManpower';
export type MaterialSortColumn = keyof import('../services/google-sheets').MaterialStatusRow;

export type MechanicalPlanSortColumn =
    | 'areaBuilding'
    | 'locationRoomLevel' // Added location here
    | 'mechanicalActivitySystem'
    | 'originalDurationDays'
    | 'currentProgressPercentage'
    | 'keyPredecessorActivity'
    | 'predecessorFinishTimestamp'
    | 'calculatedStartTimestamp'
    | 'calculatedFinishTimestamp'
    | 'remarksJustification'
    | 'actualStatus'
    | 'id';

export type BuildingProgressData = {
    buildingName: string;
    hvacAvg: number | null;
    ffAvg: number | null;
    faAvg: number | null;
};


export interface ProgressSortState {
    column: ProgressSortColumn | null;
    direction: SortDirection;
}
export interface ManpowerSortState {
    column: ManpowerSortColumn | null;
    direction: SortDirection;
}
export interface MaterialSortState {
    column: MaterialSortColumn | null;
    direction: SortDirection;
}
export interface MechanicalPlanSortState {
    column: MechanicalPlanSortColumn | null; // Uses the updated type
    direction: SortDirection;
}

// Shared metric types
export interface SystemAverages {
    avgHvac: number | null;
    avgFf: number | null;
    avgFa: number | null;
}

export interface SnapshotMetrics extends SystemAverages {
    totalManpower: number | null;
    overallAvgProgress: number | null;
}

export interface ComparisonResults {
    previousTimestamp: number | null;
    latestTimestamp: number | null;
    latestMetrics: SnapshotMetrics | null;
    previousMetrics: SnapshotMetrics | null;
    overallProgressChange: number | null;
    manpowerChange: number | null;
    filteredHvacProgressChange: number | null;
    filteredFfProgressChange: number | null;
    filteredFaProgressChange: number | null;
    latestOverallAvgProgress: number | null;
}

export interface TrendDataPoint {
    date: string;
    value: number | null;
}

export interface ProgressTrends {
    overall: TrendDataPoint[];
    hvac: TrendDataPoint[];
    ff: TrendDataPoint[];
    fa: TrendDataPoint[];
}

// Summary types
export interface MaterialSummary {
    totalItems: number;
    deliveredItems: number;
    partiallyDeliveredItems: number;
    pendingItems: number;
    overdueItems: number;
    rejectedItems: number;
}

// src/types/index.ts

// ... (other types) ...

export interface WorkedOnActivity {
    id: string;
    name: string | null;
    location: string | null;
    progress: number | null;
    delta: number;
    remarks: string | null;
    // --- تم التعديل هنا --- VVV
    // غيرنا discipline لـ systemCategory واستخدمنا الأنواع المطلوبة
    systemCategory: 'HVAC' | 'FF' | 'FA' | 'Other';
    // --- نهاية التعديل ---
  }
  
  export interface DailyReportData {
    reportDate: string;
    selectedFilters: { project: string; building: string; };
    historicalSnapshotDate: string;
    historicalManpower: number | null;
    previousManpower: number | null;
    historicalProgress: SnapshotMetrics | null;
    // --- تم التعديل هنا --- VVV
    // غيرنا structure الـ workedOnActivities
    workedOnActivities: {
      hvac?: WorkedOnActivity[]; // Optional in case none exist
      ff?: WorkedOnActivity[];   // Optional
      fa?: WorkedOnActivity[];   // Optional
      other?: WorkedOnActivity[]; // Optional
    } | null;
    // --- نهاية التعديل ---
  }
  
export interface SystemCount {
    name: string;
    value: number;
}

export interface ManpowerSummary {
    totalManDays: number;
    avgTotalManpower: number | null;
    peakTotalManpower: number | null;
    avgHvac: number | null;
    avgFf: number | null;
    avgFa: number | null;
    numberOfDays: number;
}

// --- EnhancedMechanicalPlanRow (Includes locationRoomLevel) ---
export interface EnhancedMechanicalPlanRow {
    // --- Fields directly from the NEW MechanicalPlanRow ---
    areaBuilding: string | null;
    locationRoomLevel: string | null; // <-- Already added in previous step, ensured here
    mechanicalActivitySystem: string | null;
    originalDurationDays: number | null;
    currentProgressPercentage: number | null; // This is the calculated one
    keyPredecessorActivity: string | null;
    predecessorFinishDateString: string | null;
    predecessorFinishTimestamp: number | null;
    calculatedStartDateString: string | null;
    calculatedStartTimestamp: number | null;
    calculatedFinishDateString: string | null;
    calculatedFinishTimestamp: number | null;
    remarksJustification: string | null;

    // --- Enhanced/Derived Properties ---
    id: string | number;
    actualStatus: 'Not Started' | 'Ongoing' | 'Completed' | 'N/A';
}

// --- Mechanical Plan Summary & Status Counts ---
export interface EnhancedMechanicalPlanSummary {
    totalActivities: number;
    completedActivities: number;
    ongoingActivities: number;
    notStartedActivities: number;
    activitiesWithNAStatus: number;
}

export interface ActualStatusCount {
    status: EnhancedMechanicalPlanRow['actualStatus'] | string;
    count: number;
}

// --- Gantt Task Data ---
export interface GanttTaskData extends OriginalGanttTask {
    // No additional custom properties needed based on current usage
}

// --- *** ADDED/MODIFIED HistoricalProgressRow Interface Locally *** ---
// Defines the structure of objects returned by getHistoricalProgressData
// Includes optional fields from BOTH Sheet1 and Mechanical Plan structures
// AND the new consolidated specificLocation field
export interface HistoricalProgressRow {
    // Core fields expected always
    snapshotDateString: string | null;
    snapshotTimestamp: number | null;
    dataSource?: string | null;       // Optional: Original source ('Sheet1' or 'Mechanical Plan')

    // *** ADDED: Consolidated location property ***
    specificLocation?: string | null; // Holds value from 'Floor/Room' OR 'Location (Room/Level)'

    // Fields primarily from "Sheet1" source (Optional)
    projects?: string | null;
    buildingName?: string | null;
    floorRoom?: string | null;        // Original 'Floor/Room' if needed elsewhere
    firefightingPercentage?: number | null;
    fireAlarmPercentage?: number | null;
    fireRemarks?: string | null;
    hvacPercentage?: number | null;
    hvacRemarks?: string | null;

    // Fields primarily from "Mechanical Plan" source (Optional)
    areaBuilding?: string | null;     // Original 'Area/Building' if needed elsewhere
    mechanicalActivitySystem?: string | null;
    originalDurationDays?: number | null;
    currentProgressPercentage?: number | null;
    keyPredecessorActivity?: string | null;
    predecessorFinishDateString?: string | null;
    predecessorFinishTimestamp?: number | null;
    calculatedStartDateString?: string | null;
    calculatedStartTimestamp?: number | null;
    calculatedFinishDateString?: string | null;
    calculatedFinishTimestamp?: number | null;
    remarksJustification?: string | null;

    // Manpower fields (potentially common - Optional)
    hvacManpower?: number | null;
    ffManpower?: number | null;
    faManpower?: number | null;
    totalManpower?: number | null;
}
// ----------------------------------------------------------
// --- Explicitly re-export types needed by other modules ---
// REMOVED the conflicting/redundant re-exports from the end.
// Exports now happen via `export interface/type` directly.
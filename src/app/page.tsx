// src/app/page.tsx
"use client";

import { ModeToggle } from "@/components/theme-toggle";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
// هنحتفظ بالـ type imports عشان باقي الـ logic اللي في الصفحة
import {
    type ManpowerSheetRow,
    type MaterialStatusRow,
    type MechanicalPlanRow,
    type HistoricalProgressRow,
    // type RiskRegisterItem, // لو هتحتاج الـ type هنا، لكن الـ hook هيجيبه
} from "../services/google-sheets"; // المسار ده ممكن يكون @/services/google-sheets لو عامل alias
import { getAiSummary } from '../services/ai-service'; // نفس الكلام للمسار
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExecutiveSummaryTab } from '@/components/executive-summary-tab';
import { ProgressTab } from "@/components/progress-tab";
import { ManpowerTab } from "@/components/manpower-tab";
import { MaterialTab } from "@/components/material-tab";
import { MechanicalPlanTab } from "@/components/mechanical-plan-tab";
// --- الإضافة الجديدة ---
import RiskManagementTab from "@/components/RiskManagementTab"; // <<<--- استيراد كومبوننت المخاطر

import { ChatbotDrawer } from '@/components/chatbot-drawer';
import { Icons } from '@/components/icons';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { DailyReportSummary } from '@/components/daily-report-summary';
import { useToast } from '@/hooks/use-toast'; // المسار ده ممكن يكون @/components/ui/use-toast لو بتستخدم shadcn hooks
import { format, startOfYear, isValid, startOfDay, subDays, parseISO } from 'date-fns';
import { DateRange } from "react-day-picker";
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import type {
    ManpowerSortState, MaterialSortState, MechanicalPlanSortState,
    ManpowerSortColumn, MaterialSortColumn, MechanicalPlanSortColumn,
    ComparisonResults, TrendDataPoint, ProgressTrends, EnhancedMechanicalPlanRow,
    EnhancedMechanicalPlanSummary, ActualStatusCount, GanttTaskData, SnapshotMetrics,
    BuildingProgressData, DailyReportData, WorkedOnActivity
} from '@/types';

// استيراد الـ hooks الجديدة
import { useManpowerData } from '@/hooks/useManpowerData';
import { useMaterialData } from '@/hooks/useMaterialData';
import { useMechanicalPlanData } from '@/hooks/useMechanicalPlanData';
import { useHistoricalData } from '@/hooks/useHistoricalData';
// لا نحتاج استيراد useRiskData هنا، لأنه سيستخدم داخل RiskManagementTab


// Helper Function for Number Parsing (يمكن نقلها لملف utils)
const parseNumberOrNull = (value: string | number | undefined | null): number | null => {
    if (value === null || value === undefined) return null;
    let numStr = String(value).trim();
    if (numStr === '' || numStr === '-' || ['n/a', 'na', 'tbd'].some(kw => numStr.toLowerCase() === kw)) return null;
    numStr = numStr.replace('%', '').replace(/,/g, '').trim();
    if (numStr === '') return null;
    const num = parseFloat(numStr);
    return !isNaN(num) && isFinite(num) ? num : null;
};
// Helper Function for Date Export (يمكن نقلها لملف utils)
const formatPlanDateForExport = (timestamp: number | null, originalString: string | null): string | number => {
    if (timestamp && isValid(new Date(timestamp))) { return format(new Date(timestamp), 'yyyy-MM-dd'); }
    if (originalString) { try { const parsedDate = parseISO(originalString); if (isValid(parsedDate)) { return format(parsedDate, 'yyyy-MM-dd'); } } catch (e) { /* Ignore */ } }
    return originalString?.trim().toLowerCase() === 'tbd' ? 'TBD' : (originalString ?? '');
};


// Main Component
export default function Home() {
    const { toast } = useToast();

    // استخدام الـ hooks لجلب البيانات
    const { manpowerData, manpowerLoading, manpowerError } = useManpowerData();
    const { materialData, materialLoading, materialError } = useMaterialData();
    const { mechanicalPlanData, mechanicalPlanLoading, mechanicalPlanError } = useMechanicalPlanData();
    const { historicalData, historicalLoading, historicalError } = useHistoricalData();
    // بيانات المخاطر سيتم جلبها داخل RiskManagementTab بواسطة useRiskData hook

    // --- Debug Log 1: البيانات الأصلية من الهوك ---
    useEffect(() => {
        if (mechanicalPlanData && mechanicalPlanData.length > 0) {
            // console.log("[Page.tsx] Raw mechanicalPlanData from hook (first 5 rows):", mechanicalPlanData.slice(0, 5));
        }
    }, [mechanicalPlanData]);

    // Local UI states remain
    const [selectedProject, setSelectedProject] = useState<string>("All Projects");
    const [selectedBuilding, setSelectedBuilding] = useState<string>("All Buildings");
    const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfYear(new Date()), to: new Date() });
    const [manpowerSortState, setManpowerSortState] = useState<ManpowerSortState>({ column: "timestamp", direction: "desc" });
    const [selectedSystem, setSelectedSystem] = useState<string>("All Systems");
    const [selectedDeliveryStatus, setSelectedDeliveryStatus] = useState<string>("All Statuses");
    const [selectedBuildingLocation, setSelectedBuildingLocation] = useState<string>("All Locations");
    const [selectedApprovalStage, setSelectedApprovalStage] = useState<string>("All Stages");
    const [materialSortState, setMaterialSortState] = useState<MaterialSortState>({ column: "plannedTimestamp", direction: "desc" });
    const [mechanicalPlanSortState, setMechanicalPlanSortState] = useState<MechanicalPlanSortState>({ column: "calculatedStartTimestamp", direction: "asc" });
    const [reportDate, setReportDate] = useState<Date | undefined>(new Date());
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [aiSummaryLoading, setAiSummaryLoading] = useState<boolean>(false);
    const [summaryLanguage, setSummaryLanguage] = useState<'en' | 'ar'>('en');

    // الـ Logic بتاع حساب البيانات التاريخية (calculateSnapshotMetrics) مع التأكد من وجود return في الآخر
    const calculateSnapshotMetrics = useCallback((timestamp: number, histData: HistoricalProgressRow[], projectFilter?: string, buildingFilter?: string): SnapshotMetrics => {
        const defaultMetrics: SnapshotMetrics = { totalManpower: null, avgHvac: null, avgFf: null, avgFa: null, overallAvgProgress: null };
        if (typeof timestamp !== 'number' || isNaN(timestamp) || !Array.isArray(histData)) {
            // console.warn('[calculateSnapshotMetrics] Invalid input timestamp or histData.', { timestamp, histData });
            return defaultMetrics;
        }
        const snapshotData = histData.filter(row => row && typeof row.snapshotTimestamp === 'number' && row.snapshotTimestamp === timestamp);
        if (snapshotData.length === 0) {
            return defaultMetrics;
        }
        const newFormatRows = snapshotData.filter(row => row && typeof row.originalDurationDays === 'number' && row.originalDurationDays > 0);
        const oldFormatRows = snapshotData.filter(row => row && !(typeof row.originalDurationDays === 'number' && row.originalDurationDays > 0) && (typeof row.hvacPercentage !== 'undefined' || typeof row.firefightingPercentage !== 'undefined' || typeof row.fireAlarmPercentage !== 'undefined'));
        const filterRow = (row: HistoricalProgressRow): boolean => {
            if (!row) return false;
            let proj: string | null = null; let bldg: string | null = null;
            const isNewFormat = typeof row.originalDurationDays === 'number' && row.originalDurationDays > 0;
            if (!isNewFormat && row.projects) { proj = row.projects?.trim() ?? null; bldg = row.buildingName?.trim() ?? null;
            } else if (isNewFormat && row.areaBuilding) { bldg = row.areaBuilding?.trim() ?? null; const match = bldg?.match(/^(PE-\d+)/i); proj = match && match[1] ? match[1].toUpperCase() : null; if (!proj && bldg) proj = bldg;
            } else { bldg = row.areaBuilding?.trim() ?? row.buildingName?.trim() ?? null; const match = bldg?.match(/^(PE-\d+)/i); proj = match && match[1] ? match[1].toUpperCase() : null; }
            const matchesProject = !projectFilter || projectFilter === "All Projects" || (proj && proj === projectFilter);
            const matchesBuilding = !buildingFilter || buildingFilter === "All Buildings" || (bldg && bldg === buildingFilter);
            return !!(matchesProject && matchesBuilding);
        };
        const filteredOldRows = oldFormatRows.filter(filterRow); const filteredNewRows = newFormatRows.filter(filterRow);
        let calculatedMetrics: SnapshotMetrics = { ...defaultMetrics };
        if (filteredNewRows.length > 0) {
            let totalWeightedProgress = 0; let totalDuration = 0; let hvacWeightedProgress = 0; let hvacDuration = 0;
            let ffWeightedProgress = 0; let ffDuration = 0; let faWeightedProgress = 0; let faDuration = 0;
            let totalManpowerSum = 0; let manpowerCount = 0;
            filteredNewRows.forEach(row => {
                const duration = row.originalDurationDays ?? 0;
                const progress = typeof row.currentProgressPercentage === 'number' && isFinite(row.currentProgressPercentage) ? Math.max(0, Math.min(100, row.currentProgressPercentage)) : 0;
                const system = String(row.mechanicalActivitySystem ?? '').toLowerCase().trim();
                const weightedProgress = duration * (progress / 100);
                totalWeightedProgress += weightedProgress; totalDuration += duration;
                if (system.includes('hvac')) { hvacWeightedProgress += weightedProgress; hvacDuration += duration; }
                else if (system.includes('firefighting') || system.includes('ff')) { ffWeightedProgress += weightedProgress; ffDuration += duration; }
                else if (system.includes('fire alarm') || system.includes('fa')) { faWeightedProgress += weightedProgress; faDuration += duration; }
                const tm = row.totalManpower; const manpowerValue = typeof tm === 'string' ? parseFloat(tm) : (typeof tm === 'number' ? tm : null);
                if (manpowerValue !== null && isFinite(manpowerValue)) { totalManpowerSum += manpowerValue; manpowerCount++; }
            });
            const calcWAvg = (wp: number, d: number): number | null => (d > 0 ? Math.round(((wp / d) * 100) * 10) / 10 : null);
            calculatedMetrics.overallAvgProgress = calcWAvg(totalWeightedProgress, totalDuration);
            calculatedMetrics.avgHvac = calcWAvg(hvacWeightedProgress, hvacDuration);
            calculatedMetrics.avgFf = calcWAvg(ffWeightedProgress, ffDuration);
            calculatedMetrics.avgFa = calcWAvg(faWeightedProgress, faDuration);
            calculatedMetrics.totalManpower = manpowerCount > 0 ? Math.round(totalManpowerSum / manpowerCount) : null;
        } else if (filteredOldRows.length > 0) {
            const HVAC_PCT_PROP = 'hvacPercentage'; const FF_PCT_PROP = 'firefightingPercentage'; const FA_PCT_PROP = 'fireAlarmPercentage'; const TOTAL_MANPOWER_PROP = 'totalManpower';
            const calcSimpleAvg = (propName: keyof HistoricalProgressRow): number | null => {
                const values = filteredOldRows.map(row => row[propName]).map(v => typeof v === 'string' ? parseFloat(v.replace('%', '')) : (typeof v === 'number' ? v : null)).filter((val): val is number => typeof val === 'number' && !isNaN(val) && isFinite(val) && val >= 0 && val <= 100);
                return values.length > 0 ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;
            };
            calculatedMetrics.avgHvac = calcSimpleAvg(HVAC_PCT_PROP as keyof HistoricalProgressRow);
            calculatedMetrics.avgFf = calcSimpleAvg(FF_PCT_PROP as keyof HistoricalProgressRow);
            calculatedMetrics.avgFa = calcSimpleAvg(FA_PCT_PROP as keyof HistoricalProgressRow);
            const validAverages = [calculatedMetrics.avgHvac, calculatedMetrics.avgFf, calculatedMetrics.avgFa].filter((avg): avg is number => avg !== null);
            calculatedMetrics.overallAvgProgress = validAverages.length > 0 ? Math.round((validAverages.reduce((sum, avg) => sum + avg, 0) / validAverages.length) * 10) / 10 : null;
            const firstValidManpower = filteredOldRows.map(row => row[TOTAL_MANPOWER_PROP]).map(tm => typeof tm === 'string' ? parseFloat(tm) : (typeof tm === 'number' ? tm : null)).find(val => val !== null && isFinite(val));
            calculatedMetrics.totalManpower = firstValidManpower !== undefined ? Math.round(firstValidManpower as number) : null;
        }
        return calculatedMetrics;
    }, []);

    // Memoized Derived Data
    const uniqueProjects = useMemo(() => {
        if (!Array.isArray(mechanicalPlanData) || mechanicalPlanData.length === 0) return ["All Projects"];
        const projectIdentifiers = new Set<string>();
        mechanicalPlanData.forEach(row => {
            const area = typeof row?.areaBuilding === 'string' ? row.areaBuilding.trim() : null;
            if (area) { const match = area.match(/^(PE-\d+)/i); if (match && match[1]) projectIdentifiers.add(match[1].toUpperCase());}
        });
        const sortedProjects = Array.from(projectIdentifiers).sort((a, b) => a.localeCompare(b));
        return ["All Projects", ...sortedProjects];
    }, [mechanicalPlanData]);

    const buildingsForFilter = useMemo(() => {
        if (!Array.isArray(mechanicalPlanData) || mechanicalPlanData.length === 0) return ["All Buildings"];
        const buildingNames = new Set<string>();
        mechanicalPlanData.forEach(row => {
            const area = typeof row?.areaBuilding === 'string' ? row.areaBuilding.trim() : null; if (!area) return;
            let matchesSelectedProject = selectedProject === "All Projects";
            if (!matchesSelectedProject) { const match = area.match(/^(PE-\d+)/i); const rowProject = match && match[1] ? match[1].toUpperCase() : null; matchesSelectedProject = rowProject === selectedProject; }
            if (matchesSelectedProject) buildingNames.add(area);
        });
        const sortedBuildings = Array.from(buildingNames).sort((a, b) => a.localeCompare(b));
        return ["All Buildings", ...sortedBuildings];
    }, [mechanicalPlanData, selectedProject]);

    useEffect(() => { setSelectedBuilding('All Buildings'); }, [selectedProject]);

    const filteredManpowerData = useMemo(() => {
        if (!Array.isArray(manpowerData)) return [];
        const { from, to } = dateRange ?? {};
        const startTimestamp = from && isValid(from) ? startOfDay(from).getTime() : null;
        const endTimestamp = to && isValid(to) ? startOfDay(to).getTime() : null;
        return manpowerData.filter(row => {
            if (!row || typeof row.timestamp !== 'number' || isNaN(row.timestamp)) return false;
            const rowTimestamp = row.timestamp;
            const afterStart = startTimestamp === null || rowTimestamp >= startTimestamp;
            const beforeEnd = endTimestamp === null || rowTimestamp <= endTimestamp;
            return afterStart && beforeEnd;
        });
    }, [manpowerData, dateRange]);

    const handleManpowerSort = useCallback((col: ManpowerSortColumn) => {
        setManpowerSortState(prev => ({ column: col, direction: prev.column === col && prev.direction === 'desc' ? 'asc' : 'desc' }));
    }, []);

    const sortedManpowerData = useMemo(() => {
        const { column, direction } = manpowerSortState;
        if (!column || !direction || !Array.isArray(filteredManpowerData)) return filteredManpowerData || [];
        const factor = direction === 'asc' ? 1 : -1;
        return [...filteredManpowerData].sort((a: ManpowerSheetRow, b: ManpowerSheetRow) => {
            if (!a) return 1 * factor; if (!b) return -1 * factor;
            const key = column as keyof ManpowerSheetRow | 'totalManpower';
            let valA: string | number | null | undefined; let valB: string | number | null | undefined;
            if (key === 'totalManpower') { const parseOrDefault = (v: any) => (typeof v === 'number' ? v : 0); valA = (a.totalManpower ?? (parseOrDefault(a.hvacManpower) + parseOrDefault(a.firefightingManpower) + parseOrDefault(a.fireAlarmManpower))); valB = (b.totalManpower ?? (parseOrDefault(b.hvacManpower) + parseOrDefault(b.firefightingManpower) + parseOrDefault(b.fireAlarmManpower)));
            } else { valA = a[key as keyof ManpowerSheetRow]; valB = b[key as keyof ManpowerSheetRow]; }
            if (valA === null || valA === undefined) return 1 * factor; if (valB === null || valB === undefined) return -1 * factor;
            if (typeof valA === 'number' && typeof valB === 'number') { if (isNaN(valA)) return 1 * factor; if (isNaN(valB)) return -1 * factor; return (valA - valB) * factor; }
            if (typeof valA === 'string' && typeof valB === 'string') { return valA.localeCompare(valB) * factor; }
            return 0;
        });
    }, [filteredManpowerData, manpowerSortState]);

    const uniqueSystems = useMemo(() => ["All Systems", ...Array.from(new Set((materialData || []).map(r => r?.system).filter((n): n is string => typeof n === 'string' && n.trim() !== ''))).sort()], [materialData]);
    const uniqueDeliveryStatuses = useMemo(() => ["All Statuses", "Delivered", "Partially Delivered", "Not Delivered", "Rejected"], []);
    const uniqueBuildingLocations = useMemo(() => ["All Locations", ...Array.from(new Set((materialData || []).map(r => r?.buildingLocation).filter((n): n is string => typeof n === 'string' && n.trim() !== ''))).sort()], [materialData]);
    const uniqueApprovalStages = useMemo(() => ["All Stages", ...Array.from(new Set((materialData || []).map(r => r?.approvalStage).filter((n): n is string => typeof n === 'string' && n.trim() !== ''))).sort()], [materialData]);

    const filteredMaterialData = useMemo(() => {
        if (!Array.isArray(materialData)) return [];
        const deliveredKeywords = ['delivered', 'on site', 'installed', 'مكتمل التسليم']; const partialKeywords = ['partial delivery', 'partially delivered', 'جزء', 'تسليم جزئي']; const rejectedKeywords = ['rejected', 'مرفوض'];
        return materialData.filter(row => {
            if (!row) return false;
            const systemMatch = selectedSystem === "All Systems" || row.system === selectedSystem;
            const locationMatch = selectedBuildingLocation === "All Locations" || row.buildingLocation === selectedBuildingLocation;
            const approvalMatch = selectedApprovalStage === "All Stages" || row.approvalStage === selectedApprovalStage;
            if (!systemMatch || !locationMatch || !approvalMatch) return false;
            if (selectedDeliveryStatus === "All Statuses") return true;
            else {
                const status = row.deliveryStatus?.trim().toLowerCase() ?? ""; const isDelivered = deliveredKeywords.some(kw => status.includes(kw)); const isPartial = partialKeywords.some(kw => status.includes(kw)); const isRejected = rejectedKeywords.some(kw => status.includes(kw));
                if (selectedDeliveryStatus === "Delivered") { return isDelivered; }
                else if (selectedDeliveryStatus === "Partially Delivered") { return isPartial; }
                else if (selectedDeliveryStatus === "Not Delivered") { return !isDelivered && !isPartial && !isRejected; }
                else if (selectedDeliveryStatus === "Rejected") { return isRejected; }
                else { return false; }
            }
        });
    }, [materialData, selectedSystem, selectedDeliveryStatus, selectedBuildingLocation, selectedApprovalStage]);

    const handleMaterialSystemFilterChange = useCallback((v: string) => setSelectedSystem(v), []);
    const handleMaterialStatusFilterChange = useCallback((v: string) => setSelectedDeliveryStatus(v), []);
    const handleMaterialLocationFilterChange = useCallback((v: string) => setSelectedBuildingLocation(v), []);
    const handleMaterialApprovalFilterChange = useCallback((v: string) => setSelectedApprovalStage(v), []);
    const handleMaterialSort = useCallback((col: MaterialSortColumn) => {
        setMaterialSortState(prev => ({ column: col, direction: prev.column === col && prev.direction === 'asc' ? 'desc' : 'asc' }));
    }, []);

    const sortedMaterialData = useMemo(() => {
        const { column, direction } = materialSortState;
        if (!column || !direction || !Array.isArray(filteredMaterialData)) return filteredMaterialData || [];
        const factor = direction === 'asc' ? 1 : -1;
        return [...filteredMaterialData].sort((a: MaterialStatusRow, b: MaterialStatusRow) => {
            if (!a) return 1 * factor; if (!b) return -1 * factor;
            const key = column as keyof MaterialStatusRow; const valA = a[key]; const valB = b[key];
            if (valA === null || valA === undefined) return 1 * factor; if (valB === null || valB === undefined) return -1 * factor;
            if (key === 'plannedTimestamp' || key === 'actualTimestamp') { const numA = typeof valA === 'number' ? valA : null; const numB = typeof valB === 'number' ? valB : null; if (numA === null) return 1 * factor; if (numB === null) return -1 * factor; if (isNaN(numA)) return 1 * factor; if (isNaN(numB)) return -1 * factor; return (numA - numB) * factor; }
            if (typeof valA === 'number' && typeof valB === 'number') { if (isNaN(valA)) return 1 * factor; if (isNaN(valB)) return -1 * factor; return (valA - valB) * factor; }
            if (typeof valA === 'string' && typeof valB === 'string') { return valA.localeCompare(valB) * factor; }
            try { return String(valA).localeCompare(String(valB)) * factor; } catch { return 0; }
        });
    }, [filteredMaterialData, materialSortState]);

    const enhancedMechanicalPlanData = useMemo((): EnhancedMechanicalPlanRow[] => {
        if (mechanicalPlanLoading || !Array.isArray(mechanicalPlanData)) { return []; }
        const today = startOfDay(new Date()).getTime();
        const enhancedData = mechanicalPlanData.map((row: MechanicalPlanRow, index): EnhancedMechanicalPlanRow | null => {
            if (!row || typeof row !== 'object') { /* console.warn("Skipping invalid row in mechanicalPlanData:", row); */ return null; }
            let derivedActualStatus: EnhancedMechanicalPlanRow['actualStatus'] = 'N/A';
            const progressValue = row.currentProgressPercentage; const progress = (typeof progressValue === 'number' && isFinite(progressValue)) ? Math.max(0, Math.min(100, progressValue)) : null;
            const startTs = typeof row.calculatedStartTimestamp === 'number' ? row.calculatedStartTimestamp : null; const finishTs = typeof row.calculatedFinishTimestamp === 'number' ? row.calculatedFinishTimestamp : null;
            if (progress === 100) { derivedActualStatus = 'Completed'; }
            else if (typeof progress === 'number' && progress > 0) { derivedActualStatus = 'Ongoing'; }
            else if (startTs !== null && startTs <= today && (progress === 0 || progress === null)) { derivedActualStatus = 'Ongoing'; }
            else if ((startTs === null || startTs > today) && (progress === 0 || progress === null)) {
                if (row.calculatedStartDateString?.trim().toLowerCase() === 'tbd' && row.calculatedFinishDateString?.trim().toLowerCase() === 'tbd') { derivedActualStatus = 'Not Started'; }
                else if (startTs === null && progress === null) { derivedActualStatus = 'N/A' } else { derivedActualStatus = 'Not Started'; }
            } else if (finishTs !== null && finishTs < today && (progress === null || progress < 100)) { derivedActualStatus = 'Ongoing'; }
            const safeString = (str: string | null | undefined) => str?.replace(/[^a-z0-9]/gi, '-') || 'na';
            const generatedId = `plan-${index}-${safeString(row.areaBuilding)}-${safeString(row.mechanicalActivitySystem)}`;
            const enhancedRow: EnhancedMechanicalPlanRow = {
                areaBuilding: row.areaBuilding ?? null, locationRoomLevel: row.locationRoomLevel ?? null, mechanicalActivitySystem: row.mechanicalActivitySystem ?? null,
                originalDurationDays: typeof row.originalDurationDays === 'number' ? row.originalDurationDays : null, currentProgressPercentage: progress, keyPredecessorActivity: row.keyPredecessorActivity ?? null,
                predecessorFinishDateString: row.predecessorFinishDateString ?? null, predecessorFinishTimestamp: typeof row.predecessorFinishTimestamp === 'number' ? row.predecessorFinishTimestamp : null,
                calculatedStartDateString: row.calculatedStartDateString ?? null, calculatedStartTimestamp: startTs, calculatedFinishDateString: row.calculatedFinishDateString ?? null, calculatedFinishTimestamp: finishTs,
                remarksJustification: row.remarksJustification ?? null, id: generatedId, actualStatus: derivedActualStatus,
            }; return enhancedRow;
        }).filter((row): row is EnhancedMechanicalPlanRow => row !== null);
        if (enhancedData.length > 0) { /* console.log("[Page.tsx] enhancedMechanicalPlanData (first 5 rows):", enhancedData.slice(0, 5)); */ }
        return enhancedData;
    }, [mechanicalPlanData, mechanicalPlanLoading]);

    const filteredMechanicalPlanData = useMemo(() => {
        if (!Array.isArray(enhancedMechanicalPlanData)) return [];
        const filteredData = enhancedMechanicalPlanData.filter(row => {
            if (!row) return false;
            const projectMatch = selectedProject === 'All Projects' || (() => { const area = row.areaBuilding; if (!area) return false; const match = area.match(/^(PE-\d+)/i); const rowProject = match && match[1] ? match[1].toUpperCase() : null; return rowProject === selectedProject; })();
            if (!projectMatch) return false;
            const buildingMatch = selectedBuilding === 'All Buildings' || row.areaBuilding === selectedBuilding;
            return buildingMatch;
        });
        if (filteredData.length > 0) { /* console.log("[Page.tsx] filteredMechanicalPlanData (first 5 rows):", filteredData.slice(0, 5)); */ }
        // else { console.log("[Page.tsx] filteredMechanicalPlanData is empty after filtering. Selected Project:", selectedProject, "Selected Building:", selectedBuilding); }
        return filteredData;
    }, [enhancedMechanicalPlanData, selectedProject, selectedBuilding]);

    const handleMechanicalPlanSort = useCallback((col: MechanicalPlanSortColumn) => {
        const validCols: Array<keyof EnhancedMechanicalPlanRow> = ['areaBuilding', 'locationRoomLevel', 'mechanicalActivitySystem', 'originalDurationDays', 'currentProgressPercentage', 'keyPredecessorActivity', 'predecessorFinishTimestamp', 'calculatedStartTimestamp', 'calculatedFinishTimestamp', 'remarksJustification', 'actualStatus', 'id'];
        if (validCols.includes(col as keyof EnhancedMechanicalPlanRow)) { setMechanicalPlanSortState(prev => ({ column: col, direction: prev.column === col && prev.direction === 'asc' ? 'desc' : 'asc' }));
        } else { /* console.warn(`Attempted to sort by invalid column: ${col}`); */ }
    }, []);

    const sortedMechanicalPlanData = useMemo((): EnhancedMechanicalPlanRow[] => {
        const { column, direction } = mechanicalPlanSortState;
        if (!column || !direction || !Array.isArray(filteredMechanicalPlanData)) return filteredMechanicalPlanData || [];
        const factor = direction === "asc" ? 1 : -1; const statusOrder: { [key in EnhancedMechanicalPlanRow['actualStatus']]: number } = { 'Ongoing': 1, 'Not Started': 2, 'Completed': 3, 'N/A': 4 };
        const validCols: Array<keyof EnhancedMechanicalPlanRow> = ['areaBuilding', 'locationRoomLevel', 'mechanicalActivitySystem', 'originalDurationDays', 'currentProgressPercentage', 'keyPredecessorActivity', 'predecessorFinishTimestamp', 'calculatedStartTimestamp', 'calculatedFinishTimestamp', 'remarksJustification', 'actualStatus', 'id'];
        if (!validCols.includes(column as keyof EnhancedMechanicalPlanRow)) { /* console.warn(`Invalid column "${column}" passed to mechanical plan sort.`); */ return filteredMechanicalPlanData; }
        const key = column as keyof EnhancedMechanicalPlanRow;
        const sortedData = [...filteredMechanicalPlanData].sort((a, b) => {
            if (!a) return 1 * factor; if (!b) return -1 * factor;
            let comparison = 0; const valA = a[key]; const valB = b[key];
            if (valA === null || valA === undefined) return 1; if (valB === null || valB === undefined) return -1;
            if (key === 'actualStatus') { comparison = (statusOrder[valA as EnhancedMechanicalPlanRow['actualStatus']] || 99) - (statusOrder[valB as EnhancedMechanicalPlanRow['actualStatus']] || 99); }
            else if (typeof valA === 'number' && typeof valB === 'number') { if (isNaN(valA)) return 1; if (isNaN(valB)) return -1; comparison = valA - valB; }
            else if (typeof valA === 'string' && typeof valB === 'string') { comparison = valA.localeCompare(valB); }
            else { try { comparison = String(valA).localeCompare(String(valB)); } catch { comparison = 0; } }
            return comparison * factor;
        });
        if (sortedData.length > 0) { /* console.log("[Page.tsx] sortedMechanicalPlanData (first 5 rows):", sortedData.slice(0, 5)); */ }
        return sortedData;
    }, [filteredMechanicalPlanData, mechanicalPlanSortState]);

    const calculateWeightedAverages = useCallback((planData: EnhancedMechanicalPlanRow[]) => {
        if (!Array.isArray(planData) || planData.length === 0) return { overallAvg: null, hvacAvg: null, ffAvg: null, faAvg: null };
        let totalWeightedProgress = 0; let totalDuration = 0; let hvacWeightedProgress = 0; let hvacDuration = 0; let ffWeightedProgress = 0; let ffDuration = 0; let faWeightedProgress = 0; let faDuration = 0;
        planData.forEach(row => {
            const duration = (typeof row?.originalDurationDays === 'number' && isFinite(row.originalDurationDays) && row.originalDurationDays > 0) ? row.originalDurationDays : 0;
            const progress = typeof row?.currentProgressPercentage === 'number' ? row.currentProgressPercentage : 0; const system = row?.mechanicalActivitySystem?.toLowerCase().trim() ?? '';
            if (duration > 0) {
                const weightedProgress = duration * (progress / 100); totalWeightedProgress += weightedProgress; totalDuration += duration;
                if (system.includes('hvac')) { hvacWeightedProgress += weightedProgress; hvacDuration += duration; }
                else if (system.includes('firefighting') || system.includes('ff')) { ffWeightedProgress += weightedProgress; ffDuration += duration; }
                else if (system.includes('fire alarm') || system.includes('fa')) { faWeightedProgress += weightedProgress; faDuration += duration; }
            }
        });
        const calculateAvg = (weightedSum: number, totalDur: number): number | null => (totalDur > 0 ? Math.round((weightedSum / totalDur) * 100) : null);
        return { overallAvg: calculateAvg(totalWeightedProgress, totalDuration), hvacAvg: calculateAvg(hvacWeightedProgress, hvacDuration), ffAvg: calculateAvg(ffWeightedProgress, ffDuration), faAvg: calculateAvg(faWeightedProgress, faDuration) };
    }, []);

    const currentProgressAverages = useMemo(() => calculateWeightedAverages(filteredMechanicalPlanData), [filteredMechanicalPlanData, calculateWeightedAverages]);

    const aggregateProgressByBuilding = useCallback((planData: EnhancedMechanicalPlanRow[]) => {
        if (!Array.isArray(planData) || planData.length === 0) { return []; }
        const progressByBuilding = new Map<string, { hvacWeightedProgress: number; hvacDuration: number; ffWeightedProgress: number; ffDuration: number; faWeightedProgress: number; faDuration: number; }>();
        planData.forEach(row => {
            const building = row?.areaBuilding; if (!building) return;
            const duration = (typeof row?.originalDurationDays === 'number' && isFinite(row.originalDurationDays) && row.originalDurationDays > 0) ? row.originalDurationDays : 0;
            const progress = typeof row?.currentProgressPercentage === 'number' ? row.currentProgressPercentage : 0; const system = row?.mechanicalActivitySystem?.toLowerCase().trim() ?? '';
            if (duration > 0) {
                const weightedProgress = duration * (progress / 100);
                if (!progressByBuilding.has(building)) { progressByBuilding.set(building, { hvacWeightedProgress: 0, hvacDuration: 0, ffWeightedProgress: 0, ffDuration: 0, faWeightedProgress: 0, faDuration: 0 }); }
                const buildingEntry = progressByBuilding.get(building)!;
                if (system.includes('hvac')) { buildingEntry.hvacWeightedProgress += weightedProgress; buildingEntry.hvacDuration += duration; }
                else if (system.includes('firefighting') || system.includes('ff')) { buildingEntry.ffWeightedProgress += weightedProgress; buildingEntry.ffDuration += duration; }
                else if (system.includes('fire alarm') || system.includes('fa')) { buildingEntry.faWeightedProgress += weightedProgress; buildingEntry.faDuration += duration; }
            }
        });
        const calculateAvg = (weightedSum: number, totalDur: number): number | null => (totalDur > 0 ? Math.round((weightedSum / totalDur) * 100) : null);
        const aggregatedData: BuildingProgressData[] = [];
        progressByBuilding.forEach((metrics, buildingName) => { aggregatedData.push({ buildingName: buildingName, hvacAvg: calculateAvg(metrics.hvacWeightedProgress, metrics.hvacDuration), ffAvg: calculateAvg(metrics.ffWeightedProgress, metrics.ffDuration), faAvg: calculateAvg(metrics.faWeightedProgress, metrics.faDuration) }); });
        aggregatedData.sort((a, b) => a.buildingName.localeCompare(b.buildingName));
        return aggregatedData;
    }, []);

    const aggregatedBuildingProgress = useMemo(() => aggregateProgressByBuilding(filteredMechanicalPlanData), [filteredMechanicalPlanData, aggregateProgressByBuilding]);

    const historicalComparisons = useMemo((): ComparisonResults => {
        const defaultResult: ComparisonResults = { previousTimestamp: null, latestTimestamp: null, latestMetrics: null, previousMetrics: null, overallProgressChange: null, manpowerChange: null, filteredHvacProgressChange: null, filteredFfProgressChange: null, filteredFaProgressChange: null, latestOverallAvgProgress: null };
        if (historicalLoading || !Array.isArray(historicalData) || historicalData.length === 0) return defaultResult;
        const uniqueTimestamps = Array.from(new Set(historicalData.map(r => r?.snapshotTimestamp))).filter((ts): ts is number => typeof ts === 'number' && !isNaN(ts) && isFinite(ts)).sort((a, b) => b - a);
        if (uniqueTimestamps.length < 1) return defaultResult;
        const latestTimestamp = uniqueTimestamps[0]; const previousTimestamp = uniqueTimestamps.find(ts => ts < latestTimestamp) ?? null;
        const latestMetricsFiltered = calculateSnapshotMetrics(latestTimestamp, historicalData, selectedProject, selectedBuilding); const latestMetricsOverall = calculateSnapshotMetrics(latestTimestamp, historicalData);
        let previousMetricsFiltered: SnapshotMetrics | null = null; let overallProgressChange: number | null = null, manpowerChange: number | null = null; let filteredHvacChange: number | null = null, filteredFfChange: number | null = null, filteredFaChange: number | null = null;
        if (previousTimestamp !== null) {
            previousMetricsFiltered = calculateSnapshotMetrics(previousTimestamp, historicalData, selectedProject, selectedBuilding);
            const calculateChange = (latestVal: number | null, prevVal: number | null): number | null => ((latestVal !== null && prevVal !== null) ? Math.round((latestVal - prevVal) * 10) / 10 : null);
            overallProgressChange = calculateChange(latestMetricsFiltered.overallAvgProgress, previousMetricsFiltered?.overallAvgProgress); manpowerChange = calculateChange(latestMetricsFiltered.totalManpower, previousMetricsFiltered?.totalManpower);
            filteredHvacChange = calculateChange(latestMetricsFiltered.avgHvac, previousMetricsFiltered?.avgHvac); filteredFfChange = calculateChange(latestMetricsFiltered.avgFf, previousMetricsFiltered?.avgFf); filteredFaChange = calculateChange(latestMetricsFiltered.avgFa, previousMetricsFiltered?.avgFa);
        }
        return { previousTimestamp, latestTimestamp, latestMetrics: latestMetricsFiltered, previousMetrics: previousMetricsFiltered, overallProgressChange, manpowerChange, filteredHvacProgressChange: filteredHvacChange, filteredFfProgressChange: filteredFfChange, filteredFaProgressChange: filteredFaChange, latestOverallAvgProgress: latestMetricsOverall.overallAvgProgress };
    }, [historicalData, historicalLoading, selectedProject, selectedBuilding, calculateSnapshotMetrics]);

    const weeklyVelocity = useMemo((): number | null => {
        if (historicalLoading || !Array.isArray(historicalData) || historicalData.length < 2) { return null; }
        const uniqueTimestamps = Array.from(new Set(historicalData.map(r => r?.snapshotTimestamp))).filter((ts): ts is number => ts !== null && !isNaN(ts) && isFinite(ts)).sort((a, b) => a - b);
        if (uniqueTimestamps.length < 2) { return null; }
        const today = startOfDay(new Date()).getTime(); const sevenDaysAgo = startOfDay(subDays(new Date(), 7)).getTime();
        const latestValidTimestamp = uniqueTimestamps.filter(ts => ts <= today).pop(); const pastValidTimestamp = uniqueTimestamps.filter(ts => ts <= sevenDaysAgo).pop();
        if (!latestValidTimestamp || !pastValidTimestamp || latestValidTimestamp <= pastValidTimestamp) return null;
        const latestOverallMetrics = calculateSnapshotMetrics(latestValidTimestamp, historicalData); const pastOverallMetrics = calculateSnapshotMetrics(pastValidTimestamp, historicalData);
        const latestProg = latestOverallMetrics.overallAvgProgress; const pastProg = pastOverallMetrics.overallAvgProgress;
        if (latestProg === null || pastProg === null) return null;
        const daysDiff = Math.round((latestValidTimestamp - pastValidTimestamp) / (1000 * 60 * 60 * 24));
        if (daysDiff <= 0) return null;
        const changePerDay = (latestProg - pastProg) / daysDiff;
        return Math.round((changePerDay * 7) * 10) / 10;
    }, [historicalData, historicalLoading, calculateSnapshotMetrics]);

    const progressTrends = useMemo((): ProgressTrends | null => {
        if (historicalLoading || !Array.isArray(historicalData) || historicalData.length === 0) return null;
        const uniqueTimestamps = Array.from(new Set(historicalData.map(r => r?.snapshotTimestamp))).filter((ts): ts is number => ts !== null && !isNaN(ts) && isFinite(ts)).sort((a, b) => a - b);
        if (uniqueTimestamps.length === 0) return null;
        const trends: ProgressTrends = { overall: [], hvac: [], ff: [], fa: [] };
        uniqueTimestamps.forEach(ts => {
            const dateStr = format(new Date(ts), 'MMM dd'); const metrics = calculateSnapshotMetrics(ts, historicalData, selectedProject, selectedBuilding);
            if (metrics.overallAvgProgress !== null) trends.overall.push({ date: dateStr, value: metrics.overallAvgProgress });
            if (metrics.avgHvac !== null) trends.hvac.push({ date: dateStr, value: metrics.avgHvac });
            if (metrics.avgFf !== null) trends.ff.push({ date: dateStr, value: metrics.avgFf });
            if (metrics.avgFa !== null) trends.fa.push({ date: dateStr, value: metrics.avgFa });
        });
        const limit = 30; trends.overall = trends.overall.slice(-limit); trends.hvac = trends.hvac.slice(-limit); trends.ff = trends.ff.slice(-limit); trends.fa = trends.fa.slice(-limit);
        return trends;
    }, [historicalData, historicalLoading, selectedProject, selectedBuilding, calculateSnapshotMetrics]);

    const mechanicalPlanSummaryData = useMemo((): EnhancedMechanicalPlanSummary => {
        if (mechanicalPlanLoading || !Array.isArray(enhancedMechanicalPlanData) || enhancedMechanicalPlanData.length === 0) return { totalActivities: 0, completedActivities: 0, ongoingActivities: 0, notStartedActivities: 0, activitiesWithNAStatus: 0 };
        const counts = enhancedMechanicalPlanData.reduce((acc, row) => {
            if (!row) return acc; const status = row.actualStatus;
            if (status === 'Completed') acc.completed++; else if (status === 'Ongoing') acc.ongoing++; else if (status === 'Not Started') acc.notStarted++; else acc.naStatus++; return acc;
        }, { completed: 0, ongoing: 0, notStarted: 0, naStatus: 0 });
        return { totalActivities: enhancedMechanicalPlanData.length, completedActivities: counts.completed, ongoingActivities: counts.ongoing, notStartedActivities: counts.notStarted, activitiesWithNAStatus: counts.naStatus };
    }, [enhancedMechanicalPlanData, mechanicalPlanLoading]);

    const actualMechanicalPlanStatusCounts = useMemo((): ActualStatusCount[] => {
        if (mechanicalPlanLoading || !Array.isArray(enhancedMechanicalPlanData) || enhancedMechanicalPlanData.length === 0) return [];
        const counts: { [key: string]: number } = {};
        enhancedMechanicalPlanData.forEach(row => { if (!row) return; const displayStatus = row.actualStatus; if (displayStatus) { counts[displayStatus] = (counts[displayStatus] || 0) + 1; } });
        const order: { [key in EnhancedMechanicalPlanRow['actualStatus']]: number } = { 'Ongoing': 1, 'Not Started': 2, 'Completed': 3, 'N/A': 4 };
        return Object.entries(counts).map(([status, count]) => ({ status, count })).sort((a, b) => (order[a.status as keyof typeof order] || 99) - (order[b.status as keyof typeof order] || 99));
    }, [enhancedMechanicalPlanData, mechanicalPlanLoading]);

    const ganttTasks = useMemo(() => {
        if (mechanicalPlanLoading || !Array.isArray(filteredMechanicalPlanData)) { return []; }
        return filteredMechanicalPlanData.filter(row => row?.calculatedStartTimestamp && row.calculatedFinishTimestamp && row.calculatedStartTimestamp < row.calculatedFinishTimestamp).map((row): GanttTaskData | null => {
            if (!row) return null; const startDate = new Date(row.calculatedStartTimestamp!); const endDate = new Date(row.calculatedFinishTimestamp!);
            if (!isValid(startDate) || !isValid(endDate)) { return null; }
            const taskId = row.id as string; let styles = {};
            switch (row.actualStatus) {
                case 'Completed': styles = { progressColor: '#22c55e', progressSelectedColor: '#16a34a', barColor: '#22c55e' }; break;
                case 'Ongoing': styles = { progressColor: '#eab308', progressSelectedColor: '#ca8a04', barColor: '#eab308' }; break;
                case 'Not Started': styles = { progressColor: '#a1a1aa', progressSelectedColor: '#71717a', barColor: '#a1a1aa' }; break;
                default: styles = { progressColor: '#d4d4d8', progressSelectedColor: '#a1a1aa', barColor: '#d4d4d8' };
            }
            const progressValue = typeof row.currentProgressPercentage === 'number' ? row.currentProgressPercentage : 0;
            const taskObject: GanttTaskData = { id: taskId, name: `${row.areaBuilding || 'Unknown Bldg'} - ${row.mechanicalActivitySystem || 'Unnamed Activity'}`, start: startDate, end: endDate, progress: progressValue, type: 'task', isDisabled: false, styles: styles, }; return taskObject;
        }).filter((task): task is GanttTaskData => task !== null);
    }, [filteredMechanicalPlanData, mechanicalPlanLoading]);

    const todayTimestamp = useMemo(() => startOfDay(new Date()).getTime(), []);

    const delayedActivitiesCount = useMemo((): number | null => {
        if (mechanicalPlanLoading || !Array.isArray(filteredMechanicalPlanData)) return null;
        return filteredMechanicalPlanData.filter(row => { if (!row) return false; const isCompleted = row.actualStatus === 'Completed'; const finishTs = row.calculatedFinishTimestamp; return !isCompleted && typeof finishTs === 'number' && finishTs < todayTimestamp; }).length;
    }, [filteredMechanicalPlanData, mechanicalPlanLoading, todayTimestamp]);

    const materialRiskCountValue = useMemo(() => {
        if (!Array.isArray(materialData)) return 0;
        const today = startOfDay(new Date()).getTime(); const deliveredKeywords = ['delivered', 'on site', 'installed', 'مكتمل التسليم'];
        return materialData.filter(row => {
            if (!row) return false;
            const status = row.deliveryStatus?.trim().toLowerCase() ?? ""; const isDelivered = deliveredKeywords.some(kw => status.includes(kw));
            const isPending = !isDelivered; const plannedTs = row.plannedTimestamp; const isPastPlanned = typeof plannedTs === 'number' && plannedTs < today;
            return isPending && isPastPlanned;
        }).length;
    }, [materialData]);

    const overallLoading = useMemo(() => { return manpowerLoading || materialLoading || mechanicalPlanLoading || historicalLoading; }, [manpowerLoading, materialLoading, mechanicalPlanLoading, historicalLoading]);

    const dailyReportData = useMemo((): DailyReportData | null => {
        if (overallLoading || !reportDate || !isValid(reportDate) || !Array.isArray(historicalData) || historicalData.length === 0) { return null; }
        const targetDate = startOfDay(reportDate); const targetTimestamp = targetDate.getTime(); const targetDayDataRows = historicalData.filter(row => row?.snapshotTimestamp === targetTimestamp);
        const defaultReturn: DailyReportData = { reportDate: format(targetDate, 'yyyy-MM-dd'), selectedFilters: { project: selectedProject, building: selectedBuilding }, historicalSnapshotDate: 'N/A', historicalManpower: null, previousManpower: null, historicalProgress: { overallAvgProgress: null, avgHvac: null, avgFf: null, avgFa: null, totalManpower: null }, workedOnActivities: null };
        if (targetDayDataRows.length === 0) { return defaultReturn; }
        const historicalMetrics = calculateSnapshotMetrics(targetTimestamp, targetDayDataRows, selectedProject, selectedBuilding);
        const targetManpowerRow = targetDayDataRows.find(r => typeof r?.totalManpower === 'number' || typeof r?.totalManpower === 'string'); const currentManpower = parseNumberOrNull(targetManpowerRow?.totalManpower);
        const previousTimestamps = Array.from(new Set(historicalData.map(r => r?.snapshotTimestamp))).filter((ts): ts is number => ts !== null && !isNaN(ts) && ts < targetTimestamp).sort((a, b) => b - a);
        const previousDataTimestamp = previousTimestamps.length > 0 ? previousTimestamps[0] : null; let workedOnActivitiesResult: DailyReportData['workedOnActivities'] = null; let previousDayManpower: number | null = null;
        if (previousDataTimestamp) {
            const previousDayDataRows = historicalData.filter(row => row?.snapshotTimestamp === previousDataTimestamp);
            if (previousDayDataRows.length > 0) {
                const previousManpowerRow = previousDayDataRows.find(r => typeof r?.totalManpower === 'number' || typeof r?.totalManpower === 'string'); previousDayManpower = parseNumberOrNull(previousManpowerRow?.totalManpower);
                const getActivityKey = (row: HistoricalProgressRow): string | null => {
                    let proj: string | null = null; let buildingArea: string | null = null; let location: string | null = null; let activitySystem: string | null = null;
                    const buildingAreaRaw = row.areaBuilding ?? row.buildingName; buildingArea = typeof buildingAreaRaw === 'string' && buildingAreaRaw.trim() !== '' ? buildingAreaRaw.trim() : null; if (!buildingArea) return null;
                    const buildingMatch = buildingArea.match(/^(PE-\d+)/i); proj = buildingMatch && buildingMatch[1] ? buildingMatch[1].toUpperCase() : null; if (!proj) { proj = (row.projects ?? 'unknown_proj').trim(); }
                    const specificLocationRaw = row.specificLocation; location = typeof specificLocationRaw === 'string' && specificLocationRaw.trim() !== '' ? specificLocationRaw.trim() : 'overall'; activitySystem = row.mechanicalActivitySystem?.trim() || null;
                    if (!activitySystem) { if (row.hvacPercentage !== undefined && row.hvacPercentage !== null) { activitySystem = 'HVAC System Progress'; } else if (row.firefightingPercentage !== undefined && row.firefightingPercentage !== null) { activitySystem = 'Firefighting System Progress'; } else if (row.fireAlarmPercentage !== undefined && row.fireAlarmPercentage !== null) { activitySystem = 'Fire Alarm System Progress'; } else { activitySystem = 'Building Level Status'; } }
                    if (!activitySystem) return null; return `${proj}|${buildingArea}|${location}|${activitySystem}`.toLowerCase();
                };
                const parsePercentage = (value: string | number | null | undefined): number | null => { if (typeof value === 'number') { return isFinite(value) ? Math.max(0, Math.min(100, value)) : null; } if (typeof value === 'string') { try { const num = parseFloat(value.replace('%', '').trim()); return isFinite(num) ? Math.max(0, Math.min(100, num)) : null; } catch { return null; } } return null; };
                const previousProgressMap = new Map<string, number | null>(); previousDayDataRows.forEach(row => { const key = getActivityKey(row); if (key) { const progressVal = parsePercentage(row.currentProgressPercentage ?? row.hvacPercentage ?? row.firefightingPercentage ?? row.fireAlarmPercentage); previousProgressMap.set(key, progressVal); } });
                const currentProgressMap = new Map<string, { rowData: HistoricalProgressRow, progress: number | null }>(); targetDayDataRows.forEach(row => { const key = getActivityKey(row); if (key) { const progressVal = parsePercentage(row.currentProgressPercentage ?? row.hvacPercentage ?? row.firefightingPercentage ?? row.fireAlarmPercentage); currentProgressMap.set(key, { rowData: row, progress: progressVal }); } });
                const progressedActivitiesRaw: WorkedOnActivity[] = [];
                currentProgressMap.forEach((currentData, key) => {
                    const currentMainProgress = currentData.progress; const prevMainProgress = previousProgressMap.get(key); const delta = (currentMainProgress ?? 0) - (prevMainProgress ?? 0);
                    if (currentMainProgress !== null && delta > 0) {
                        const row = currentData.rowData; let displayName = row.mechanicalActivitySystem?.trim() || null; const buildingNameForCheck = row.areaBuilding ?? row.buildingName; if (!displayName) { displayName = buildingNameForCheck ?? 'Unknown Activity'; }
                        let systemNameForCategory = (row.mechanicalActivitySystem || (row.hvacPercentage !== undefined ? 'hvac' : (row.firefightingPercentage !== undefined ? 'firefighting' : (row.fireAlarmPercentage !== undefined ? 'fire alarm' : 'other')))).trim().toLowerCase();
                        let location: string | null = null; const floorRoomStr = row.floorRoom?.trim() || row.specificLocation?.trim(); if (floorRoomStr || displayName !== buildingNameForCheck) { location = buildingNameForCheck ?? 'Unknown Building'; if (floorRoomStr) { location += ` - ${floorRoomStr}`; } }
                        const remarks = [row.remarksJustification, row.hvacRemarks, row.fireRemarks].filter(Boolean).join('; ').trim() || null; let category: WorkedOnActivity['systemCategory'] = 'Other';
                        if (systemNameForCategory.includes('hvac')) { category = 'HVAC'; } else if (systemNameForCategory.includes('firefighting') || systemNameForCategory.includes('ff') || systemNameForCategory.includes('fm-200') || systemNameForCategory.includes('fm200')) { category = 'FF'; } else if (systemNameForCategory.includes('fire alarm') || systemNameForCategory.includes('fa')) { category = 'FA'; }
                        progressedActivitiesRaw.push({ id: key + '-' + targetTimestamp, name: displayName, location: location, progress: currentMainProgress, delta: delta, remarks: remarks, systemCategory: category });
                    }
                });
                const hvacActivities = progressedActivitiesRaw.filter(a => a.systemCategory === 'HVAC'); const ffActivities = progressedActivitiesRaw.filter(a => a.systemCategory === 'FF'); const faActivities = progressedActivitiesRaw.filter(a => a.systemCategory === 'FA'); const otherActivities = progressedActivitiesRaw.filter(a => a.systemCategory === 'Other');
                if (hvacActivities.length > 0 || ffActivities.length > 0 || faActivities.length > 0 || otherActivities.length > 0) { workedOnActivitiesResult = { hvac: hvacActivities.length > 0 ? hvacActivities : undefined, ff: ffActivities.length > 0 ? ffActivities : undefined, fa: faActivities.length > 0 ? faActivities : undefined, other: otherActivities.length > 0 ? otherActivities : undefined, }; }
            }
        }
        return { reportDate: format(targetDate, 'yyyy-MM-dd'), selectedFilters: { project: selectedProject, building: selectedBuilding }, historicalSnapshotDate: targetTimestamp ? format(new Date(targetTimestamp), 'yyyy-MM-dd') : 'N/A', historicalManpower: currentManpower, previousManpower: previousDayManpower, historicalProgress: historicalMetrics, workedOnActivities: workedOnActivitiesResult };
    }, [reportDate, selectedProject, selectedBuilding, historicalData, overallLoading, calculateSnapshotMetrics]);

    useEffect(() => {
        const generateSummary = async () => {
            // console.log("AI useEffect triggered. dailyReportData:", dailyReportData);
            const activitiesExist = dailyReportData && dailyReportData.workedOnActivities && ((dailyReportData.workedOnActivities.hvac?.length ?? 0) > 0 || (dailyReportData.workedOnActivities.ff?.length ?? 0) > 0 || (dailyReportData.workedOnActivities.fa?.length ?? 0) > 0 || (dailyReportData.workedOnActivities.other?.length ?? 0) > 0);
            // console.log("AI useEffect: activitiesExist =", activitiesExist);
            if (activitiesExist && dailyReportData) {
                setAiSummaryLoading(true); setAiSummary(null);
                const totalWorkedOn = (dailyReportData.workedOnActivities?.hvac?.length ?? 0) + (dailyReportData.workedOnActivities?.ff?.length ?? 0) + (dailyReportData.workedOnActivities?.fa?.length ?? 0) + (dailyReportData.workedOnActivities?.other?.length ?? 0);
                const inputData = { reportDate: dailyReportData.reportDate, historicalManpower: dailyReportData.previousManpower, workedOnActivities: dailyReportData.workedOnActivities, totalWorkedOn: totalWorkedOn, overallProgressChange: historicalComparisons?.overallProgressChange, delayedActivitiesCount: delayedActivitiesCount, language: summaryLanguage };
                // console.log("AI useEffect: Calling getAiSummary with inputData:", inputData);
                try {
                    const summaryText = await getAiSummary(inputData);
                    // console.log("AI useEffect: Received summaryText:", summaryText);
                    setAiSummary(summaryText || `(${summaryLanguage === 'ar' ? 'لم يتم إنشاء ملخص' : 'Summary generation returned empty'})`);
                } catch (error) {
                    // console.error("AI useEffect: Error calling getAiSummary:", error);
                    const errorMsg = error instanceof Error ? error.message : "An unknown error occurred."; setAiSummary(`Error generating AI summary: ${errorMsg}`);
                } finally {
                    // console.log("AI useEffect: Setting loading to false.");
                    setAiSummaryLoading(false);
                }
            } else {
                // console.log("AI useEffect: No activities found or data missing, clearing summary.");
                setAiSummary(null); setAiSummaryLoading(false);
            }
        };
        const timer = setTimeout(() => { generateSummary(); }, 100);
        return () => clearTimeout(timer);
    }, [dailyReportData, historicalComparisons, delayedActivitiesCount, summaryLanguage]);

    const exportToExcel = useCallback((dataToExport: any[], fileName: string, tableId: string) => {
        try {
            let finalData: any[] = []; let exportFileName = fileName; let sourceData: any[] = [];
            if (tableId === 'progress-table') { sourceData = sortedMechanicalPlanData; exportFileName = 'Progress_Tab_Plan_Data'; }
            else if (tableId === 'mechanical-plan-table') { sourceData = sortedMechanicalPlanData; exportFileName = 'Mechanical_Plan_Integrated_Data'; }
            else if (tableId === 'manpower-table') { sourceData = sortedManpowerData; exportFileName = 'Manpower_Data'; }
            else if (tableId === 'material-table') { sourceData = sortedMaterialData; exportFileName = 'Material_Status_Data'; }
            else { /* console.warn("Unknown tableId for export, using provided dataToExport:", tableId); */ sourceData = Array.isArray(dataToExport) ? dataToExport : []; exportFileName = `Export_${tableId || 'Unknown'}`; }
            if (!Array.isArray(sourceData) || sourceData.length === 0) { toast({ variant: "default", title: "Export Empty", description: `No data available to export for ${exportFileName}.` }); return; }
            if (tableId === 'progress-table' || tableId === 'mechanical-plan-table') {
                finalData = (sourceData as EnhancedMechanicalPlanRow[]).map((row) => ({ 'Area/Building': row?.areaBuilding ?? '', 'Location (Room/Level)': row?.locationRoomLevel ?? '', 'Mechanical Activity (System)': row?.mechanicalActivitySystem ?? '', 'Original Duration (Days)': row?.originalDurationDays ?? '', 'Current Progress %': typeof row?.currentProgressPercentage === 'number' ? row.currentProgressPercentage : '', 'Key Predecessor Activity': row?.keyPredecessorActivity ?? '', 'Predecessor Finish Date': formatPlanDateForExport(row?.predecessorFinishTimestamp ?? null, row?.predecessorFinishDateString ?? null), 'Calculated Mech. Start Date': formatPlanDateForExport(row?.calculatedStartTimestamp ?? null, row?.calculatedStartDateString ?? null), 'Calculated Mech. Finish Date': formatPlanDateForExport(row?.calculatedFinishTimestamp ?? null, row?.calculatedFinishDateString ?? null), 'Actual Status': row?.actualStatus ?? 'N/A', 'Remarks / Justification': row?.remarksJustification ?? '', }));
            } else if (tableId === 'manpower-table') {
                finalData = (sourceData as ManpowerSheetRow[]).map((row) => { const hvac = row?.hvacManpower ?? 0; const ff = row?.firefightingManpower ?? 0; const fa = row?.fireAlarmManpower ?? 0; return { 'Date': row?.timestamp ? format(new Date(row.timestamp), 'yyyy-MM-dd') : '', 'HVAC': hvac, 'Firefighting': ff, 'Fire Alarm': fa, 'Total': row?.totalManpower ?? (hvac + ff + fa), }; });
            } else if (tableId === 'material-table') {
                finalData = (sourceData as MaterialStatusRow[]).map((row) => ({ 'System': row?.system ?? '', 'Item Description': row?.itemDescription ?? '', 'Location': row?.buildingLocation ?? '', 'Approval': row?.approvalStage ?? '', 'Delivery Status': row?.deliveryStatus ?? '', 'Quantity': row?.quantity ?? '', 'Planned Date': formatPlanDateForExport(row?.plannedTimestamp ?? null, row?.plannedDeliveryDateString ?? null), 'Actual Date': formatPlanDateForExport(row?.actualTimestamp ?? null, row?.actualDeliveryDateString ?? null), 'Remarks': row?.remarks ?? '', 'Document Link': row?.documentLink ?? '', }));
            } else { finalData = sourceData; }
            const worksheet = XLSX.utils.json_to_sheet(finalData); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1"); const fullFileName = `${exportFileName}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`; XLSX.writeFile(workbook, fullFileName); toast({ title: "Export Successful", description: `${fullFileName} downloaded.` });
        } catch (error) { console.error("Export Error:", error); toast({ variant: "destructive", title: "Export Failed", description: `Could not export data to Excel. ${error instanceof Error ? error.message : String(error)}` }); }
    }, [toast, sortedMechanicalPlanData, sortedManpowerData, sortedMaterialData]);

    // Render JSX
    return (
        <div className="container mx-auto px-4 py-6 sm:px-6 lg:px-8 min-h-screen flex flex-col">
            <header className="text-center mb-6 relative">
                <h1 className="text-2xl sm:text-3xl font-semibold text-primary">Mechanical Systems - Project Dashboard</h1>
                <p className="text-center text-muted-foreground mt-1">Mowaih PV 380/110 kV BSP</p>
                <div className="absolute top-0 right-0 mt-1 mr-1"> <ModeToggle /> </div>
            </header>

            <div className="flex-grow mt-4">
                {/* --- تعديل الـ TabsList لـ grid-cols-6 --- */}
                <Tabs defaultValue="executiveSummary" className="w-full h-full flex flex-col">
                    <div className="flex justify-center mb-4">
                        <TabsList className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 w-full max-w-5xl bg-muted p-1 rounded-lg h-auto"> {/* <-- تم تعديل md:grid-cols-5 إلى md:grid-cols-6 وزيادة max-w-4xl إلى max-w-5xl */}
                            <TabsTrigger value="executiveSummary" className={cn()}> Executive Summary </TabsTrigger>
                            <TabsTrigger value="progress" className={cn()}> Progress </TabsTrigger>
                            <TabsTrigger value="manpower" className={cn()}> Manpower </TabsTrigger>
                            <TabsTrigger value="material" className={cn()}> Material Status </TabsTrigger>
                            <TabsTrigger value="mechanicalPlan" className={cn()}> Mechanical Plan </TabsTrigger>
                            {/* --- الإضافة الجديدة --- */}
                            <TabsTrigger value="riskManagement" className={cn()}> Risk Management </TabsTrigger> {/* <<<--- التاب الجديد */}
                        </TabsList>
                    </div>

                    <TabsContent value="executiveSummary" className="flex-grow mt-0 outline-none ring-0 focus:outline-none focus:ring-0">
                        <ExecutiveSummaryTab loading={overallLoading} historicalComparisons={historicalComparisons} weeklyVelocity={weeklyVelocity} delayedActivitiesCount={delayedActivitiesCount} materialRiskCount={materialRiskCountValue} progressTrends={progressTrends} />
                        <div className='mt-6 w-full'>
                            <div className="flex flex-wrap justify-center items-center gap-4 mb-4 px-2">
                                <p className="text-sm font-medium text-muted-foreground whitespace-nowrap">Select Report Date:</p>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant={"outline"} className={cn("w-[240px] justify-start text-left font-normal", !reportDate && "text-muted-foreground")} > <CalendarIcon className="mr-2 h-4 w-4" /> {reportDate ? format(reportDate, "PPP") : <span>Pick a date</span>} </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start"> <Calendar mode="single" selected={reportDate} onSelect={setReportDate} initialFocus /> </PopoverContent>
                                </Popover>
                            </div>
                            <DailyReportSummary data={dailyReportData} loading={overallLoading && !dailyReportData} aiSummary={aiSummary} aiSummaryLoading={aiSummaryLoading} summaryLanguage={summaryLanguage} onLanguageToggle={() => setSummaryLanguage(prev => prev === 'en' ? 'ar' : 'en')} />
                        </div>
                    </TabsContent>

                    <TabsContent value="progress" className="flex-grow mt-0 outline-none ring-0 focus:outline-none focus:ring-0">
                        <ProgressTab loading={mechanicalPlanLoading || historicalLoading} error={mechanicalPlanError || historicalError} filters={{ projectFilter: selectedProject, buildingFilter: selectedBuilding, projects: uniqueProjects, buildings: buildingsForFilter }} onProjectFilterChange={setSelectedProject} onBuildingFilterChange={setSelectedBuilding} currentAverages={currentProgressAverages} historicalComparisons={historicalComparisons} progressTrends={progressTrends} aggregatedBuildingProgress={aggregatedBuildingProgress} />
                    </TabsContent>

                    <TabsContent value="manpower" className="flex-grow mt-0 outline-none ring-0 focus:outline-none focus:ring-0">
                        <ManpowerTab data={sortedManpowerData} loading={manpowerLoading} error={manpowerError} dateRange={dateRange} setDateRange={setDateRange} sortState={manpowerSortState} onSort={handleManpowerSort} onExport={exportToExcel} />
                    </TabsContent>

                    <TabsContent value="material" className="flex-grow mt-0 outline-none ring-0 focus:outline-none focus:ring-0">
                        <MaterialTab data={sortedMaterialData} loading={materialLoading} error={materialError} filters={{ systemFilter: selectedSystem, statusFilter: selectedDeliveryStatus, locationFilter: selectedBuildingLocation, approvalFilter: selectedApprovalStage, systems: uniqueSystems, statuses: uniqueDeliveryStatuses, locations: uniqueBuildingLocations, approvals: uniqueApprovalStages }} sortState={materialSortState} onSystemFilterChange={handleMaterialSystemFilterChange} onStatusFilterChange={handleMaterialStatusFilterChange} onLocationFilterChange={handleMaterialLocationFilterChange} onApprovalFilterChange={handleMaterialApprovalFilterChange} onSort={handleMaterialSort} onExport={exportToExcel} />
                    </TabsContent>

                    <TabsContent value="mechanicalPlan" className="flex-grow mt-0 outline-none ring-0 focus:outline-none focus:ring-0">
                        {(mechanicalPlanLoading && enhancedMechanicalPlanData.length === 0) || (mechanicalPlanError && enhancedMechanicalPlanData.length === 0) ? (
                            <div className="flex justify-center items-center h-64">
                                {mechanicalPlanLoading ? <Icons.spinner className="h-8 w-8 animate-spin text-primary" /> : <p className="text-destructive">Error loading plan data.</p>}
                            </div>
                        ) : (
                            <MechanicalPlanTab data={sortedMechanicalPlanData} loading={mechanicalPlanLoading} error={mechanicalPlanError} sortState={mechanicalPlanSortState} summaryData={mechanicalPlanSummaryData} statusCounts={actualMechanicalPlanStatusCounts} onSort={handleMechanicalPlanSort} onExport={exportToExcel} todayTimestamp={todayTimestamp} />
                        )}
                    </TabsContent>

                    {/* --- الإضافة الجديدة --- */}
                    <TabsContent value="riskManagement" className="flex-grow mt-0 outline-none ring-0 focus:outline-none focus:ring-0"> {/* <<<--- محتوى التاب الجديد */}
                        <RiskManagementTab />
                    </TabsContent>

                </Tabs>
            </div>

            <footer className="text-center mt-8 text-muted-foreground text-sm flex-shrink-0">
                <div>Developed by: Khaled Hamdy Sabae</div>
                <div>Senior Mechanical Projects Engineer - Alfanar</div>
                <div><a href="http://www.khaledsabae.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.khaledsabae.com</a></div>
            </footer>

            <ChatbotDrawer />
        </div>
    );
}
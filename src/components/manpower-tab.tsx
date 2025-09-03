"use client";

// --- ADDED: Ensure React and Dispatch/SetStateAction are imported ---
import React, { useMemo, Dispatch, SetStateAction } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
// Make sure type path is correct, or import from @/types
import type { ManpowerSheetRow } from '@/services/google-sheets'; // OR from '@/types' if defined there
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";
import { format, isValid } from 'date-fns';
// --- ADDED: Import DateRange type ---
import { DateRange } from 'react-day-picker';
import type { ManpowerSortState, ManpowerSortColumn } from '@/types';

// Import the new ChartJS component
import { ManpowerChartJS } from '@/components/ManpowerChartJS'; // <-- Ensure path is correct

// --- Types ---
interface ManpowerSummary {
    totalManDays: number;
    avgTotalManpower: number | null;
    peakTotalManpower: number | null;
    avgHvac: number | null;
    avgFf: number | null;
    avgFa: number | null;
    numberOfDays: number;
}

// Define props interface for the component
interface ManpowerTabProps {
    data: ManpowerSheetRow[] | undefined | null;
    loading: boolean;
    error: string | null;
    dateRange: DateRange | undefined;
    // --- MODIFIED: Add setDateRange prop definition ---
    setDateRange: Dispatch<SetStateAction<DateRange | undefined>>; // <-- السطر ده تمت إضافته
    // --- END MODIFIED ---
    sortState: ManpowerSortState;
    onSort: (column: ManpowerSortColumn) => void;
    onExport: (data: ManpowerSheetRow[], fileName: string, tableId: string) => void;
}

// Helper to format date
const formatDateDisplay = (timestamp: number | null): string => {
    if (timestamp && isValid(new Date(timestamp))) {
        return format(new Date(timestamp), 'dd-MMM'); // Shorter format like 30-Apr
    }
    return 'N/A';
};

// --- Main Component ---
export function ManpowerTab({
    data, // Expects filtered & sorted data from parent (page.tsx)
    loading, error, dateRange, sortState,
    setDateRange, // Now accepting the prop
    onSort, onExport
}: ManpowerTabProps) {

    // --- Calculate Summary ---
    const summaryData = useMemo((): ManpowerSummary => {
        if (!data || data.length === 0) {
            return { totalManDays: 0, avgTotalManpower: null, peakTotalManpower: null, avgHvac: null, avgFf: null, avgFa: null, numberOfDays: 0 };
        }
        let totalManDays = 0; let sumTotal = 0, countTotal = 0, peakTotal = 0;
        let sumHvac = 0, countHvac = 0; let sumFf = 0, countFf = 0; let sumFa = 0, countFa = 0;

        data.forEach(row => {
            const total = row.totalManpower ?? ((row.hvacManpower ?? 0) + (row.firefightingManpower ?? 0) + (row.fireAlarmManpower ?? 0));
            const hvac = row.hvacManpower; const ff = row.firefightingManpower; const fa = row.fireAlarmManpower;
            if (typeof total === 'number' && !isNaN(total)) { totalManDays += total; sumTotal += total; countTotal++; if (total > peakTotal) { peakTotal = total; } }
            if (typeof hvac === 'number' && !isNaN(hvac)) { sumHvac += hvac; countHvac++; }
            if (typeof ff === 'number' && !isNaN(ff)) { sumFf += ff; countFf++; }
            if (typeof fa === 'number' && !isNaN(fa)) { sumFa += fa; countFa++; }
        });
        const uniqueDays = new Set(data.map(d => d.timestamp)).size;
        return {
            totalManDays: totalManDays, avgTotalManpower: countTotal > 0 ? (sumTotal / countTotal) : null,
            peakTotalManpower: peakTotal > 0 ? peakTotal : null, avgHvac: countHvac > 0 ? (sumHvac / countHvac) : null,
            avgFf: countFf > 0 ? (sumFf / countFf) : null, avgFa: countFa > 0 ? (sumFa / countFa) : null,
            numberOfDays: uniqueDays
        };
    }, [data]);

    // --- Loading/Error Handling ---
    if (loading) {
        return <div className="flex justify-center items-center h-60"><Icons.spinner className="h-8 w-8 animate-spin"/><p className="ml-2 text-lg">Loading Manpower Data...</p></div>;
    }
    if (error && (!data || data.length === 0)) {
        return ( <Card className="border-destructive bg-destructive/10 h-full flex items-center justify-center"> <CardContent className="text-center"> <h3 className="text-lg font-semibold text-destructive mb-2">Error Loading Manpower Data</h3> <p className="text-sm text-destructive">{error}</p> </CardContent> </Card> );
    }

    // --- Table Columns Definition ---
    const columns: { key: ManpowerSortColumn; label: string; className?: string }[] = [
        { key: 'timestamp', label: 'Date', className: 'w-[100px] px-2 whitespace-nowrap' },
        { key: 'hvacManpower', label: 'HVAC', className: 'w-[90px] text-center px-2' },
        { key: 'firefightingManpower', label: 'Firefighting', className: 'w-[100px] text-center px-2' },
        { key: 'fireAlarmManpower', label: 'Fire Alarm', className: 'w-[90px] text-center px-2' },
        { key: 'totalManpower', label: 'Total', className: 'w-[90px] text-center px-2 font-semibold' },
    ];
    const tableColSpan = columns.length;

    // --- Return JSX ---
    return (
        <div className="flex flex-col gap-4 h-full">

            {/* Row 1: Summary Cards */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-7 px-1 flex-shrink-0">
                <Card className="p-3"> <CardDescription className="text-xs mb-1">Total Man-Days</CardDescription> <CardTitle className="text-lg font-bold">{summaryData?.totalManDays ?? '-'}</CardTitle> </Card>
                <Card className="p-3"> <CardDescription className="text-xs mb-1">Avg. Daily Total</CardDescription> <CardTitle className="text-lg font-bold">{summaryData?.avgTotalManpower?.toFixed(1) ?? '-'}</CardTitle> </Card>
                <Card className="p-3"> <CardDescription className="text-xs mb-1">Peak Daily Total</CardDescription> <CardTitle className="text-lg font-bold">{summaryData?.peakTotalManpower ?? '-'}</CardTitle> </Card>
                <Card className="p-3"> <CardDescription className="text-xs mb-1">Avg. HVAC</CardDescription> <CardTitle className="text-lg font-bold">{summaryData?.avgHvac?.toFixed(1) ?? '-'}</CardTitle> </Card>
                <Card className="p-3"> <CardDescription className="text-xs mb-1">Avg. FF</CardDescription> <CardTitle className="text-lg font-bold">{summaryData?.avgFf?.toFixed(1) ?? '-'}</CardTitle> </Card>
                <Card className="p-3"> <CardDescription className="text-xs mb-1">Avg. FA</CardDescription> <CardTitle className="text-lg font-bold">{summaryData?.avgFa?.toFixed(1) ?? '-'}</CardTitle> </Card>
                <Card className="p-3"> <CardDescription className="text-xs mb-1">Days Shown</CardDescription> <CardTitle className="text-lg font-bold">{summaryData?.numberOfDays ?? '-'}</CardTitle> </Card>
            </div>

            {/* Row 2: Chart */}
            <div className="px-1 flex-shrink-0">
                <Card className="h-[300px] flex flex-col">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div> <CardTitle className="text-base font-semibold">Manpower Trend</CardTitle> <CardDescription className="text-xs">Daily distribution (Filtered & Sorted)</CardDescription> </div>
                         {/* Maybe add DatePicker component here IF needed inside this tab */}
                         {/* Example: <DatePickerWithRange date={dateRange} onDateChange={setDateRange} /> */}
                        {/*<div className="text-xs text-muted-foreground">(Date filter applied in parent)</div>*/}
                    </CardHeader>
                    <CardContent className="flex-grow pt-4">
                        {/* Use the new ChartJS component, passing the filtered data */}
                        <ManpowerChartJS data={data ?? []} />
                    </CardContent>
                </Card>
            </div>

            {/* Row 3: Table */}
            <div className="px-1 flex-grow flex flex-col overflow-hidden">
                <Card className="h-full flex flex-col overflow-hidden border shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 flex-shrink-0 border-b">
                        <div> <CardTitle className="text-base font-semibold">Daily Details</CardTitle> <CardDescription className="text-xs">Click headers to sort. Days: {data?.length ?? 0}</CardDescription> </div>
                        <Button onClick={() => onExport(data ?? [], 'Manpower_Data_Filtered', 'manpower-table')} variant="outline" size="sm" disabled={!data || data.length === 0} > <Icons.download className="mr-1.5 h-3.5 w-3.5" /> Export Range </Button>
                    </CardHeader>
                    <CardContent className="flex-grow overflow-y-auto p-0">
                        <Table id="manpower-table" className="w-full text-xs">
                            <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
                                <TableRow>
                                    {columns.map(col => (
                                        <TableHead key={col.key} onClick={() => onSort(col.key)} className={cn("cursor-pointer", col.className)} >
                                            <div className={cn("flex items-center gap-1", col.className?.includes('text-center') ? 'justify-center' : '')}>
                                                <span>{col.label}</span>
                                                {sortState.column === col.key && sortState.direction === 'asc' && <Icons.arrowUp className="h-3 w-3" />}
                                                {sortState.column === col.key && sortState.direction === 'desc' && <Icons.arrowDown className="h-3 w-3" />}
                                            </div>
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(!data || data.length === 0) ? (
                                    <TableRow><TableCell colSpan={tableColSpan} className="h-24 text-center text-muted-foreground">No data available for the selected date range.</TableCell></TableRow>
                                ) : (
                                    data.map((row, index) => {
                                        const displayTotal = row.totalManpower ?? ((row.hvacManpower ?? 0) + (row.firefightingManpower ?? 0) + (row.fireAlarmManpower ?? 0));
                                        return (
                                            <TableRow key={row.timestamp ?? index}>
                                                <TableCell className="px-2 py-1.5 whitespace-nowrap">{formatDateDisplay(row.timestamp)}</TableCell>
                                                <TableCell className="px-2 py-1.5 text-center">{row.hvacManpower ?? '-'}</TableCell>
                                                <TableCell className="px-2 py-1.5 text-center">{row.firefightingManpower ?? '-'}</TableCell>
                                                <TableCell className="px-2 py-1.5 text-center">{row.fireAlarmManpower ?? '-'}</TableCell>
                                                <TableCell className="px-2 py-1.5 text-center font-semibold">{displayTotal > 0 ? displayTotal : '-'}</TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
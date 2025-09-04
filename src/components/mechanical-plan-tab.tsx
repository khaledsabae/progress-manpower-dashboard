// src/components/mechanical-plan-tab.tsx
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";
import { format, isValid, startOfDay, addDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { AlertTriangle, Clock } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts';
import { Gantt, ViewMode, Task as OriginalGanttTask } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import { useChartColors } from '@/hooks/use-chart-colors';

import type {
    MechanicalPlanSortState, MechanicalPlanSortColumn,
    EnhancedMechanicalPlanRow,
    GanttTaskData, EnhancedMechanicalPlanSummary, ActualStatusCount
} from '@/types';

type PlanViewMode = 'gantt' | 'table';

interface MechanicalPlanTabProps {
    data: EnhancedMechanicalPlanRow[];
    loading: boolean;
    error: string | null;
    sortState: MechanicalPlanSortState;
    summaryData: EnhancedMechanicalPlanSummary;
    statusCounts: ActualStatusCount[];
    onSort: (column: MechanicalPlanSortColumn) => void;
    onExport: (data: EnhancedMechanicalPlanRow[], fileName: string, tableId: string) => void;
    todayTimestamp: number;
}

// --- بداية الكود الصحيح للدوال المساعدة ---
const formatPlanDate = (timestamp: number | null, originalString: string | null): string => {
    // Check if timestamp is a valid number representing a date
    if (timestamp && typeof timestamp === 'number' && isValid(new Date(timestamp))) {
        try {
            // Format the valid timestamp
            return format(new Date(timestamp), 'dd-MMM-yy');
        } catch (e) {
            // Log error and fallback to original string or generic error message
            console.error("Error formatting date timestamp:", timestamp, e);
            return originalString || 'Invalid Date'; // Ensure return string
        }
    }
    // Handle TBD specifically
    if (originalString?.trim().toLowerCase() === 'tbd') {
        return 'TBD'; // Ensure return string
    }
    // Handle other valid original strings
    if (originalString && typeof originalString === 'string' && originalString.trim() && originalString.trim() !== '-') {
        return originalString; // Ensure return string
    }
    // Default fallback if timestamp is invalid and original string is invalid/empty/hyphen
    return 'N/A'; // Ensure return string
};

const ActualStatusBadge = ({ status }: { status: EnhancedMechanicalPlanRow['actualStatus'] }) => {
    switch (status) {
        case 'Completed': return <Badge className="text-xs bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-700 border border-emerald-300"> <Icons.checkCircle className="mr-1 h-3 w-3" /> Completed </Badge>;
        case 'Ongoing': return <Badge className="text-xs bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700 border border-yellow-300"> <Icons.loader className="mr-1 h-3 w-3 animate-spin" /> Ongoing </Badge>;
        case 'Not Started': return <Badge className="text-xs bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700/50 dark:text-gray-300 dark:border-gray-600 border border-gray-300"> <Icons.pauseCircle className="mr-1 h-3 w-3" /> Not Started </Badge>;
        default: return <Badge variant="outline" className="text-xs"> <Icons.helpCircle className="mr-1 h-3 w-3" /> N/A </Badge>;
    }
};
// --- نهاية الكود الصحيح للدوال المساعدة ---


export function MechanicalPlanTab({
    data,
    loading, error, sortState, summaryData, statusCounts, onSort, onExport, todayTimestamp
}: MechanicalPlanTabProps) {

    const [viewMode, setViewMode] = React.useState<PlanViewMode>('table');
    const [ganttViewScale, setGanttViewScale] = useState<ViewMode>(ViewMode.Week);
    const { primary, muted, success, warning, destructive, grid, foreground, axis, tooltipBg, tooltipText } = useChartColors();
    const upcomingCutoffTimestamp = startOfDay(addDays(new Date(todayTimestamp), 5)).getTime();

    // تأمين المتغيرات اللي ممكن تسبب مشكلة لو undefined
    const safeData = useMemo(() => Array.isArray(data) ? data : [], [data]);
    const safeStatusCounts = Array.isArray(statusCounts) ? statusCounts : [];
    const safeSummaryData = summaryData || { totalActivities: 0, completedActivities: 0, ongoingActivities: 0, notStartedActivities: 0, activitiesWithNAStatus: 0 };

    const derivedGanttTasks = useMemo((): GanttTaskData[] => {
        if (loading || !Array.isArray(safeData)) { return []; }
        return safeData
            .filter(row => row?.calculatedStartTimestamp && row.calculatedFinishTimestamp && row.calculatedStartTimestamp < row.calculatedFinishTimestamp)
            .map((row): GanttTaskData | null => {
                if (!row) return null;
                const startDate = new Date(row.calculatedStartTimestamp!);
                const endDate = new Date(row.calculatedFinishTimestamp!);
                if (!isValid(startDate) || !isValid(endDate)) { return null; }
                const taskId = row.id as string;
                const progressValue = typeof row.currentProgressPercentage === 'number' ? row.currentProgressPercentage : 0;
                let styles: OriginalGanttTask['styles'] = {
                    backgroundColor: muted || '#f4f4f4', backgroundSelectedColor: primary || '#3b82f6',
                    progressColor: muted ? `${muted}dd` : '#a1a1aa', progressSelectedColor: primary || '#3b82f6',
                };
                switch (row.actualStatus) {
                    case 'Completed': styles = { ...styles, progressColor: success || '#10b981', progressSelectedColor: success ? `${success}ff` : '#059669', backgroundColor: success || '#10b981' }; break;
                    case 'Ongoing': styles = { ...styles, progressColor: warning || '#f59e0b', progressSelectedColor: warning ? `${warning}ff` : '#d97706', backgroundColor: warning || '#f59e0b' }; break;
                    case 'Not Started': styles = { ...styles, progressColor: muted ? `${muted}50` : '#e5e7eb', backgroundColor: muted || '#d1d5db' }; break;
                    default: styles = { ...styles, progressColor: muted ? `${muted}30` : '#f3f4f6', backgroundColor: muted ? `${muted}a0` : '#e5e7eb' };
                }
                const taskObject: GanttTaskData = {
                    id: taskId, name: `${row.areaBuilding || 'Bldg'} - ${row.mechanicalActivitySystem || 'Activity'}`,
                    start: startDate, end: endDate, progress: progressValue, type: 'task', isDisabled: false, styles: styles,
                };
                return taskObject;
            }).filter((task): task is GanttTaskData => task !== null);
    }, [safeData, loading, primary, muted, success, warning]);

    if (loading && safeData.length === 0 && derivedGanttTasks.length === 0) {
        return ( <div className="flex justify-center items-center h-60"> <Icons.spinner className="h-8 w-8 animate-spin"/> <p className="ml-2 text-lg">Loading Plan Data...</p> </div> );
    }
    if (error && safeData.length === 0 && derivedGanttTasks.length === 0) {
        return ( <Card className="border-destructive bg-destructive/10 h-full flex items-center justify-center"> <CardContent className="text-center"> <h3 className="text-lg font-semibold text-destructive mb-2">Error Loading Plan</h3> <p className="text-sm text-destructive">{error}</p> </CardContent> </Card> );
    }

    const columns: { key: keyof EnhancedMechanicalPlanRow | string; label: string; className?: string }[] = [
        { key: 'areaBuilding', label: 'Area/Building', className: 'w-[180px] px-2 sticky left-0 bg-background z-20' },
        { key: 'locationRoomLevel', label: 'Location (Room/Level)', className: 'min-w-[150px] px-2' },
        { key: 'mechanicalActivitySystem', label: 'Mechanical Activity', className: 'min-w-[200px] px-2 flex-1' },
        { key: 'currentProgressPercentage', label: '% Comp', className: 'w-[80px] px-1 text-center' },
        { key: 'keyPredecessorActivity', label: 'Key Predecessor', className: 'min-w-[200px] px-2' },
        { key: 'predecessorFinishTimestamp', label: 'Pred. Finish', className: 'w-[90px] px-1.5 whitespace-nowrap' },
        { key: 'calculatedStartTimestamp', label: 'Calc. Start', className: 'w-[90px] px-1.5 whitespace-nowrap' },
        { key: 'calculatedFinishTimestamp', label: 'Calc. Finish', className: 'w-[90px] px-1.5 whitespace-nowrap' },
        { key: 'originalDurationDays', label: 'Orig. Dur', className: 'w-[60px] text-center px-1' },
        { key: 'actualStatus', label: 'Actual Status', className: 'w-[130px] px-1.5 whitespace-nowrap' },
        { key: 'remarksJustification', label: 'Remarks / Justification', className: 'min-w-[250px] px-2' },
    ];
    const sortableColumns: MechanicalPlanSortColumn[] = [ 'areaBuilding', 'locationRoomLevel', 'mechanicalActivitySystem', 'currentProgressPercentage', 'keyPredecessorActivity', 'predecessorFinishTimestamp', 'calculatedStartTimestamp', 'calculatedFinishTimestamp', 'originalDurationDays', 'actualStatus', 'remarksJustification' ];

    const getStatusColor = (status: string): string => {
        switch (status) {
            case 'Completed': return success || '#10b981';
            case 'Ongoing': return warning || '#eab308';
            case 'Not Started': return '#94a3b8';
            default: return muted || '#a1a1aa';
        }
    };

    let chartOrMessageContent: React.ReactElement;
    if (safeStatusCounts.length > 0) {
        chartOrMessageContent = (
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={safeStatusCounts} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={grid || '#e5e7eb'} />
                    <XAxis type="number" allowDecimals={false} fontSize={10} stroke={axis || '#9ca3af'} />
                    <YAxis dataKey="status" type="category" width={80} tick={{ fontSize: 10 }} interval={0} axisLine={false} tickLine={false} stroke={axis || '#9ca3af'} />
                    <RechartsTooltip
                        cursor={{ fill: muted ? `${muted}80` : 'hsl(var(--muted))' }}
                        contentStyle={{ backgroundColor: tooltipBg || '#ffffff', border: `1px solid ${grid || '#ccc'}`, borderRadius: 'var(--radius)', color: tooltipText || '#111827' }}
                        content={({ active, payload }) => { if (active && payload && payload.length) { return ( <div className="rounded-lg border bg-popover text-popover-foreground p-2 shadow-sm"> <p className="text-sm font-medium">{`${payload[0].payload.status}: ${payload[0].value}`}</p> </div> ); } return null; }}
                    />
                    <Bar dataKey="count" name="Activities" barSize={20} radius={[2, 2, 0, 0]} >
                        {safeStatusCounts.map((entry, index) => (<Cell key={`cell-${index}`} fill={getStatusColor(entry.status)} />))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        );
    } else {
        chartOrMessageContent = ( <div className="flex items-center justify-center h-full text-muted-foreground text-sm"> {"No status data for chart."} </div> );
    }

    return (
        <div className="flex flex-col gap-4 h-full">
            {/* Top Section Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-1 flex-shrink-0">
                <div className="flex flex-col gap-3 md:col-span-1">
                    <Card className="p-3"> <div className="flex items-baseline justify-start gap-x-2"> <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Total Activities:</span> <span className="text-lg font-bold">{safeSummaryData.totalActivities ?? '-'}</span> </div> </Card>
                    <Card className="p-3"> <div className="flex items-baseline justify-start gap-x-2"> <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Completed:</span> <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{safeSummaryData.completedActivities ?? '-'}</span> </div> </Card>
                    <Card className="p-3"> <div className="flex items-baseline justify-start gap-x-2"> <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Ongoing:</span> <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{safeSummaryData.ongoingActivities ?? '-'}</span> </div> </Card>
                    <Card className="p-3"> <div className="flex items-baseline justify-start gap-x-2"> <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Not Started:</span> <span className="text-lg font-bold text-gray-600 dark:text-gray-400">{safeSummaryData.notStartedActivities ?? '-'}</span> </div> </Card>
                    {(safeSummaryData.activitiesWithNAStatus ?? 0) > 0 && ( <Card className="p-3 bg-amber-50 border border-amber-200 dark:bg-amber-900/30 dark:border-amber-700/50"> <div className="flex items-baseline justify-start gap-x-2"> <span className="text-sm font-medium text-amber-800 dark:text-amber-300 whitespace-nowrap">N/A Status:</span> <span className="text-lg font-bold text-amber-700 dark:text-amber-400">{safeSummaryData.activitiesWithNAStatus ?? '-'}</span> </div> </Card> )}
                </div>
                <Card className="md:col-span-2 h-full flex flex-col min-h-[220px]">
                    <CardHeader className="p-3 flex-shrink-0"><CardTitle className="text-base">Activities by Actual Status</CardTitle></CardHeader>
                    <CardContent className="p-2 flex-grow"> {chartOrMessageContent} </CardContent>
                </Card>
            </div>

            {/* Main Details Card (Table or Gantt) */}
            <div className="flex-grow flex flex-col overflow-hidden mt-1">
                <Card className="flex-grow flex flex-col overflow-hidden border shadow-sm h-full">
                    <CardHeader className="flex flex-row items-center justify-between flex-shrink-0 border-b px-4 py-2">
                        <div>
                            <CardTitle className="text-base font-semibold"> {viewMode === 'gantt' ? 'Mechanical Plan Timeline (Gantt View)' : 'Mechanical Installation Plan Details'} </CardTitle>
                            <CardDescription className="text-xs">
                                {viewMode === 'gantt' ?
                                    `${derivedGanttTasks.length > 0 ? derivedGanttTasks.length : 'No'} activities with valid dates.` :
                                    `${safeData.length > 0 ? safeData.length : 'No'} activities listed. Click headers to sort.`
                                }
                            </CardDescription>
                        </div>
                        <div className='flex items-center gap-2'>
                            <Button onClick={() => setViewMode(prev => prev === 'gantt' ? 'table' : 'gantt')} variant="outline" size="sm" title={viewMode === 'gantt' ? 'Switch to Table View' : 'Switch to Gantt View'}> {viewMode === 'gantt' ? <Icons.tableView className="h-4 w-4" /> : <Icons.ganttView className="h-4 w-4" />} </Button>
                            <Button onClick={() => onExport(safeData, 'Mechanical_Plan_Integrated_Data', 'mechanical-plan-table')} variant="outline" size="sm" disabled={loading || safeData.length === 0} title="Export Table Data"> <Icons.download className="mr-1.5 h-3.5 w-3.5" /> Export Table </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-grow overflow-auto p-0 relative">
                        {viewMode === 'gantt' ? (
                            <div className='p-2 w-full h-full overflow-auto min-h-[500px] bg-card'>
                                {derivedGanttTasks.length === 0 ? ( <div className="flex items-center justify-center h-full text-muted-foreground">No tasks found with valid start/finish dates for the current filters.</div> ) : (
                                    <Gantt tasks={derivedGanttTasks} viewMode={ganttViewScale} onSelect={task => console.log('Selected Task:', task)} listCellWidth={""} ganttHeight={500} columnWidth={ganttViewScale === ViewMode.Month ? 90 : ganttViewScale === ViewMode.Week ? 150 : 65} todayColor={primary ? `${primary}33` : 'rgba(255, 87, 34, 0.2)'} barProgressColor="inherit" barProgressSelectedColor="inherit" barBackgroundColor="inherit" barBackgroundSelectedColor="inherit" />
                                )}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <TooltipProvider delayDuration={200}>
                                    <Table id="mechanical-plan-table" className="w-full text-xs relative border-collapse min-w-[1450px]">
                                        <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
                                            <TableRow className="border-b border-border">
                                                {columns.map(col => {
                                                    const isSortable = sortableColumns.includes(col.key as MechanicalPlanSortColumn);
                                                    return ( <TableHead key={col.key} onClick={isSortable ? () => onSort(col.key as MechanicalPlanSortColumn) : undefined} className={cn("whitespace-nowrap px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-muted", isSortable ? "cursor-pointer" : "", col.className?.includes('text-center') ? 'text-center' : 'text-left', col.className, col.className?.includes('sticky') ? 'sticky z-30' : '')} style={col.className?.includes('sticky') ? { left: 0 } : {}} > <div className={cn("flex items-center gap-1", col.className?.includes('text-center') ? 'justify-center' : '')}> <span>{col.label}</span> {isSortable && sortState.column === col.key && sortState.direction === 'asc' && <Icons.arrowUp className="h-3 w-3" />} {isSortable && sortState.column === col.key && sortState.direction === 'desc' && <Icons.arrowDown className="h-3 w-3" />} </div> </TableHead> );
                                                })}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {safeData.length === 0 ? ( <TableRow><TableCell colSpan={columns.length} className="text-center h-24 text-muted-foreground">No integrated mechanical plan data available.</TableCell></TableRow> ) : (
                                                safeData.map((row, index) => {
                                                    if (!row) return null;
                                                    const finishTs = row.calculatedFinishTimestamp;
                                                    const startTs = row.calculatedStartTimestamp;
                                                    const isCompleted = row.actualStatus === 'Completed';
                                                    const isDelayed = !isCompleted && typeof finishTs === 'number' && finishTs < todayTimestamp;
                                                    const isUpcoming = !isCompleted && typeof startTs === 'number' && startTs >= todayTimestamp && startTs < upcomingCutoffTimestamp;
                                                    const isTBD = row.calculatedStartDateString?.toLowerCase() === 'tbd' || row.calculatedFinishDateString?.toLowerCase() === 'tbd';
                                                    return (
                                                        <TableRow key={row.id || index} className={cn( "hover:bg-muted/50 border-b border-border/40", isDelayed && "table-row-delayed", isUpcoming && !isDelayed && "table-row-upcoming", isTBD && "opacity-70 italic" )}>
                                                            <TableCell className={cn("px-2 py-1 truncate", columns[0].className)} style={columns[0].className?.includes('sticky') ? { left: 0 } : {}} title={row.areaBuilding ?? ''}>{row.areaBuilding ?? 'N/A'}</TableCell>
                                                            <TableCell className={cn("px-2 py-1 truncate", columns[1].className)} title={row.locationRoomLevel ?? ''}>{row.locationRoomLevel ?? '-'}</TableCell>
                                                            <TableCell className={cn("px-2 py-1", columns[2].className)} title={row.mechanicalActivitySystem ?? ''}>{row.mechanicalActivitySystem ?? 'N/A'}</TableCell>
                                                            <TableCell className={cn("px-1 py-1 text-center", columns[3].className)}> {row.currentProgressPercentage !== null ? ( <div className="flex items-center justify-center gap-1" title={`${row.currentProgressPercentage}%`}> <Progress value={row.currentProgressPercentage ?? 0} className="h-2 flex-1 max-w-[40px]" /> <span className="text-[10px] font-medium">{`${row.currentProgressPercentage}%`}</span> </div> ) : (<span className="text-xs text-muted-foreground">N/A</span>)} </TableCell>
                                                            <TableCell className={cn("px-2 py-1 truncate", columns[4].className)} title={row.keyPredecessorActivity ?? ''}>{row.keyPredecessorActivity ?? '-'}</TableCell>
                                                            <TableCell className={cn("px-1.5 py-1 whitespace-nowrap", columns[5].className)}>{formatPlanDate(row.predecessorFinishTimestamp, row.predecessorFinishDateString)}</TableCell>
                                                            <TableCell className={cn("px-1.5 py-1 whitespace-nowrap", columns[6].className)}>{formatPlanDate(row.calculatedStartTimestamp, row.calculatedStartDateString)}</TableCell>
                                                            <TableCell className={cn("px-1.5 py-1 whitespace-nowrap", columns[7].className, isDelayed && "font-semibold text-destructive")}>{formatPlanDate(row.calculatedFinishTimestamp, row.calculatedFinishDateString)}</TableCell>
                                                            <TableCell className={cn("px-1 py-1 text-center", columns[8].className)}>{row.originalDurationDays ?? 'N/A'}</TableCell>
                                                            <TableCell className={cn("px-1.5 py-1", columns[9].className)}><div className="flex items-center gap-1"><ActualStatusBadge status={row.actualStatus} />{isDelayed && ( <Tooltip><TooltipTrigger><AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" /></TooltipTrigger><TooltipContent side="top"><p>Delayed</p></TooltipContent></Tooltip> )}{isUpcoming && !isDelayed && ( <Tooltip><TooltipTrigger><Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" /></TooltipTrigger><TooltipContent side="top"><p>Upcoming Start</p></TooltipContent></Tooltip> )}</div></TableCell>
                                                            <TableCell className={cn("px-2 py-1", columns[10].className)} title={row.remarksJustification ?? ''}><div className='max-w-[300px] whitespace-normal break-words'>{row.remarksJustification ?? '-'}</div></TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                            )}
                                        </TableBody>
                                    </Table>
                                </TooltipProvider>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
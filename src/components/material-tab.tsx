"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    AlertTriangle, Link as LinkIcon, Truck, PackageCheck, PackageSearch, Package, Clock
} from 'lucide-react';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useChartColors } from '@/hooks/use-chart-colors';
import type { MaterialStatusRow } from '@/services/google-sheets';
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";
import { format, isValid, startOfDay, addDays } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from "recharts";
import type { MaterialSortState, MaterialSortColumn, MaterialSummary, SystemCount } from '@/types';

// Props Interface
interface MaterialTabFilters {
    systemFilter: string;
    statusFilter: string;
    locationFilter: string;
    approvalFilter: string;
    systems: string[];
    statuses: string[];
    locations: string[];
    approvals: string[];
}
interface MaterialTabProps {
    data: MaterialStatusRow[];
    loading: boolean;
    error: string | null;
    filters: MaterialTabFilters;
    sortState: MaterialSortState;
    onSystemFilterChange: (value: string) => void;
    onStatusFilterChange: (value: string) => void;
    onLocationFilterChange: (value: string) => void;
    onApprovalFilterChange: (value: string) => void;
    onSort: (column: MaterialSortColumn) => void;
    onExport: (data: MaterialStatusRow[], fileName: string, tableId: string) => void;
}

const formatDate = (timestamp: number | null, originalString: string | null = null): string => {
    if (timestamp && isValid(new Date(timestamp))) {
        try {
            return format(new Date(timestamp), 'dd-MMM-yy');
        }
        catch (e) {
            console.error("Error formatting date timestamp:", timestamp, e);
            return originalString || 'Invalid Date';
        }
    }
    return originalString && originalString.trim() && originalString.trim() !== '-' ? originalString : 'N/A';
};

const DeliveryStatusBadge = ({ status }: { status: string | null }) => {
    const originalStatus = status?.trim() ?? "";
    const lcs = originalStatus.toLowerCase();

    const deliveredKeywords = ['delivered', 'on site', 'installed', 'مكتمل التسليم'];
    const partialKeywords = ['partial delivery', 'partially delivered', 'partially del', 'جزء', 'تسليم جزئي'];
    const rejectedOrLateKeywords = ['rejected', 'overdue', 'late', 'مرفوض'];

    if (!lcs || lcs === '-' || lcs === 'n/a') { return <span className="text-xs text-muted-foreground">N/A</span>; }

    // --- بداية التعديل لمنطق isDelivered ---
    let isActuallyDelivered = false;
    if (lcs === "delivered" || lcs === "مكتمل التسليم" || lcs === "on site" || lcs === "installed") {
        isActuallyDelivered = true;
    } else if (deliveredKeywords.some(kw => lcs.includes(kw))) {
        // لو لسه بيلاقي delivered جوه جملة، نتأكد إن مفيش "not" قبلها أو إنها مش "not delivered" صريحة
        if (!lcs.includes("not delivered") && !lcs.startsWith("not ")) { // نتأكد إنها مش "not delivered"
             isActuallyDelivered = true;
        }
    }
    // --- نهاية التعديل لمنطق isDelivered ---

    if (isActuallyDelivered) { // استخدم المتغير الجديد
        return <Badge className="text-xs border border-emerald-300 dark:border-emerald-700 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300">{originalStatus}</Badge>;
    }
    if (partialKeywords.some(kw => lcs.includes(kw))) {
        return <Badge className="text-xs border border-sky-300 dark:border-sky-700 bg-sky-100 text-sky-800 hover:bg-sky-200 dark:bg-sky-900/50 dark:text-sky-300">{originalStatus}</Badge>;
    }
    if (rejectedOrLateKeywords.some(kw => lcs.includes(kw))) {
        return <Badge className="text-xs border border-rose-300 dark:border-rose-700 bg-rose-100 text-rose-800 hover:bg-rose-200 dark:bg-rose-900/50 dark:text-rose-300">{originalStatus}</Badge>;
    }
    
    return <Badge className="text-xs border border-amber-300 dark:border-amber-700 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-300">{originalStatus}</Badge>;
};

const isValidUrl = (urlString: string | null | undefined): boolean => {
    if (!urlString) return false;
    try { new URL(urlString); return true; } catch (_) { return false; }
};

const CustomPieTooltip = ({ active, payload, colors }: { active?: boolean, payload?: any[], colors: ReturnType<typeof useChartColors> }) => {
    if (active && payload && payload.length) {
        const data = payload[0];
        return ( <div className="rounded-lg border p-2 shadow-sm" style={{ backgroundColor: colors.tooltipBg, borderColor: colors.grid, color: colors.tooltipText, }}> <p className="text-sm font-medium">{`${data.name}: ${data.value}`}</p> </div> );
    } return null;
};

export function MaterialTab({
    data, loading, error, filters, sortState,
    onSystemFilterChange, onStatusFilterChange, onLocationFilterChange, onApprovalFilterChange, onSort, onExport
}: MaterialTabProps) {

    const themeColors = useChartColors();
    const today = startOfDay(new Date()).getTime();
    const upcomingCutoffTimestamp = startOfDay(addDays(new Date(), 5)).getTime();

    const safeData = useMemo(() => Array.isArray(data) ? data : [], [data]);
    const safeFilters = filters || {};
    const systemOptions = (safeFilters.systems && Array.isArray(safeFilters.systems)) ? safeFilters.systems : ["All Systems"];
    const statusOptions = (safeFilters.statuses && Array.isArray(safeFilters.statuses)) ? safeFilters.statuses : ["All Statuses"];
    const locationOptions = (safeFilters.locations && Array.isArray(safeFilters.locations)) ? safeFilters.locations : ["All Locations"];
    const approvalOptions = (safeFilters.approvals && Array.isArray(safeFilters.approvals)) ? safeFilters.approvals : ["All Stages"];

    const { summaryData, systemCounts } = useMemo(() => {
        if (!safeData || safeData.length === 0) {
            return { summaryData: { totalItems: 0, deliveredItems: 0, partiallyDeliveredItems: 0, pendingItems: 0, overdueItems: 0, rejectedItems: 0 }, systemCounts: [] };
        }
        
        let delivered = 0, partial = 0, rejected = 0, overdue = 0;
        const systemCountMap: { [key: string]: number } = {};

        const deliveredKeywords = ['delivered', 'on site', 'installed', 'مكتمل التسليم'];
        const partialKeywords = ['partial delivery', 'partially delivered', 'partially del', 'جزء', 'تسليم جزئي']; // <--- تم تحديثها هنا
        const rejectedOrLateKeywords = ['rejected', 'overdue', 'late', 'مرفوض'];

        safeData.forEach(row => {
            const systemName = row.system || "Unspecified"; 
            systemCountMap[systemName] = (systemCountMap[systemName] || 0) + 1;
            
            const status = row.deliveryStatus?.trim().toLowerCase() ?? "";
            
            // --- بداية التعديل لمنطق isDelivered ---
            let isActuallyDelivered = false;
            if (status === "delivered" || status === "مكتمل التسليم" || status === "on site" || status === "installed") {
                isActuallyDelivered = true;
            } else if (deliveredKeywords.some(kw => status.includes(kw))) {
                if (!status.includes("not delivered") && !status.startsWith("not ")) {
                     isActuallyDelivered = true;
                }
            }
            // --- نهاية التعديل لمنطق isDelivered ---
            
            let isPartiallyDelivered = false; 
    
            if (isActuallyDelivered) { // استخدم المتغير الجديد
                delivered++; 
            } else if (partialKeywords.some(kw => status.includes(kw))) { 
                partial++; 
                isPartiallyDelivered = true; 
            } else if (rejectedOrLateKeywords.some(kw => status.includes(kw))) { 
                rejected++;
            }
            
            if (!isActuallyDelivered && !isPartiallyDelivered && row.plannedTimestamp !== null && row.plannedTimestamp < today) {
                 const isRejected = rejectedOrLateKeywords.some(kw => status.includes(kw));
                 if (!isRejected) { 
                    overdue++;
                 }
            }
        });
        
        const calculatedPending = safeData.length - (delivered + partial + rejected);
        const finalSummaryData: MaterialSummary = { 
            totalItems: safeData.length, 
            deliveredItems: delivered, 
            partiallyDeliveredItems: partial, 
            pendingItems: Math.max(0, calculatedPending), 
            overdueItems: overdue, 
            rejectedItems: rejected 
        };
        const finalSystemCounts: SystemCount[] = Object.entries(systemCountMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
        
        return { summaryData: finalSummaryData, systemCounts: finalSystemCounts };
    }, [safeData, today]);

    if (loading && safeData.length === 0) {
        return <div className="flex justify-center items-center h-60"><Icons.spinner className="h-8 w-8 animate-spin" /><p className="ml-2 text-lg">Loading Material Data...</p></div>;
    }
    if (error && safeData.length === 0) {
        return ( <Card className="border-destructive bg-destructive/10 h-full flex items-center justify-center"> <CardContent className="text-center"> <h3 className="text-lg font-semibold text-destructive mb-2">Error Loading Material Status</h3> <p className="text-sm text-destructive">{error}</p> </CardContent> </Card> );
    }

    const columns: { key: MaterialSortColumn | string; label: string; className?: string }[] = [
        { key: 'system', label: 'System', className: 'w-[90px] px-2' }, 
        { key: 'itemDescription', label: 'Item Description', className: 'min-w-[250px] px-2' },
        { key: 'buildingLocation', label: 'Location', className: 'w-[160px] px-2' }, 
        { key: 'approvalStage', label: 'Approval', className: 'w-[100px] px-2' },
        { key: 'deliveryStatus', label: 'Delivery Status', className: 'w-[140px] px-2' }, 
        { key: 'quantity', label: 'Qty', className: 'text-center w-[60px] px-2' },
        { key: 'plannedTimestamp', label: 'Planned', className: 'w-[100px] px-2 whitespace-nowrap' }, 
        { key: 'actualTimestamp', label: 'Actual', className: 'w-[100px] px-2 whitespace-nowrap' },
        { key: 'remarks', label: 'Remarks', className: 'min-w-[150px] px-2' }, 
        { key: 'documentLink', label: 'Doc', className: 'w-[50px] text-center px-1' },
    ];
    const sortableColumns: MaterialSortColumn[] = ['system', 'itemDescription', 'buildingLocation', 'approvalStage', 'deliveryStatus', 'plannedTimestamp', 'actualTimestamp'];
    const tableColSpan = columns.length;

    const renderChartContent = () => {
        if (systemCounts && systemCounts.length > 0) {
            const themedPieColors = [ 
                themeColors.chart1, themeColors.chart2, themeColors.chart3, 
                themeColors.chart4, themeColors.chart5, themeColors.primary, 
                themeColors.accent, themeColors.secondary, 
            ];
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie 
                            data={systemCounts} 
                            cx="50%" 
                            cy="50%" 
                            labelLine={false} 
                            outerRadius={60} 
                            innerRadius={30} 
                            dataKey="value" 
                            nameKey="name" 
                            stroke={themeColors.grid} 
                        >
                            {systemCounts.map((entry, index) => ( 
                                <Cell key={`cell-${index}`} fill={themedPieColors[index % themedPieColors.length]} /> 
                            ))}
                        </Pie>
                        <RechartsTooltip content={<CustomPieTooltip colors={themeColors} />} />
                        <Legend 
                            layout="vertical" 
                            align="right" 
                            verticalAlign="middle" 
                            iconSize={8} 
                            wrapperStyle={{ fontSize: '10px', lineHeight: '12px', paddingLeft: '10px', color: themeColors.axis }} 
                        />
                    </PieChart>
                </ResponsiveContainer>
            );
        } 
        return <div className="flex items-center justify-center h-full text-muted-foreground text-sm text-center">No system data available for chart.</div>;
    };

    return (
        <div className="flex flex-col gap-4 h-full">
            {/* ----- Top Section Grid Layout ----- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-1 flex-shrink-0 items-stretch">
                {/* Summary Cards */}
                <div className="flex flex-col justify-around gap-3 md:col-span-1">
                    <Card className="p-3"> <div className="flex items-center justify-between mb-1"><span className="text-sm font-medium text-muted-foreground">Total Items</span><PackageSearch className="h-4 w-4 text-muted-foreground"/></div> <div className="text-2xl font-bold">{summaryData?.totalItems ?? '-'}</div> </Card>
                    <Card className="p-3"> <div className="flex items-center justify-between mb-1"><span className="text-sm font-medium text-muted-foreground">Delivered</span><PackageCheck className="h-4 w-4 text-emerald-500"/></div> <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{summaryData?.deliveredItems ?? '-'}</div> </Card>
                    <Card className="p-3"> <div className="flex items-center justify-between mb-1"><span className="text-sm font-medium text-muted-foreground">Partially Del.</span><Truck className="h-4 w-4 text-sky-500"/></div> <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">{summaryData?.partiallyDeliveredItems ?? '-'}</div> </Card>
                </div>
                {/* Pie Chart Card */}
                <Card className="md:col-span-1 flex flex-col min-h-[200px]">
                    <CardHeader className="p-3 pb-1 flex-shrink-0"><CardTitle className="text-base">Items by System</CardTitle><CardDescription className="text-xs">Distribution of filtered items</CardDescription></CardHeader>
                    <CardContent className="p-1 flex-grow flex justify-center items-center">{renderChartContent()}</CardContent>
                </Card>
                {/* More Summary Cards */}
                <div className="flex flex-col justify-between gap-3 md:col-span-1">
                    <Card className="p-3"> <div className="flex items-center justify-between mb-1"><span className="text-sm font-medium text-muted-foreground">Pending</span><Package className="h-4 w-4 text-amber-500"/></div> <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{summaryData?.pendingItems ?? '-'}</div> </Card>
                    <Card className="p-3"> <div className="flex items-center justify-between mb-1"><span className="text-sm font-medium text-muted-foreground">Rejected / Late</span><Package className="h-4 w-4 text-rose-500"/></div> <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{summaryData?.rejectedItems ?? '-'}</div> </Card>
                    <Card className="p-3"> <div className="flex items-center justify-between mb-1"><span className="text-sm font-medium text-muted-foreground">Overdue Risk</span><AlertTriangle className="h-4 w-4 text-destructive"/></div> <div className="text-2xl font-bold text-destructive">{summaryData?.overdueItems ?? '-'}</div> {(summaryData?.overdueItems ?? 0) > 0 && <p className="text-xs text-muted-foreground pt-0.5">Not Delivered & Past Date</p>} </Card>
                </div>
            </div>

            {/* ----- Filters Section ----- */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-shrink-0 px-1">
                <Select value={safeFilters.systemFilter} onValueChange={onSystemFilterChange} disabled={loading}> <SelectTrigger className="w-full text-xs h-8"><SelectValue placeholder="System" /></SelectTrigger> <SelectContent>{systemOptions.map(s => (<SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>))}</SelectContent> </Select>
                <Select value={safeFilters.statusFilter} onValueChange={onStatusFilterChange} disabled={loading}> <SelectTrigger className="w-full text-xs h-8"><SelectValue placeholder="Status" /></SelectTrigger> <SelectContent>{statusOptions.map(st => (<SelectItem key={st} value={st} className="text-xs">{st}</SelectItem>))}</SelectContent> </Select>
                <Select value={safeFilters.locationFilter} onValueChange={onLocationFilterChange} disabled={loading}> <SelectTrigger className="w-full text-xs h-8"><SelectValue placeholder="Location" /></SelectTrigger> <SelectContent>{locationOptions.map(loc => (<SelectItem key={loc || 'na'} value={loc || ''} className="text-xs">{loc || 'N/A'}</SelectItem>))}</SelectContent> </Select>
                <Select value={safeFilters.approvalFilter} onValueChange={onApprovalFilterChange} disabled={loading}> <SelectTrigger className="w-full text-xs h-8"><SelectValue placeholder="Approval" /></SelectTrigger> <SelectContent>{approvalOptions.map(appr => (<SelectItem key={appr || 'na'} value={appr || ''} className="text-xs">{appr || 'N/A'}</SelectItem>))}</SelectContent> </Select>
            </div>

            {/* ----- Table Card ----- */}
            <div className="flex-grow flex flex-col overflow-hidden mt-1">
                <Card className="flex-grow flex flex-col overflow-hidden border shadow-sm h-full">
                    <CardHeader className="flex flex-row items-center justify-between flex-shrink-0 border-b px-4 py-2">
                        <div><CardTitle className="text-base font-semibold">Material Delivery Status</CardTitle><CardDescription className="text-xs">Click headers to sort. Items: {safeData.length}</CardDescription></div>
                        <Button onClick={() => onExport(safeData, 'Material_Status_Data', 'material-table')} variant="outline" size="sm" disabled={loading || safeData.length === 0}><Icons.download className="mr-1.5 h-3.5 w-3.5" /> Export</Button>
                    </CardHeader>
                    <CardContent className="flex-grow overflow-y-auto p-0 relative">
                        <TooltipProvider delayDuration={200}>
                            <Table id="material-table" className="w-full text-xs border-collapse">
                                <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
                                    <TableRow className="border-b border-border">
                                        {columns.map(col => {
                                            const isSortable = sortableColumns.includes(col.key as MaterialSortColumn);
                                            return ( <TableHead key={col.key} onClick={isSortable ? () => onSort(col.key as MaterialSortColumn) : undefined} className={cn("whitespace-nowrap px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-muted", isSortable ? "cursor-pointer" : "", col.className?.includes('text-center') ? 'text-center' : 'text-left', col.className )} > <div className={cn("flex items-center gap-1", col.className?.includes('text-center') ? 'justify-center' : '')}> <span>{col.label}</span> {isSortable && sortState.column === col.key && sortState.direction === 'asc' && <Icons.arrowUp className="h-3 w-3" />} {isSortable && sortState.column === col.key && sortState.direction === 'desc' && <Icons.arrowDown className="h-3 w-3" />} </div> </TableHead> );
                                        })}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {safeData.length === 0 ? (
                                        <TableRow><TableCell colSpan={tableColSpan} className="text-center h-60 text-muted-foreground">No material data available for the selected filters.</TableCell></TableRow>
                                    ) : (
                                        safeData.map((row, index) => {
                                            // Make sure statusLcs is defined for keyword checks
                                            const statusLcs = row.deliveryStatus?.trim().toLowerCase() ?? ""; 
                                            
                                            const deliveredKeywords = ['delivered', 'on site', 'installed', 'مكتمل التسليم'];
                                            const partialKeywords = ['partial delivery', 'partially delivered', 'partially del', 'جزء', 'تسليم جزئي']; // <--- تم تحديثها هنا

                                            const isDelivered = deliveredKeywords.some(kw => statusLcs.includes(kw));
                                            // Ensure isPartiallyDelivered is only true if not fully delivered
                                            const isPartiallyDelivered = !isDelivered && partialKeywords.some(kw => statusLcs.includes(kw)); 
                                            
                                            const plannedTs = row.plannedTimestamp;
                                            const isOverdue = !isDelivered && !isPartiallyDelivered && plannedTs !== null && plannedTs < today;
                                            const isUpcoming = !isDelivered && !isPartiallyDelivered && plannedTs !== null && plannedTs >= today && plannedTs < upcomingCutoffTimestamp;
                                            const hasValidDocLink = isValidUrl(row.documentLink);
                                            
                                            return (
                                                <TableRow
                                                    key={`${row.system}-${row.itemDescription}-${index}-${row.buildingLocation ?? 'na'}`} // Added null check for key
                                                    className={cn( "hover:bg-muted/50 border-b border-border/40", isOverdue && "table-row-delayed", isUpcoming && "table-row-upcoming" )} >
                                                    <TableCell className="px-2 py-1.5 truncate">{row.system ?? "-"}</TableCell>
                                                    <TableCell className="px-2 py-1.5" title={row.itemDescription ?? ''}>{row.itemDescription ?? "-"}</TableCell>
                                                    <TableCell className="px-2 py-1.5 truncate" title={row.buildingLocation ?? ''}>{row.buildingLocation ?? "-"}</TableCell>
                                                    <TableCell className="px-2 py-1.5 truncate">{row.approvalStage ?? "-"}</TableCell>
                                                    <TableCell className="px-2 py-1.5">
                                                        <div className="flex items-center justify-start gap-1">
                                                            <DeliveryStatusBadge status={row.deliveryStatus} />
                                                            {isOverdue && (
                                                                <Tooltip><TooltipTrigger><AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" /></TooltipTrigger><TooltipContent side="top"><p>Overdue</p></TooltipContent></Tooltip>
                                                            )}
                                                            {isUpcoming && !isOverdue && (
                                                                <Tooltip><TooltipTrigger><Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" /></TooltipTrigger><TooltipContent side="top"><p>Upcoming</p></TooltipContent></Tooltip>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="px-2 py-1.5 text-center whitespace-nowrap">{row.quantity ?? "-"}</TableCell>
                                                    <TableCell className="px-2 py-1.5 whitespace-nowrap">{formatDate(row.plannedTimestamp, row.plannedDeliveryDateString)}</TableCell>
                                                    <TableCell className="px-2 py-1.5 whitespace-nowrap">{formatDate(row.actualTimestamp, row.actualDeliveryDateString)}</TableCell>
                                                    <TableCell className="px-2 py-1.5" title={row.remarks ?? ''}>{row.remarks ?? "-"}</TableCell>
                                                    <TableCell className="px-1 py-1.5 text-center">
                                                        {hasValidDocLink ? ( 
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <a href={row.documentLink!} target="_blank" rel="noopener noreferrer" title={`Open document`} className="inline-flex items-center justify-center p-1 rounded-md text-primary hover:bg-accent hover:text-accent-foreground"> 
                                                                        <LinkIcon className="h-3.5 w-3.5"/> 
                                                                    </a>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="left" sideOffset={5}><p>Open Link</p></TooltipContent>
                                                            </Tooltip> 
                                                        ) : ( 
                                                            <span className="text-muted-foreground">-</span> 
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </TooltipProvider>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
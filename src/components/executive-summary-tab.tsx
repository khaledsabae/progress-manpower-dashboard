// src/components/executive-summary-tab.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CalendarClock, TrendingUp, Activity, Users, BarChartBig, CheckCircle, PackageX, ArrowUpRight, ArrowDownRight, Minus, Target, Package as PackageIcon } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, Tooltip as RechartsTooltip, CartesianGrid, XAxis, YAxis, AreaChart, Area } from 'recharts';
import { format, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import type { ComparisonResults, ProgressTrends, TrendDataPoint } from '@/types';
import { Icons } from "@/components/icons"; // Ensure Icons is imported
import { Progress } from "@/components/ui/progress";


// --- Interface for Props ---
interface ExecutiveSummaryTabProps {
    loading: boolean;
    historicalComparisons: ComparisonResults | null;
    weeklyVelocity: number | null; // Type allows null
    delayedActivitiesCount: number | null;
    materialRiskCount: number | null;
    progressTrends: ProgressTrends | null;
}

// --- Helper Components/Functions ---
const TrendTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-popover text-popover-foreground border px-1 py-0.5 rounded shadow-sm text-xs">
                {`${label}: ${payload[0].value?.toFixed(1)}%`}
            </div>
        );
    }
    return null;
};

const renderTrendIcon = (change: number | null | undefined) => {
    if (change === null || change === undefined || change === 0) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (change > 0) return <ArrowUpRight className="h-4 w-4 text-emerald-500" />;
    return <ArrowDownRight className="h-4 w-4 text-red-500" />;
};

// --- Main Component ---
export function ExecutiveSummaryTab({
    loading,
    historicalComparisons,
    weeklyVelocity, // Value could be null or undefined initially
    delayedActivitiesCount,
    materialRiskCount,
    progressTrends
}: ExecutiveSummaryTabProps) {

    // Safely access potentially null values
    console.log('Props received by ExecutiveSummaryTab:', { loading, historicalComparisons, weeklyVelocity, delayedActivitiesCount, materialRiskCount, progressTrends }); // <-- ضيف السطر ده
    const latestProgress = historicalComparisons?.latestOverallAvgProgress ?? null;
    const progressChange = historicalComparisons?.overallProgressChange ?? null;
    const latestManpower = historicalComparisons?.latestMetrics?.totalManpower ?? null;
    const manpowerChange = historicalComparisons?.manpowerChange ?? null;
    const comparisonDate = historicalComparisons?.previousTimestamp
        ? new Date(historicalComparisons.previousTimestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : 'previous';
    const overallTrendData = progressTrends?.overall ?? [];

    return (
        <div className="space-y-4">
            {/* Row 1: Key Metrics */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                {/* Overall Progress Card */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
                        <Icons.target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {loading ? <Icons.spinner className="h-6 w-6 animate-spin" /> : (<>
                            <div className="text-2xl font-bold">{latestProgress !== null ? `${latestProgress.toFixed(1)}%` : 'N/A'}</div>
                            <p className={cn("text-xs text-muted-foreground", progressChange === null ? "" : progressChange > 0 ? "text-emerald-600" : "text-red-600")}>
                                {progressChange !== null ? `${progressChange > 0 ? '+' : ''}${progressChange.toFixed(1)}%` : ''}
                                {progressChange !== null ? ` vs ${comparisonDate}`: 'No comparison'}
                            </p>
                        </>)}
                    </CardContent>
                </Card>
                {/* Avg. Daily Manpower Card */}
                <Card>
                     <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg. Daily Manpower</CardTitle>
                        <Icons.users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                     <CardContent>
                        {loading ? <Icons.spinner className="h-6 w-6 animate-spin" /> : (<>
                             <div className="text-2xl font-bold">{latestManpower !== null ? latestManpower.toFixed(0) : 'N/A'}</div>
                             <p className={cn("text-xs text-muted-foreground", manpowerChange === null ? "" : manpowerChange > 0 ? "text-emerald-600" : "text-red-600")}>
                                {manpowerChange !== null ? `${manpowerChange > 0 ? '+' : ''}${manpowerChange.toFixed(0)}` : ''}
                                {manpowerChange !== null ? ` vs ${comparisonDate}` : 'No comparison'}
                             </p>
                         </>)}
                     </CardContent>
                 </Card>
                 {/* Weekly Velocity Card */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Weekly Velocity</CardTitle>
                        <Icons.trendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {loading ? <Icons.spinner className="h-6 w-6 animate-spin" /> : (
                            <>
                                {/* --- MODIFIED: Check if weeklyVelocity is a number --- */}
                                <div className="text-2xl font-bold">
                                    {typeof weeklyVelocity === 'number'
                                      ? `${weeklyVelocity > 0 ? '+' : ''}${weeklyVelocity.toFixed(1)}%`
                                      : 'N/A'}
                                </div>
                                {/* --- END MODIFIED --- */}
                                <p className="text-xs text-muted-foreground">Avg. weekly progress change</p>
                            </>
                        )}
                    </CardContent>
                </Card>
                {/* Delayed Activities Card */}
                <Card>
                     <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                         <CardTitle className="text-sm font-medium">Delayed Activities</CardTitle>
                          <Icons.alertCircle className={cn("h-4 w-4 text-muted-foreground", (delayedActivitiesCount ?? 0) > 0 && "text-orange-500")} />
                     </CardHeader>
                     <CardContent>
                         {loading ? <Icons.spinner className="h-6 w-6 animate-spin" /> : (<>
                              <div className={cn("text-2xl font-bold", (delayedActivitiesCount ?? 0) > 0 && "text-orange-600")}>{delayedActivitiesCount !== null ? delayedActivitiesCount : 'N/A'}</div>
                              <p className="text-xs text-muted-foreground">Activities past due date</p>
                          </>)}
                     </CardContent>
                 </Card>
                 {/* Material Risk Card */}
                <Card>
                     <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                         <CardTitle className="text-sm font-medium">Material Risk</CardTitle>
                          <Icons.packageX className={cn("h-4 w-4 text-muted-foreground", (materialRiskCount ?? 0) > 0 && "text-destructive")} />
                     </CardHeader>
                     <CardContent>
                         {loading ? <Icons.spinner className="h-6 w-6 animate-spin" /> : (<>
                              <div className={cn("text-2xl font-bold", (materialRiskCount ?? 0) > 0 && "text-destructive")}>{materialRiskCount !== null ? materialRiskCount : 'N/A'}</div>
                              <p className="text-xs text-muted-foreground">Items overdue for delivery</p>
                          </>)}
                     </CardContent>
                 </Card>
            </div>

            {/* Row 2: Progress Chart & Overall System Progress */}
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
                {/* Progress Trend Chart */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Overall Progress Trend</CardTitle>
                         <CardDescription>Average progress percentage over the last period.</CardDescription>
                     </CardHeader>
                    <CardContent className="pl-2 pr-6">
                        {loading ? <div className="h-[200px] flex justify-center items-center"><Icons.spinner className="h-8 w-8 animate-spin"/></div> :
                         (!overallTrendData || overallTrendData.length === 0) ? <div className="h-[200px] flex justify-center items-center text-muted-foreground">No trend data available.</div> : (
                             <ResponsiveContainer width="100%" height={200}>
                                 <AreaChart data={overallTrendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                      <defs> <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1"> <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.6}/> <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/> </linearGradient> </defs>
                                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={30}/>
                                      <RechartsTooltip content={<TrendTooltip />} cursor={{stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '3 3'}}/>
                                      <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorProgress)" strokeWidth={2} connectNulls={false} />
                                 </AreaChart>
                             </ResponsiveContainer>
                         )}
                     </CardContent>
                 </Card>
                 {/* System Progress Bars */}
                <Card className="flex flex-col">
                    <CardHeader className="pb-4">
                         <CardTitle>Current System Progress</CardTitle>
                         <CardDescription>Latest average progress per system.</CardDescription>
                    </CardHeader>
                     <CardContent className="flex-grow flex flex-col justify-around space-y-3 pt-0">
                         {/* HVAC */}
                         <div className="flex items-center justify-between space-x-3">
                             <span className="text-sm font-medium flex-1 truncate">HVAC</span>
                              {loading ? <Icons.spinner className="h-4 w-4 animate-spin" /> : <span className="text-sm font-semibold w-12 text-right">{historicalComparisons?.latestMetrics?.avgHvac !== null ? `${historicalComparisons?.latestMetrics?.avgHvac.toFixed(1)}%` : 'N/A'}</span>}
                              <Progress value={historicalComparisons?.latestMetrics?.avgHvac ?? 0} aria-label="HVAC progress" className="h-2 w-[100px]" />
                         </div>
                         {/* Firefighting */}
                         <div className="flex items-center justify-between space-x-3">
                             <span className="text-sm font-medium flex-1 truncate">Firefighting</span>
                              {loading ? <Icons.spinner className="h-4 w-4 animate-spin" /> : <span className="text-sm font-semibold w-12 text-right">{historicalComparisons?.latestMetrics?.avgFf !== null ? `${historicalComparisons?.latestMetrics?.avgFf.toFixed(1)}%` : 'N/A'}</span>}
                              <Progress value={historicalComparisons?.latestMetrics?.avgFf ?? 0} aria-label="Firefighting progress" className="h-2 w-[100px]" />
                         </div>
                         {/* Fire Alarm */}
                          <div className="flex items-center justify-between space-x-3">
                              <span className="text-sm font-medium flex-1 truncate">Fire Alarm</span>
                              {loading ? <Icons.spinner className="h-4 w-4 animate-spin" /> : <span className="text-sm font-semibold w-12 text-right">{historicalComparisons?.latestMetrics?.avgFa !== null ? `${historicalComparisons?.latestMetrics?.avgFa.toFixed(1)}%` : 'N/A'}</span>}
                              <Progress value={historicalComparisons?.latestMetrics?.avgFa ?? 0} aria-label="Fire Alarm progress" className="h-2 w-[100px]" />
                         </div>
                     </CardContent>
                </Card>
            </div>
        </div>
    );
}
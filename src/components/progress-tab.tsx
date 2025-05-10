// src/components/progress-tab.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DonutChart } from "@/components/donut-chart";
import { ProgressChart } from "@/components/progress-chart";
import { Icons } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
    ComparisonResults,
    ProgressTrends,
    BuildingProgressData
} from '@/types';

// Props interface (cleaned up)
interface ProgressTabProps {
    loading: boolean;
    error: string | null;
    filters: {
        projectFilter: string;
        buildingFilter: string;
        projects: string[]; // نتوقع دي تكون دايماً array
        buildings: string[]; // نتوقع دي تكون دايماً array
    };
    onProjectFilterChange: (value: string) => void;
    onBuildingFilterChange: (value: string) => void;
    currentAverages: {
        overallAvg: number | null;
        hvacAvg: number | null;
        ffAvg: number | null;
        faAvg: number | null;
    } | null;
    historicalComparisons: ComparisonResults | null;
    progressTrends: ProgressTrends | null; // ممكن يكون null
    aggregatedBuildingProgress?: BuildingProgressData[]; // ممكن يكون undefined أو array
}

// Helper function (Unchanged)
const formatComparisonText = (change: number | null, comparisonDate: number | null): string | null => {
    if (change === null || comparisonDate === null) return "No comparison";
    const sign = change > 0 ? "+" : "";
    const dateStr = new Date(comparisonDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${sign}${change.toFixed(1)}% vs ${dateStr}`;
};


export function ProgressTab({
    loading,
    error,
    filters,
    onProjectFilterChange,
    onBuildingFilterChange,
    currentAverages,
    historicalComparisons,
    progressTrends, // مستخدمة في Trend Chart (اللي متشال حالياً)
    aggregatedBuildingProgress
}: ProgressTabProps) {

    const comparisonDate = historicalComparisons?.previousTimestamp ?? null;
    const overallChangeText = formatComparisonText(historicalComparisons?.overallProgressChange ?? null, comparisonDate);
    const hvacChangeText = formatComparisonText(historicalComparisons?.filteredHvacProgressChange ?? null, comparisonDate);
    const ffChangeText = formatComparisonText(historicalComparisons?.filteredFfProgressChange ?? null, comparisonDate);
    const faChangeText = formatComparisonText(historicalComparisons?.filteredFaProgressChange ?? null, comparisonDate);

    // --- بداية التعديل ---
    // هنتأكد إن filters موجودة وإن projects و buildings جواها عبارة عن array
    // لو مش موجودين أو مش array، هنستخدم array فاضي عشان الـ .map متضربش error
    const projectOptions = (filters && Array.isArray(filters.projects)) ? filters.projects : [];
    const buildingOptions = (filters && Array.isArray(filters.buildings)) ? filters.buildings : [];
    // --- نهاية التعديل ---

    if (error && !loading) {
        return (
            <Alert variant="destructive">
                <Icons.alertTriangle className="h-4 w-4" />
                <AlertTitle>Error Loading Progress Data</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-6">
            {/* Section 1: Top Summary Cards/Donuts */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Overall Progress (Plan)</CardTitle>
                        <Icons.target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <DonutChart value={currentAverages?.overallAvg ?? null} loading={loading} size={100} />
                        <p className="text-xs text-muted-foreground text-center mt-1">{overallChangeText ?? (loading ? "Loading..." : "No comparison")}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Overall HVAC (Plan)</CardTitle>
                        <Icons.hvac className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <DonutChart value={currentAverages?.hvacAvg ?? null} loading={loading} size={100}/>
                        <p className="text-xs text-muted-foreground text-center mt-1">{hvacChangeText ?? (loading ? "Loading..." : "No comparison")}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Overall Firefighting (Plan)</CardTitle>
                        <Icons.flame className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <DonutChart value={currentAverages?.ffAvg ?? null} loading={loading} size={100}/>
                        <p className="text-xs text-muted-foreground text-center mt-1">{ffChangeText ?? (loading ? "Loading..." : "No comparison")}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Overall Fire Alarm (Plan)</CardTitle>
                        <Icons.siren className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <DonutChart value={currentAverages?.faAvg ?? null} loading={loading} size={100}/>
                        <p className="text-xs text-muted-foreground text-center mt-1">{faChangeText ?? (loading ? "Loading..." : "No comparison")}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Section 2: Filter Controls */}
             <div className="flex items-center justify-end gap-2">
                <Select value={filters?.projectFilter} onValueChange={onProjectFilterChange}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select Project" />
                    </SelectTrigger>
                    <SelectContent>
                        {/* --- بداية التعديل --- */}
                        {projectOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        {/* --- نهاية التعديل --- */}
                    </SelectContent>
                </Select>
                <Select value={filters?.buildingFilter} onValueChange={onBuildingFilterChange}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select Building" />
                    </SelectTrigger>
                    <SelectContent>
                        {/* --- بداية التعديل --- */}
                        {buildingOptions.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                        {/* --- نهاية التعديل --- */}
                    </SelectContent>
                </Select>
             </div>

            {/* Section 3: Trend Chart (كان متشال/ معمول له كومنت) */}
            {/* {progressTrends && (progressTrends.overall.length > 0 || progressTrends.hvac.length > 0 || progressTrends.ff.length > 0 || progressTrends.fa.length > 0) && !loading && (
                <Card>
                    <CardHeader>
                        <CardTitle>Progress Trends</CardTitle>
                        <CardDescription>Overall and system-specific progress over the last 30 data points.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tickFormatter={(str) => str} style={{ fontSize: '0.75rem' }} />
                                <YAxis domain={[0, 100]} tickFormatter={(val) => `${val}%`} style={{ fontSize: '0.75rem' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
                                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                                    labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                                />
                                <Legend wrapperStyle={{fontSize: '0.8rem'}} />
                                {progressTrends.overall.length > 0 && <Line type="monotone" dataKey="value" data={progressTrends.overall} name="Overall" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />}
                                {progressTrends.hvac.length > 0 && <Line type="monotone" dataKey="value" data={progressTrends.hvac} name="HVAC" stroke="#82ca9d" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />}
                                {progressTrends.ff.length > 0 && <Line type="monotone" dataKey="value" data={progressTrends.ff} name="Firefighting" stroke="#8884d8" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />}
                                {progressTrends.fa.length > 0 && <Line type="monotone" dataKey="value" data={progressTrends.fa} name="Fire Alarm" stroke="#ffc658" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />}
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}
            */}

            {/* Section 4: Detailed Table (كان متشال) */}

            {/* Optional Section: Building Progress Chart */}
            {/* --- بداية التعديل --- */}
            {/* هنتأكد إن aggregatedBuildingProgress موجود وعبارة عن array قبل ما نستخدمه */}
            {Array.isArray(aggregatedBuildingProgress) && aggregatedBuildingProgress.length > 0 && (
            // --- نهاية التعديل --- */}
                <Card>
                    <CardHeader>
                        <CardTitle>Progress by Building</CardTitle>
                        <CardDescription>Latest average progress per system for each building.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ProgressChart data={aggregatedBuildingProgress} />
                    </CardContent>
                </Card>
            )}

        </div>
    );
}
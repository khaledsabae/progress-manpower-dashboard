// src/components/RiskManagementTab.tsx
"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useRiskData } from '@/hooks/useRiskData'; // Adjust path if needed
import { type RiskRegisterItem } from '@/services/google-sheets'; // Import type from source

import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption,
} from "@/components/ui/table";
import {
    Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // Needed for Date Picker
import { Calendar } from "@/components/ui/calendar"; // Needed for Date Picker
import { ArrowUpDown, FilterIcon, RefreshCw, ExternalLink, AlertTriangle, CheckCircle2, ListChecks, Info, CalendarDays, Loader2, Save, Check } from "lucide-react"; // Added Save, Check
import { Badge } from "@/components/ui/badge";
import { format, isValid, set } from 'date-fns';
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from '@/components/ui/label'; // Needed for Form
import { cn } from '@/lib/utils'; // Needed for Calendar conditional styling

// --- Type Definitions ---
type SortableRiskColumns = keyof Pick<RiskRegisterItem, 'riskId' | 'systemFocus' | 'riskLevelScore' | 'status' | 'dueDateTimestamp' | 'actionOwner' | 'lastUpdatedTimestamp'>;

interface AnalyzedRiskData {
    riskDescription?: string;
    systemFocus?: string;
    likelyCauses?: string;
    potentialImpactConsequence?: string;
    likelihood?: string;
    severityImpactLevel?: string;
    riskLevelScore?: string;
    riskCategory?: string;
    mitigationStrategiesActions?: string;
}

// --- Helper Functions ---
const getRiskLevelBadgeVariant = (level: string | null): "default" | "destructive" | "secondary" | "outline" => {
    const lowerLevel = level?.toLowerCase().trim();
    if (lowerLevel === 'critical') return 'destructive';
    if (lowerLevel === 'high') return 'destructive';
    if (lowerLevel === 'medium') return 'secondary';
    if (lowerLevel === 'low') return 'default';
    return 'outline';
};

const formatDateString = (dateTimestamp: number | null, dateString: string | null): string => {
    if (dateTimestamp && isValid(new Date(dateTimestamp))) {
        return format(new Date(dateTimestamp), 'dd-MMM-yyyy');
    }
    if (dateString && dateString.trim() !== '' && dateString.trim().toLowerCase() !== 'n/a' && dateString.trim().toLowerCase() !== 'tbd') {
        return dateString;
    }
    return 'N/A';
};

export default function RiskManagementTab() {
    const { data, loading, error, refreshData } = useRiskData();

    // --- States for AI Input & Confirmation Form ---
    const [naturalLanguageInput, setNaturalLanguageInput] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [analyzedData, setAnalyzedData] = useState<AnalyzedRiskData | null>(null);
    const [editedData, setEditedData] = useState<Partial<RiskRegisterItem>>({});
    const [isConfirming, setIsConfirming] = useState(false);
    const [confirmationResult, setConfirmationResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // --- States for Table Display ---
    const [sortConfig, setSortConfig] = useState<{ key: SortableRiskColumns | null; direction: 'ascending' | 'descending' }>({ key: 'riskLevelScore', direction: 'descending' });
    const [globalSearchTerm, setGlobalSearchTerm] = useState('');
    const [systemFilter, setSystemFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [riskLevelFilter, setRiskLevelFilter] = useState<string>('all');

    // --- Memos for derived data ---
    const uniqueSystems = useMemo(() => {
        if (!data) return ['all'];
        const systems = new Set(data.map(item => item.systemFocus).filter((sys): sys is string => typeof sys === 'string' && sys.trim() !== ''));
        return ['all', ...Array.from(systems).sort()];
      }, [data]);

      const uniqueStatuses = useMemo(() => {
        if (!data) return ['all'];
        const statuses = new Set(data.map(item => item.status).filter((stat): stat is string => typeof stat === 'string' && stat.trim() !== ''));
        // Define a desired order
        const desiredOrder = ['Needs Review', 'Open', 'In Progress', 'Deferred', 'Closed'];
        const sortedStatuses = Array.from(statuses).sort((a, b) => {
            const indexA = desiredOrder.indexOf(a);
            const indexB = desiredOrder.indexOf(b);
            if (indexA === -1 && indexB === -1) return a.localeCompare(b); // Sort unknown statuses alphabetically
            if (indexA === -1) return 1; // Put unknown statuses at the end
            if (indexB === -1) return -1; // Put unknown statuses at the end
            return indexA - indexB;
        });
        return ['all', ...sortedStatuses];
      }, [data]);

      const uniqueRiskLevels = useMemo(() => {
        if (!data) return ['all'];
        const levels = new Set(data.map(item => item.riskLevelScore).filter((lvl): lvl is string => typeof lvl === 'string' && lvl.trim() !== ''));
        const order: { [key: string]: number } = { 'critical': 1, 'high': 2, 'medium': 3, 'low': 4 };
        return ['all', ...Array.from(levels).sort((a, b) => (order[a.toLowerCase()] || 99) - (order[b.toLowerCase()] || 99))];
      }, [data]);

      const filteredData = useMemo(() => {
        if (!data) return [];
        return data.filter((item: RiskRegisterItem) => {
          const matchesGlobalSearch = globalSearchTerm === '' || Object.values(item).some(value => String(value).toLowerCase().includes(globalSearchTerm.toLowerCase()));
          const matchesSystem = systemFilter === 'all' || item.systemFocus === systemFilter;
          const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
          const matchesRiskLevel = riskLevelFilter === 'all' || item.riskLevelScore === riskLevelFilter;
          return matchesGlobalSearch && matchesSystem && matchesStatus && matchesRiskLevel;
        });
      }, [data, globalSearchTerm, systemFilter, statusFilter, riskLevelFilter]);

      const sortedData = useMemo(() => {
        let sortableItems = [...filteredData];
        if (sortConfig.key !== null) {
          sortableItems.sort((a: RiskRegisterItem, b: RiskRegisterItem) => {
            const aValue = a[sortConfig.key!];
            const bValue = b[sortConfig.key!];
            if (aValue === null || aValue === undefined) return sortConfig.direction === 'ascending' ? 1 : -1;
            if (bValue === null || bValue === undefined) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (sortConfig.key === 'riskLevelScore') {
                const order: { [key: string]: number } = { 'critical': 1, 'high': 2, 'medium': 3, 'low': 4 };
                const aOrder = order[String(aValue).toLowerCase()] || 99; const bOrder = order[String(bValue).toLowerCase()] || 99;
                return sortConfig.direction === 'ascending' ? aOrder - bOrder : bOrder - aOrder;
            }
            if (typeof aValue === 'number' && typeof bValue === 'number') {
              return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
            }
             return sortConfig.direction === 'ascending' ? String(aValue).localeCompare(String(bValue)) : String(bValue).localeCompare(String(aValue));
          });
        }
        return sortableItems;
      }, [filteredData, sortConfig]);

      const kpis = useMemo(() => {
        if (!data || data.length === 0) {
            return { totalRisks: 0, criticalHighRisks: 0, openInProgressActions: 0, overdueActions: 0 };
        }
        const totalRisks = data.length;
        const criticalHighRisks = data.filter(risk => risk.riskLevelScore?.toLowerCase() === 'high' || risk.riskLevelScore?.toLowerCase() === 'critical').length;
        const openInProgressActions = data.filter(risk => risk.status?.toLowerCase() === 'open' || risk.status?.toLowerCase() === 'in progress').length;
        const todayStart = new Date().setHours(0,0,0,0);
        const overdueActions = data.filter(risk => ((risk.status?.toLowerCase() === 'open' || risk.status?.toLowerCase() === 'in progress') && risk.dueDateTimestamp && risk.dueDateTimestamp < todayStart)).length;
        return { totalRisks, criticalHighRisks, openInProgressActions, overdueActions };
      }, [data]);

    // --- Effect to initialize editedData when analyzedData changes ---
    useEffect(() => {
        if (analyzedData) {
            setEditedData({
                riskDescription: analyzedData.riskDescription || '',
                systemFocus: analyzedData.systemFocus || '',
                likelyCauses: analyzedData.likelyCauses || '',
                potentialImpactConsequence: analyzedData.potentialImpactConsequence || '',
                likelihood: analyzedData.likelihood || 'Medium',
                severityImpactLevel: analyzedData.severityImpactLevel || 'Medium',
                riskLevelScore: analyzedData.riskLevelScore || 'Medium',
                riskCategory: analyzedData.riskCategory || 'TBD',
                mitigationStrategiesActions: analyzedData.mitigationStrategiesActions || '',
                actionOwner: 'Eng. Khaled Sabae',
                dueDateString: null,
                dueDateTimestamp: null,
                status: 'Open',
                residualRiskLevel: analyzedData.riskLevelScore || 'Medium',
            });
        } else {
            setEditedData({});
        }
    }, [analyzedData]);

    // --- Handlers ---
     const requestSort = useCallback((key: SortableRiskColumns) => {
         let newDirection: 'ascending' | 'descending' = 'ascending';
         if (sortConfig.key === key && sortConfig.direction === 'ascending') {
           newDirection = 'descending';
         }
         setSortConfig({ key, direction: newDirection });
       }, [sortConfig]);

       const getSortIndicator = (key: SortableRiskColumns) => {
         if (sortConfig.key === key) {
           return sortConfig.direction === 'ascending' ? <ArrowUpDown className="ml-2 h-3 w-3 inline-block opacity-50 group-hover:opacity-100" /> : <ArrowUpDown className="ml-2 h-3 w-3 inline-block opacity-50 group-hover:opacity-100 transform rotate-180" />;
         }
         return <ArrowUpDown className="ml-2 h-3 w-3 inline-block opacity-20 group-hover:opacity-100" />;
       };

    const handleAnalyzeRisk = useCallback(async () => {
        if (!naturalLanguageInput.trim()) {
            setAnalysisError('Please enter a risk description.');
            return;
        }
        setIsAnalyzing(true);
        setAnalysisError(null);
        setAnalyzedData(null);
        setEditedData({});
        setConfirmationResult(null);
        try {
            const response = await fetch('/api/risks/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: naturalLanguageInput }),
            });
            const result = await response.json();
            if (!response.ok) { throw new Error(result.message || 'Failed to analyze risk.'); }
            setAnalyzedData(result as AnalyzedRiskData);
        } catch (err: any) {
            console.error("Analysis API Error:", err);
            setAnalysisError(err.message || 'An unexpected error occurred during analysis.');
        } finally {
            setIsAnalyzing(false);
        }
    }, [naturalLanguageInput]);

    const handleEditChange = (field: keyof Partial<RiskRegisterItem>, value: any) => {
        setEditedData(prev => ({ ...prev, [field]: value }));
    };

    const handleDateSelect = (date: Date | undefined) => {
        if (date) {
            const dateString = format(date, 'yyyy-MM-dd');
            const timestamp = date.getTime();
            setEditedData(prev => ({ ...prev, dueDateString: dateString, dueDateTimestamp: timestamp }));
        } else {
            setEditedData(prev => ({ ...prev, dueDateString: null, dueDateTimestamp: null }));
        }
    };

    const handleConfirmAndAddToSheet = useCallback(async () => {
        if (!editedData || !editedData.riskDescription) {
            setConfirmationResult({ type: 'error', message: 'Cannot add risk with empty description.' });
            return;
        }
        setIsConfirming(true);
        setConfirmationResult(null);
        const dataToSend: Omit<Partial<RiskRegisterItem>, 'riskId' | 'lastUpdatedString' | 'lastUpdatedTimestamp'> = { ...editedData };
        // Remove timestamp before sending if backend doesn't need it
        delete dataToSend.dueDateTimestamp;

        try {
            const response = await fetch('/api/risks/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSend),
            });
            const result = await response.json();
            if (!response.ok) { throw new Error(result.message || 'Failed to add risk to the sheet.'); }
            setConfirmationResult({ type: 'success', message: `Risk (ID: ${result.riskId}) added successfully! Refreshing data...` });
            setNaturalLanguageInput('');
            setAnalyzedData(null);
            setEditedData({});
            setTimeout(() => { refreshData(); setConfirmationResult(null); }, 2500);
        } catch (err: any) {
            console.error("Add to Sheet Error:", err);
            setConfirmationResult({ type: 'error', message: err.message || 'An unexpected error occurred while adding the risk.' });
        } finally {
            setIsConfirming(false);
        }
    }, [editedData, refreshData]);

    // --- Render Logic ---
    // Skeleton Loader
    if (loading && (!data || data.length === 0)) {
        return (
            <div className="space-y-6 p-1 md:p-4">
                {/* AI Input Skeleton */}
                <Card>
                    <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
                    <CardContent><Skeleton className="h-20 w-full" /><Skeleton className="h-9 w-32 mt-4" /></CardContent>
                </Card>
                {/* KPIs Skeleton */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[...Array(4)].map((_, i) => ( <Card key={i}> <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <Skeleton className="h-4 w-3/5" /> </CardHeader> <CardContent> <Skeleton className="h-8 w-1/3" /> <Skeleton className="h-3 w-4/5 mt-1" /> </CardContent> </Card> ))}
                </div>
                {/* Filter Skeleton */}
                <Card><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</CardContent></Card>
                {/* Table Skeleton */}
                <Card> <CardHeader> <Skeleton className="h-6 w-1/3" /> </CardHeader> <CardContent className="overflow-x-auto"> <div className="space-y-3"> {[...Array(5)].map((_, i) => ( <div key={i} className="grid grid-cols-9 gap-2"> {[...Array(9)].map((_, j) => ( <Skeleton key={j} className="h-8 w-full" /> ))} </div> ))} </div> </CardContent> </Card>
            </div>
        );
    }

    // Error State for initial data load
    if (error && !data) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center min-h-[300px]">
                <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
                <h2 className="text-2xl font-semibold text-destructive mb-2">Operation Failed!</h2>
                <p className="text-muted-foreground mb-4"> Could not fetch initial risk data. Please try refreshing or check the console. </p>
                <p className="text-sm text-red-400 bg-red-100 dark:bg-red-900/30 p-3 rounded-md max-w-md break-words"> {error.message} </p>
                <Button onClick={refreshData} className="mt-6"> <RefreshCw className="mr-2 h-4 w-4" /> Try Again </Button>
            </div>
        );
    }

    // Main component render
    return (
        <div className="space-y-6 p-1 md:p-4">
            {/* --- AI Risk Input Card --- */}
            <Card>
                <CardHeader>
                <CardTitle>Add New Risk via AI Analysis</CardTitle>
                <CardDescription>Describe a potential risk, and let the AI assist in structuring it.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                <Textarea
                    placeholder="e.g., 'Sandstorms might delay crane operations...' or 'تسرب مياه التكييف قد يسبب مشكلة في غرفة الكهرباء...'"
                    value={naturalLanguageInput}
                    onChange={(e) => setNaturalLanguageInput(e.target.value)}
                    rows={3}
                    disabled={isAnalyzing || !!analyzedData}
                    className="border-primary/30 focus:border-primary"
                />
                <Button onClick={handleAnalyzeRisk} disabled={isAnalyzing || !naturalLanguageInput.trim() || !!analyzedData}>
                    {isAnalyzing ? ( <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing... </> ) : ( 'Analyze Risk Description' )}
                </Button>
                {analysisError && (
                    <Alert variant="destructive" className="mt-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Analysis Error</AlertTitle>
                        <AlertDescription>{analysisError}</AlertDescription>
                    </Alert>
                )}
                </CardContent>
            </Card>

            {/* --- NEW: Confirmation/Edit Form Card --- */}
            {analyzedData && (
                <Card className="border-primary animate-fadeIn">
                    <CardHeader>
                        <CardTitle>Review and Confirm Risk Details</CardTitle>
                        <CardDescription>AI analysis results are below. Review, edit if needed, set Due Date/Status, and confirm to add.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5 md:col-span-2"> {/* Make Description Span 2 Cols */}
                                <Label htmlFor="edit-description">Risk Description</Label>
                                <Textarea id="edit-description" value={editedData.riskDescription || ''} onChange={(e) => handleEditChange('riskDescription', e.target.value)} rows={2} />
                            </div>
                            <div className="space-y-1.5 md:col-span-2"> {/* Make Mitigation Span 2 Cols */}
                                <Label htmlFor="edit-mitigation">Mitigation Actions</Label>
                                <Textarea id="edit-mitigation" value={editedData.mitigationStrategiesActions || ''} onChange={(e) => handleEditChange('mitigationStrategiesActions', e.target.value)} rows={2} />
                            </div>
                             <div className="space-y-1.5">
                                <Label htmlFor="edit-system">System Focus</Label>
                                <Input id="edit-system" value={editedData.systemFocus || ''} onChange={(e) => handleEditChange('systemFocus', e.target.value)} />
                            </div>
                             <div className="space-y-1.5">
                                <Label htmlFor="edit-category">Risk Category</Label>
                                <Input id="edit-category" value={editedData.riskCategory || ''} onChange={(e) => handleEditChange('riskCategory', e.target.value)} />
                            </div>
                             <div className="space-y-1.5">
                                <Label htmlFor="edit-causes">Likely Causes</Label>
                                <Input id="edit-causes" value={editedData.likelyCauses || ''} onChange={(e) => handleEditChange('likelyCauses', e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-impact">Potential Impact</Label>
                                <Input id="edit-impact" value={editedData.potentialImpactConsequence || ''} onChange={(e) => handleEditChange('potentialImpactConsequence', e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-likelihood">Likelihood</Label>
                                <Select value={editedData.likelihood || 'Medium'} onValueChange={(value) => handleEditChange('likelihood', value)}>
                                    <SelectTrigger id="edit-likelihood"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="Low">Low</SelectItem><SelectItem value="Medium">Medium</SelectItem><SelectItem value="High">High</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-severity">Severity / Impact</Label>
                                <Select value={editedData.severityImpactLevel || 'Medium'} onValueChange={(value) => handleEditChange('severityImpactLevel', value)}>
                                     <SelectTrigger id="edit-severity"><SelectValue /></SelectTrigger>
                                     <SelectContent><SelectItem value="Low">Low</SelectItem><SelectItem value="Medium">Medium</SelectItem><SelectItem value="High">High</SelectItem><SelectItem value="Critical">Critical</SelectItem></SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-1.5">
                                <Label htmlFor="edit-risklevel">Risk Level / Score</Label>
                                <Select value={editedData.riskLevelScore || 'Medium'} onValueChange={(value) => handleEditChange('riskLevelScore', value)}>
                                     <SelectTrigger id="edit-risklevel"><SelectValue /></SelectTrigger>
                                     <SelectContent><SelectItem value="Low">Low</SelectItem><SelectItem value="Medium">Medium</SelectItem><SelectItem value="High">High</SelectItem><SelectItem value="Critical">Critical</SelectItem></SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-1.5">
                                <Label htmlFor="edit-residual">Residual Risk Level</Label>
                                <Select value={editedData.residualRiskLevel || editedData.riskLevelScore || 'Medium'} onValueChange={(value) => handleEditChange('residualRiskLevel', value)}>
                                     <SelectTrigger id="edit-residual"><SelectValue /></SelectTrigger>
                                     <SelectContent><SelectItem value="Low">Low</SelectItem><SelectItem value="Medium">Medium</SelectItem><SelectItem value="High">High</SelectItem><SelectItem value="Critical">Critical</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-owner">Action Owner</Label>
                                <Input id="edit-owner" value={editedData.actionOwner || ''} onChange={(e) => handleEditChange('actionOwner', e.target.value)} placeholder="e.g., Eng. Khaled Sabae"/>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-status">Status</Label>
                                <Select value={editedData.status || 'Open'} onValueChange={(value) => handleEditChange('status', value)}>
                                    <SelectTrigger id="edit-status"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Needs Review">Needs Review</SelectItem>
                                        <SelectItem value="Open">Open</SelectItem>
                                        <SelectItem value="In Progress">In Progress</SelectItem>
                                        <SelectItem value="Closed">Closed</SelectItem>
                                        <SelectItem value="Deferred">Deferred</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5 md:col-span-2"> {/* Make Date span 2 cols */}
                                <Label htmlFor="edit-duedate">Due Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button id="edit-duedate" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !editedData.dueDateTimestamp && "text-muted-foreground")} >
                                            <CalendarDays className="mr-2 h-4 w-4" />
                                            {editedData.dueDateTimestamp ? format(new Date(editedData.dueDateTimestamp), "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={editedData.dueDateTimestamp ? new Date(editedData.dueDateTimestamp) : undefined} onSelect={handleDateSelect} initialFocus />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                             <Button variant="outline" onClick={() => { setAnalyzedData(null); setEditedData({}); }} disabled={isConfirming}> Cancel </Button>
                             <Button onClick={handleConfirmAndAddToSheet} disabled={isConfirming || !editedData.riskDescription}>
                                {isConfirming ? ( <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirming... </> ) : ( <> <Check className="mr-2 h-4 w-4" /> Confirm & Add to Sheet </>)}
                            </Button>
                        </div>
                        {confirmationResult && (
                            <Alert variant={confirmationResult.type === 'error' ? 'destructive' : 'default'} className="mt-4">
                                <AlertTitle>{confirmationResult.type === 'error' ? 'Error' : 'Success'}</AlertTitle>
                                <AlertDescription>{confirmationResult.message}</AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* --- KPIs Section --- */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card> <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <CardTitle className="text-sm font-medium">Total Risks</CardTitle> <ListChecks className="h-5 w-5 text-muted-foreground" /> </CardHeader> <CardContent> <div className="text-2xl font-bold">{kpis.totalRisks}</div> <p className="text-xs text-muted-foreground">Total number of registered risks</p> </CardContent> </Card>
                <Card className={kpis.criticalHighRisks > 0 ? "border-destructive/70 dark:border-destructive" : ""}> <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <CardTitle className={`text-sm font-medium ${kpis.criticalHighRisks > 0 ? 'text-destructive' : ''}`}>Critical/High Risks</CardTitle> <AlertTriangle className={`h-5 w-5 ${kpis.criticalHighRisks > 0 ? 'text-destructive' : 'text-muted-foreground'}`} /> </CardHeader> <CardContent> <div className={`text-2xl font-bold ${kpis.criticalHighRisks > 0 ? 'text-destructive' : ''}`}>{kpis.criticalHighRisks}</div> <p className="text-xs text-muted-foreground">Risks rated as Critical or High</p> </CardContent> </Card>
                <Card> <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <CardTitle className="text-sm font-medium">Open / In Progress</CardTitle> <RefreshCw className="h-5 w-5 text-blue-500" /> </CardHeader> <CardContent> <div className="text-2xl font-bold">{kpis.openInProgressActions}</div> <p className="text-xs text-muted-foreground">Mitigation actions not yet closed</p> </CardContent> </Card>
                <Card className={kpis.overdueActions > 0 ? "border-orange-500/70 dark:border-orange-500" : ""}> <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <CardTitle className={`text-sm font-medium ${kpis.overdueActions > 0 ? 'text-orange-600 dark:text-orange-500' : ''}`}>Overdue Actions</CardTitle> <CalendarDays className={`h-5 w-5 ${kpis.overdueActions > 0 ? 'text-orange-600 dark:text-orange-500' : 'text-muted-foreground'}`} /> </CardHeader> <CardContent> <div className={`text-2xl font-bold ${kpis.overdueActions > 0 ? 'text-orange-600 dark:text-orange-500' : ''}`}>{kpis.overdueActions}</div> <p className="text-xs text-muted-foreground">Actions past their due date</p> </CardContent> </Card>
            </div>

            {/* --- Filter Section --- */}
            <Card>
                <CardHeader> <div className="flex flex-col sm:flex-row justify-between items-center gap-2"> <CardTitle className="text-lg">Filter Risk Register</CardTitle> <Button onClick={refreshData} variant="outline" size="sm" className="w-full sm:w-auto" disabled={loading}> <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Data </Button> </div> </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <Input placeholder="Search all columns..." value={globalSearchTerm} onChange={(e) => setGlobalSearchTerm(e.target.value)} className="w-full" />
                    <Select value={systemFilter} onValueChange={setSystemFilter}> <SelectTrigger className="w-full"> <SelectValue placeholder="Filter by System..." /> </SelectTrigger> <SelectContent> {uniqueSystems.map(sys => <SelectItem key={sys} value={sys}>{sys === 'all' ? 'All Systems' : sys}</SelectItem>)} </SelectContent> </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}> <SelectTrigger className="w-full"> <SelectValue placeholder="Filter by Status..." /> </SelectTrigger> <SelectContent> {uniqueStatuses.map(stat => <SelectItem key={stat} value={stat}>{stat === 'all' ? 'All Statuses' : stat}</SelectItem>)} </SelectContent> </Select>
                    <Select value={riskLevelFilter} onValueChange={setRiskLevelFilter}> <SelectTrigger className="w-full"> <SelectValue placeholder="Filter by Risk Level..." /> </SelectTrigger> <SelectContent> {uniqueRiskLevels.map(level => <SelectItem key={level} value={level}>{level === 'all' ? 'All Levels' : level}</SelectItem>)} </SelectContent> </Select>
                </CardContent>
            </Card>

            {/* --- No Data Matching Filters Message --- */}
            {data && data.length > 0 && sortedData.length === 0 && (
                <Card className="text-center p-6">
                    <CardContent>
                        <Info className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-muted-foreground">No risks match the current filter criteria.</p>
                    </CardContent>
                </Card>
            )}

            {/* --- Risk Register Table --- */}
            {sortedData.length > 0 && (
                <Card>
                    <CardHeader> <CardTitle>Risk Register</CardTitle> <CardDescription> Displaying {filteredData.length} of {data?.length || 0} total risks. </CardDescription> </CardHeader>
                    <CardContent className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {[ { key: 'riskId', label: 'ID' }, { key: 'riskDescription', label: 'Description' }, { key: 'systemFocus', label: 'System' }, { key: 'riskLevelScore', label: 'Risk Level' }, { key: 'mitigationStrategiesActions', label: 'Mitigation Actions' }, { key: 'actionOwner', label: 'Owner' }, { key: 'dueDateTimestamp', label: 'Due Date' }, { key: 'status', label: 'Status' }, { key: 'lastUpdatedTimestamp', label: 'Last Updated' }, ].map(col => ( <TableHead key={col.key} onClick={() => requestSort(col.key as SortableRiskColumns)} className="cursor-pointer group whitespace-nowrap hover:bg-muted/50 transition-colors px-3 py-2 text-xs sm:text-sm"> {col.label} {getSortIndicator(col.key as SortableRiskColumns)} </TableHead> ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedData.map((risk: RiskRegisterItem, index: number) => (
                                    <TableRow key={risk.riskId || `risk-${index}`} className="hover:bg-muted/30 text-xs sm:text-sm">
                                        <TableCell className="font-medium px-3 py-2 whitespace-nowrap">{risk.riskId || 'N/A'}</TableCell>
                                        <TableCell className="max-w-[200px] sm:max-w-xs truncate px-3 py-2" title={risk.riskDescription || ''}>{risk.riskDescription || 'N/A'}</TableCell>
                                        <TableCell className="px-3 py-2 whitespace-nowrap">{risk.systemFocus || 'N/A'}</TableCell>
                                        <TableCell className="px-3 py-2 whitespace-nowrap"> <Badge variant={getRiskLevelBadgeVariant(risk.riskLevelScore)} className="text-xs px-1.5 py-0.5 sm:px-2 sm:py-1"> {risk.riskLevelScore || 'N/A'} </Badge> </TableCell>
                                        <TableCell className="max-w-[200px] sm:max-w-sm truncate px-3 py-2" title={risk.mitigationStrategiesActions || ''}>{risk.mitigationStrategiesActions || 'N/A'}</TableCell>
                                        <TableCell className="px-3 py-2 whitespace-nowrap">{risk.actionOwner || 'N/A'}</TableCell>
                                        <TableCell className="px-3 py-2 whitespace-nowrap"> {formatDateString(risk.dueDateTimestamp, risk.dueDateString)} </TableCell>
                                        <TableCell className="px-3 py-2 whitespace-nowrap">{risk.status || 'N/A'}</TableCell>
                                        <TableCell className="px-3 py-2 whitespace-nowrap"> {formatDateString(risk.lastUpdatedTimestamp, risk.lastUpdatedString)} </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableCaption className="py-4">End of Risk Register.</TableCaption>
                        </Table>
                    </CardContent>
                </Card>
             )}

             {/* --- No Data Initial Message --- */}
             {!loading && (!data || data.length === 0) && (
                <Card className="text-center p-6">
                    <CardContent>
                        <Info className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                        <h3 className="text-lg font-medium mb-2">No Risks Registered Yet</h3>
                        <p className="text-muted-foreground">Use the section above to add risks using AI analysis, or add them directly to the Google Sheet.</p>
                        <Button onClick={refreshData} className="mt-4"> <RefreshCw className="mr-2 h-4 w-4" /> Refresh Data </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
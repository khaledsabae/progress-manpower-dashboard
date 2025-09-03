// src/components/daily-report-summary.tsx
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button"; // Ensure Button is imported
import { Languages } from 'lucide-react'; // Ensure Languages icon is imported
import { Icons } from '@/components/icons'; // Ensure Icons are imported correctly
import type { DailyReportData, WorkedOnActivity } from '@/types'; // Ensure types path is correct and types are updated
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils'; // Ensure cn is imported

// Updated Props Interface
interface DailyReportSummaryProps {
  data: DailyReportData | null;
  loading: boolean;
  aiSummary: string | null;
  aiSummaryLoading: boolean;
  summaryLanguage: 'en' | 'ar'; // Current language state
  onLanguageToggle: () => void; // Function to toggle language state
}

// Helper function to format numbers or show N/A
const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  // Use maximumFractionDigits: 0 for whole numbers like manpower
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

// Helper function to format percentages
const formatPercentage = (value: number | null | undefined): string => {
  // Use formatNumber which now handles N/A and formatting
  const numString = formatNumber(value);
  // Only add '%' if it's a valid number, otherwise return 'N/A'
  return numString !== 'N/A' ? `${numString}%` : 'N/A';
};


// Helper function to format dates
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString || dateString === 'N/A') return 'N/A';
  try {
    const date = parseISO(dateString);
    // Format date as "Month Day, Year" e.g., "May 6th, 2025"
    return isValid(date) ? format(date, 'PPP') : dateString;
  } catch (e) {
    // Fallback to original string if parsing fails
    return dateString;
  }
};

// Component to render a list of activities (includes Delta display)
const ActivityList: React.FC<{ activities: WorkedOnActivity[] | undefined }> = ({ activities }) => {
  // Handle case where activities array is undefined or empty
  if (!activities || activities.length === 0) {
    return <p className="text-sm text-muted-foreground px-4 pb-4">No activities found in this category.</p>;
  }

  return (
    // Use unordered list for better semantics
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {activities.map((activity) => (
        // Use a stable key, combining id and potentially index if ids aren't unique across lists
        <li key={activity.id}>
          <span className="font-medium">{activity.name || "Unnamed Activity"}</span>
          {activity.location && <span className="text-muted-foreground"> - {activity.location}</span>}

          {/* Display Progress and Delta */}
          {activity.progress !== null && (
            <span className="font-semibold text-primary ml-2">
              ({formatPercentage(activity.progress)}
              {/* Show delta only if it's significantly positive */}
              {activity.delta > 0.01 && (
                <span className="text-green-600 dark:text-green-400 ml-1">
                  (+{activity.delta.toFixed(1)}%)
                </span>
              )})
            </span>
          )}

          {/* Display Remarks if they exist */}
          {activity.remarks && <p className="text-xs text-muted-foreground pl-2 mt-0.5">↳ {activity.remarks}</p>}
        </li>
      ))}
    </ul>
  );
};

// --- Main Component ---
export function DailyReportSummary({ data, loading, aiSummary, aiSummaryLoading, summaryLanguage, onLanguageToggle }: DailyReportSummaryProps) {

  // --- Loading State ---
  if (loading) {
    return (
      <Card className="mt-6 animate-pulse">
        <CardHeader>
          <Skeleton className="h-6 w-3/4 mb-2" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent>
          <div className="mb-6"><Skeleton className="h-5 w-1/3 mb-2" /><Skeleton className="h-4 w-full mb-1" /><Skeleton className="h-4 w-5/6" /></div>
          <div className="mb-4"><Skeleton className="h-5 w-1/4 mb-2" /><Skeleton className="h-10 w-24" /></div>
          <div><Skeleton className="h-5 w-1/3 mb-2" /><div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div></div>
        </CardContent>
      </Card>
    );
  }

  // --- Handle missing data (using previousManpower as an indicator too) ---
  if (!data || (!data.workedOnActivities && data.previousManpower === null)) {
    const description = !data ? "Select a date to view the report." : "Cannot determine activities or manpower (missing previous day's data?).";
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Daily Report Summary</CardTitle>
          <CardDescription>{data?.reportDate ? `Status as of: ${formatDate(data.reportDate)}. ` : ''}{description}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Destructure data including previousManpower and the new workedOnActivities structure
  const { reportDate, previousManpower, workedOnActivities } = data;

  // Calculate total and default open items based on NEW structure
  const totalWorkedOn = (workedOnActivities?.hvac?.length ?? 0) +
                        (workedOnActivities?.ff?.length ?? 0) +
                        (workedOnActivities?.fa?.length ?? 0) +
                        (workedOnActivities?.other?.length ?? 0);

  const defaultOpenItems = ['hvac', 'ff', 'fa', 'other'].filter(value => {
    switch(value) {
      case 'hvac': return (workedOnActivities?.hvac?.length ?? 0) > 0;
      case 'ff':   return (workedOnActivities?.ff?.length ?? 0) > 0;
      case 'fa':   return (workedOnActivities?.fa?.length ?? 0) > 0;
      case 'other':return (workedOnActivities?.other?.length ?? 0) > 0;
      default:     return false;
    }
  });

  return (
    <Card className="mt-6">
      {/* Card Header includes Language Toggle Button */}
      <CardHeader className="flex flex-row items-center justify-between space-x-4 pb-4">
        <div>
          <CardTitle>Daily Report Summary</CardTitle>
          <CardDescription>
            Activities with progress reported on <span className="font-semibold">{formatDate(reportDate)}</span>. Shift: Day.
          </CardDescription>
        </div>
        {/* Language Toggle Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onLanguageToggle} // Calls handler from page.tsx
          aria-label={`Switch summary language to ${summaryLanguage === 'en' ? 'Arabic' : 'English'}`}
          className="flex-shrink-0 ml-auto" // Position to the right
        >
          <Languages className="h-4 w-4 mr-1.5" />
          {/* Shows the language it will switch TO */}
          {summaryLanguage === 'en' ? 'AR' : 'EN'}
        </Button>
      </CardHeader>

      <CardContent className="space-y-6 pt-0">
        {/* Workforce Summary - Displays PREVIOUS day's manpower */}
        <div>
          <h4 className="text-md font-semibold mb-2">Workforce <span className="text-xs text-muted-foreground">(During Activities)</span></h4>
          <div className="flex flex-col p-3 bg-muted/50 rounded-lg w-fit text-sm">
            <span className="text-muted-foreground">Total Workforce</span>
            <span className="text-lg font-semibold">{formatNumber(previousManpower)}</span>
          </div>
        </div>

        {/* AI Generated Summary Section - With RTL/LTR support */}
        <div>
          <h4 className="text-md font-semibold mb-2">AI Generated Summary ({summaryLanguage.toUpperCase()})</h4>
          {/* Added dir and text-align for RTL/LTR */}
          <div
            className={cn(
                "text-sm text-muted-foreground whitespace-pre-wrap min-h-[60px]", // Base styles
                summaryLanguage === 'ar' ? 'text-right' : 'text-left' // Conditional text alignment
            )}
            dir={summaryLanguage === 'ar' ? 'rtl' : 'ltr'} // Conditional direction
          >
            {aiSummaryLoading ? (
              // Loading state with spinner
              <div className="flex items-center space-x-2 pt-1" dir="ltr"> {/* Keep spinner LTR */}
                  <Icons.spinner className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Generating summary...</span>
              </div>
            ) : aiSummary ? (
              // Display summary or error
              aiSummary.startsWith("Error generating AI summary:")
                ? <span className="text-destructive">{aiSummary}</span>
                : aiSummary.startsWith("(") && aiSummary.endsWith(")") // Check for placeholder
                ? <span className="italic">{aiSummary}</span>
                : <span>{aiSummary}</span> // Render normal summary
            ) : totalWorkedOn > 0 ? (
              // No summary yet, but activities exist
              <span className="italic">Generating summary...</span>
            ) : (
              // No summary and no activities
              <span>No progress to summarize.</span>
            )}
          </div>
        </div>

        {/* Activities Accordion - Using NEW Categories */}
        <div>
          <h4 className="text-md font-semibold mb-2">Activities with Progress ({totalWorkedOn})</h4>
          {totalWorkedOn > 0 && workedOnActivities ? (
            <Accordion type="multiple" className="w-full" defaultValue={defaultOpenItems}>
              {/* HVAC Section */}
              {workedOnActivities.hvac && workedOnActivities.hvac.length > 0 && (
                <AccordionItem value="hvac">
                  <AccordionTrigger>HVAC Activities ({workedOnActivities.hvac.length})</AccordionTrigger>
                  <AccordionContent> <ActivityList activities={workedOnActivities.hvac} /> </AccordionContent>
                </AccordionItem>
              )}
              {/* Firefighting Section */}
              {workedOnActivities.ff && workedOnActivities.ff.length > 0 && (
                <AccordionItem value="ff">
                  <AccordionTrigger>Firefighting Activities ({workedOnActivities.ff.length})</AccordionTrigger>
                  <AccordionContent> <ActivityList activities={workedOnActivities.ff} /> </AccordionContent>
                </AccordionItem>
              )}
              {/* Fire Alarm Section */}
              {workedOnActivities.fa && workedOnActivities.fa.length > 0 && (
                <AccordionItem value="fa">
                  <AccordionTrigger>Fire Alarm Activities ({workedOnActivities.fa.length})</AccordionTrigger>
                  <AccordionContent> <ActivityList activities={workedOnActivities.fa} /> </AccordionContent>
                </AccordionItem>
              )}
              {/* Other Section */}
              {workedOnActivities.other && workedOnActivities.other.length > 0 && (
                <AccordionItem value="other">
                  <AccordionTrigger>Other Activities ({workedOnActivities.other.length})</AccordionTrigger>
                  <AccordionContent> <ActivityList activities={workedOnActivities.other} /> </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          ) : (
            <p className="text-sm text-muted-foreground mt-2">No activities showed progress compared to the previous snapshot.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
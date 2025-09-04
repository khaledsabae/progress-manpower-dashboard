'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Brain, Calendar, RefreshCw } from 'lucide-react';
import { useAIInsights } from '@/hooks/useDataFetcher';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { DataErrorState } from '@/components/ui/ErrorState';
import { AIInsights } from '@/types/dashboard';

interface AIInsightCardProps {
  projectData?: any;
  className?: string;
}

export function AIInsightCard({ projectData, className = '' }: AIInsightCardProps) {
  const t = useTranslations('overview');
  
  // Use the useAIInsights hook with proper typing
  const { 
    data: insights, 
    isLoading, 
    error, 
    refetch, 
    isRefreshing,
    isInitialLoading 
  } = useAIInsights({
    errorMessage: t('errorOccurred'),
    showErrorToast: true,
  });
  
  // Format the predicted date if available
  const formattedDate = useMemo(() => {
    if (!insights?.predictedCompletionDate) return t('notSpecified');
    
    try {
      return new Date(insights.predictedCompletionDate).toLocaleDateString(
        'ar-SA',
        { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric',
          calendar: 'gregory'
        }
      );
    } catch (e) {
      return insights.predictedCompletionDate;
    }
  }, [insights?.predictedCompletionDate, t]);
  
  // Loading state - show skeleton
  if (isLoading && isInitialLoading) {
    return (
      <Card className={`relative overflow-hidden p-6 ${className}`}>
        <LoadingSkeleton className="h-40" />
      </Card>
    );
  }
  
  // Error state - show error message with retry option
  if (error) {
    return (
      <Card className={`relative overflow-hidden p-6 ${className}`}>
        <DataErrorState 
          error={error} 
          onRetry={refetch}
          className="min-h-[200px]"
        />
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden p-6">
      {/* Header with Title and AI Badge */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            {t('aiInsights')}
          </h3>
          
          {/* Predicted Completion Date */}
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <Calendar className="h-4 w-4 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500 mb-0.5">
                {t('predictedCompletion')}
              </p>
              <p className="text-sm font-medium text-green-600">
                {formattedDate}
              </p>
            </div>
          </div>
        </div>
        
        {/* AI Icon with Loading State */}
        <div className="flex flex-col items-center">
          <div className="p-2.5 bg-purple-100 rounded-full">
            <Brain className="h-5 w-5 text-purple-600" />
          </div>
          {isRefreshing && (
            <div className="mt-1 flex items-center space-x-1">
              <RefreshCw className="h-3 w-3 text-purple-500 animate-spin" />
              <span className="text-xs text-purple-600">
                {t('updating')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Summary Section */}
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-500 mb-1.5">
          {t('summary')}
        </p>
        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-sm text-gray-700 leading-relaxed">
            {insights?.summaryReport || t('noSummaryAvailable')}
          </p>
        </div>
      </div>

      {/* Recommendations Section */}
      {insights?.recommendations?.length ? (
        <div className="space-y-3">
          <p className="text-xs font-medium text-gray-500">
            {t('keyRecommendations')}
          </p>
          <div className="space-y-2">
            {insights.recommendations.slice(0, 3).map((rec, index) => (
              <div 
                key={index} 
                className="flex items-start space-x-2 rtl:space-x-reverse p-2 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
              >
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                <p className="text-xs text-gray-700 leading-relaxed">
                  {rec}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500">
            {t('noRecommendationsAvailable')}
          </p>
        </div>
      )}
    </Card>
  );
}

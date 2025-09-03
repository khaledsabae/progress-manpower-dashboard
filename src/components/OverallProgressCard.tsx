'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { TrendingUp, Activity } from 'lucide-react';
import { useProgressData } from '@/hooks/useDataFetcher';
import { DataErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

export function OverallProgressCard() {
  const t = useTranslations('overview');
  const { data, isLoading, error, refetch } = useProgressData({
    errorMessage: t('errorOccurred'),
  });

  const calculateOverallProgress = () => {
    // Handle empty or missing data safely
    if (!data || !Array.isArray(data) || data.length === 0) return 0;
    
    // Support both legacy and new data structures
    const items = data.map(item => ({
      progress: item.progress ?? item['Progress %'] ?? 0
    }));
    
    const totalProgress = items.reduce((sum, item) => sum + (Number(item.progress) || 0), 0);
    return Math.round(totalProgress / items.length);
  };

  const getCompletedTasks = () => {
    // Handle empty or missing data safely
    if (!data || !Array.isArray(data) || data.length === 0) return { completed: 0, total: 0 };
    
    // Support both legacy and new data structures
    const items = data.map(item => ({
      progress: item.progress ?? item['Progress %'] ?? 0
    }));
    
    const completed = items.filter(item => (Number(item.progress) || 0) >= 100).length;
    return { completed, total: items.length };
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className="relative overflow-hidden">
        <LoadingSkeleton className="h-24" />
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="p-6">
        <DataErrorState error={error} onRetry={() => refetch()} />
      </Card>
    );
  }

  const overallProgress = calculateOverallProgress();
  const { completed, total } = getCompletedTasks();

  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">
            {t('overallProgress')}
          </p>
          <p className="text-3xl font-bold text-gray-900">
            {overallProgress}%
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {completed}/{total} مهام مكتملة
          </p>
        </div>
        <div className="p-3 bg-blue-100 rounded-full">
          <TrendingUp className="h-6 w-6 text-blue-600" />
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
          <span>التقدم</span>
          <span>{overallProgress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Status Indicator */}
      <div className="absolute top-4 right-4">
        <div className="flex items-center space-x-1 rtl:space-x-reverse">
          <Activity className="h-4 w-4 text-green-500" />
          <span className="text-xs text-green-600 font-medium">نشط</span>
        </div>
      </div>
    </Card>
  );
}

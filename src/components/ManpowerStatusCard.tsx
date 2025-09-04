'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Users, UserCheck, RefreshCw } from 'lucide-react';
import { useManpowerData } from '@/hooks/useDataFetcher';
import { DataErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { Button } from '@/components/ui/button';
import { ManpowerData } from '@/types/dashboard';

interface ManpowerStats {
  totalPlanned: number;
  totalActual: number;
  utilization: number;
}

export function ManpowerStatusCard() {
  const t = useTranslations('overview');
  const { 
    data, 
    isLoading, 
    error, 
    refetch, 
    isRefreshing,
    isInitialLoading 
  } = useManpowerData({
    errorMessage: t('errorOccurred'),
  });

  const calculateManpowerStats = (manpowerData: ManpowerData | null): ManpowerStats => {
    if (!manpowerData) {
      return { totalPlanned: 0, totalActual: 0, utilization: 0 };
    }
    
    // Handle both array and object response formats
    if (Array.isArray(manpowerData) && manpowerData.length > 0) {
      // Array format: sum up all entries
      const totalPlanned = manpowerData.reduce((sum, item) => 
        sum + (Number(item['Total Planned']) || 0), 0);
      const totalActual = manpowerData.reduce((sum, item) => 
        sum + (Number(item['Total Actual']) || 0), 0);
      const utilization = totalPlanned > 0 ? 
        Math.round((totalActual / totalPlanned) * 100) : 0;
      
      return { totalPlanned, totalActual, utilization };
    } else if (typeof manpowerData === 'object' && manpowerData !== null) {
      // Object format with aggregated data
      const totalTeamMembers = Number(manpowerData.totalTeamMembers) || 0;
      const allocationRate = Number(manpowerData.allocationRate) || 0;
      const totalActual = Math.round((allocationRate / 100) * totalTeamMembers);
      
      return {
        totalPlanned: totalTeamMembers,
        totalActual,
        utilization: allocationRate
      };
    }
    
    return { totalPlanned: 0, totalActual: 0, utilization: 0 };
  };

  // Calculate stats from data
  const { totalPlanned, totalActual, utilization } = calculateManpowerStats(data);
  
  // Loading state - show skeleton
  if (isLoading && isInitialLoading) {
    return (
      <Card className="relative overflow-hidden">
        <LoadingSkeleton className="h-40" />
      </Card>
    );
  }

  // Error state - show error message with retry option
  if (error) {
    return (
      <Card className="p-4">
        <DataErrorState 
          error={error} 
          onRetry={refetch}
          
        />
      </Card>
    );
  }
  // Determine color scheme based on utilization
  const getUtilizationColor = (util: number) => {
    if (util >= 90) return 'text-green-600';
    if (util >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  const getUtilizationBg = (util: number) => {
    if (util >= 90) return 'bg-green-100';
    if (util >= 70) return 'bg-yellow-100';
    return 'bg-red-100';
  };
  
  const getStatusText = (util: number) => {
    if (util >= 90) return t('excellent');
    if (util >= 70) return t('good');
    return t('needsImprovement');
  };
  
  const utilizationColor = getUtilizationColor(utilization);
  const utilizationBg = getUtilizationBg(utilization);

  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">
            {t('manpowerStatus')}
          </p>
          <p className="text-3xl font-bold text-gray-900">
            {totalActual}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {t('outOfPlanned', { planned: totalPlanned })}
          </p>
        </div>
        <div className={`p-3 ${utilizationBg} rounded-full`}>
          <Users className={`h-6 w-6 ${utilizationColor}`} />
        </div>
      </div>
      
      {/* Utilization Stats */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">
            {t('utilizationRate')}
          </p>
          <div className="flex items-center space-x-2">
            <p className={`text-lg font-semibold ${utilizationColor}`}>
              {utilization}%
            </p>
            {isRefreshing && (
              <RefreshCw className="h-3 w-3 text-gray-400 animate-spin" />
            )}
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">
            {t('status')}
          </p>
          <div className="flex items-center space-x-1 rtl:space-x-reverse">
            <UserCheck className="h-4 w-4 text-green-500" />
            <span className={`text-xs font-medium ${utilizationColor}`}>
              {getStatusText(utilization)}
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
          <span>{t('usage')}</span>
          <div className="flex items-center space-x-2">
            <span>{utilization}%</span>
            {isRefreshing && (
              <span className="text-xs text-gray-500">
                {t('updating')}
              </span>
            )}
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              utilization >= 90 ? 'bg-green-500' : utilization >= 70 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(utilization, 100)}%` }}
          />
        </div>
      </div>
    </Card>
  );
}

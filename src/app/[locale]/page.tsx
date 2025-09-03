import { getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui/Card';
import { OverallProgressCard } from '@/components/OverallProgressCard';
import { ManpowerStatusCard } from '@/components/ManpowerStatusCard';
import { AIInsightCard } from '@/components/AIInsightCard';
import { ProjectTimelineChart } from '@/components/ProjectTimelineChart';

async function fetchProjectData() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/project-data`, {
      cache: 'no-store', // Always fetch fresh data
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch project data');
    }
    
    const result = await response.json();
    return result.success ? result.data : null;
  } catch (error) {
    console.error('Error fetching project data:', error);
    return null;
  }
}

export default async function OverviewPage() {
  const t = await getTranslations('overview');
  const projectData = await fetchProjectData();

  if (!projectData) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <Card>
          <div className="text-center py-8">
            <p className="text-red-600">{t('error')}</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
      
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <OverallProgressCard />
        <ManpowerStatusCard />
        <AIInsightCard projectData={projectData} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProjectTimelineChart data={projectData.mechanicalPlan} />
        <Card title={t('projectTimeline')}>
          <div className="text-center py-8 text-gray-500">
            {t('loading')}
          </div>
        </Card>
      </div>
    </div>
  );
}

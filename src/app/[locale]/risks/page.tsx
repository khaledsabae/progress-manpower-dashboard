import { getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui/Card';

async function fetchProjectData() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/project-data`, {
      cache: 'no-store',
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

export default async function RisksPage() {
  const t = await getTranslations('risks');
  const projectData = await fetchProjectData();

  if (!projectData) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <Card>
          <div className="text-center py-8">
            <p className="text-red-600">خطأ في تحميل البيانات</p>
          </div>
        </Card>
      </div>
    );
  }

  const getRiskLevel = (score: number) => {
    if (score >= 15) return { level: 'عالي', color: 'bg-red-100 text-red-800' };
    if (score >= 8) return { level: 'متوسط', color: 'bg-yellow-100 text-yellow-800' };
    return { level: 'منخفض', color: 'bg-green-100 text-green-800' };
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
      
      <Card title="سجل المخاطر">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('riskId')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('description')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('probability')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('impact')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  مستوى المخاطرة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('owner')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {projectData.riskRegister?.map((risk: any, index: number) => {
                const riskLevel = getRiskLevel(risk['Risk Score'] || 0);
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {risk['Risk ID'] || `MR${index + 1}`}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                      <div className="truncate" title={risk['Description']}>
                        {risk['Description'] || 'لا يوجد وصف'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {risk['Probability'] || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {risk['Impact'] || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${riskLevel.color}`}>
                        {riskLevel.level}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {risk['Owner'] || 'غير محدد'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Risk Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title="المخاطر العالية" className="border-red-200">
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600">
              {projectData.riskRegister?.filter((r: any) => (r['Risk Score'] || 0) >= 15).length || 0}
            </div>
            <p className="text-sm text-gray-500 mt-1">مخاطرة عالية</p>
          </div>
        </Card>
        
        <Card title="المخاطر المتوسطة" className="border-yellow-200">
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-600">
              {projectData.riskRegister?.filter((r: any) => {
                const score = r['Risk Score'] || 0;
                return score >= 8 && score < 15;
              }).length || 0}
            </div>
            <p className="text-sm text-gray-500 mt-1">مخاطرة متوسطة</p>
          </div>
        </Card>
        
        <Card title="المخاطر المنخفضة" className="border-green-200">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {projectData.riskRegister?.filter((r: any) => (r['Risk Score'] || 0) < 8).length || 0}
            </div>
            <p className="text-sm text-gray-500 mt-1">مخاطرة منخفضة</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

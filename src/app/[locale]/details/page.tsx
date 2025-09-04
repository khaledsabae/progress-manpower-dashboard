import { getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui/card';

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

export default async function DetailsPage() {
  const t = await getTranslations('details');
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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
      
      <Card title={t('mechanicalPlan')}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  اسم المهمة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('progress')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('status')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('assignedTo')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {projectData.mechanicalPlan?.map((item: any, index: number) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item['Task Name'] || `مهمة ${index + 1}`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${item['Progress %'] || 0}%` }}
                        />
                      </div>
                      <span>{item['Progress %'] || 0}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      (item['Progress %'] || 0) >= 100 
                        ? 'bg-green-100 text-green-800' 
                        : (item['Progress %'] || 0) >= 50 
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {(item['Progress %'] || 0) >= 100 ? 'مكتمل' : 
                       (item['Progress %'] || 0) >= 50 ? 'قيد التنفيذ' : 'لم يبدأ'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item['Assigned To'] || 'غير محدد'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

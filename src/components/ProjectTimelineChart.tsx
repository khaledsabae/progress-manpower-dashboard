'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ProjectTimelineChartProps {
  data: any[];
}

export function ProjectTimelineChart({ data }: ProjectTimelineChartProps) {
  const t = useTranslations('overview');

  const chartData = data?.slice(0, 8).map((item, index) => ({
    name: item['Task Name'] || `مهمة ${index + 1}`,
    progress: item['Progress %'] || 0,
    planned: item['Planned Duration'] || 0,
    actual: item['Actual Duration'] || 0,
  })) || [];

  return (
    <Card title="تقدم المهام">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip 
              formatter={(value, name) => [
                `${value}${name === 'progress' ? '%' : ' يوم'}`,
                name === 'progress' ? 'التقدم' : name === 'planned' ? 'مخطط' : 'فعلي'
              ]}
            />
            <Bar dataKey="progress" fill="#3B82F6" name="progress" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

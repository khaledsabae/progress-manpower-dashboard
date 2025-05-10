// src/components/progress-chart.tsx
'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
// --- استيراد الـ Hook --- VVV
import { useChartColors } from '@/hooks/use-chart-colors';

// Define the type for the aggregated data structure it expects
interface BuildingProgressData {
  buildingName: string;
  hvacAvg: number | null;
  ffAvg: number | null;
  faAvg: number | null;
}

interface ProgressChartProps {
  data: BuildingProgressData[]; // Expects the pre-aggregated data
}

export function ProgressChart({ data }: ProgressChartProps) {
  // --- استخدام الـ Hook للحصول على الألوان --- VVV
  const { chart1, chart2, chart3, axis, grid, tooltipBg, tooltipText, muted } = useChartColors();

  // --- استخدام الألوان من الـ Hook --- VVV
  const COLORS = {
    HVAC: chart1 || '#8884d8',       // استخدم ألوان الشارت من الـ hook
    Firefighting: chart2 || '#82ca9d',
    FireAlarm: chart3 || '#ffc658',
  };

  // Check if the processed data is empty or not provided
  if (!data || data.length === 0) {
    return <div className="text-center text-muted-foreground mt-4 h-[300px] flex items-center justify-center">No aggregated building progress data available to display the chart.</div>;
  }

  return (
    <div className="mt-6" style={{ width: '100%', height: 350 }}>
      {/* Chart Title */}
      <h3 className="text-lg font-semibold mb-4 text-center">Avg. Weighted Progress by Building (%)</h3>
      <ResponsiveContainer>
        <BarChart
          data={data}
          margin={{ top: 5, right: 30, left: 0, bottom: 50, }} // Increased bottom margin for angled labels
        >
          {/* --- استخدام الألوان من الـ Hook --- VVV */}
          <CartesianGrid strokeDasharray="3 3" stroke={grid || '#e0e0e0'} />
          <XAxis
            dataKey="buildingName"
            angle={-45} // Changed angle for better fit potentially
            textAnchor="end"
            height={70} // Keep increased height
            interval={0}
            fontSize={10}
            // --- استخدام الألوان من الـ Hook --- VVV
            stroke={axis || '#6b7280'}
          />
          <YAxis
            domain={[0, 100]}
            unit="%"
            width={40}
            // --- استخدام الألوان من الـ Hook --- VVV
            stroke={axis || '#6b7280'}
          />
          <Tooltip
            formatter={(value: number | string, name: string) => {
              const numValue = typeof value === 'number' ? value : parseFloat(value);
              return isNaN(numValue) ? 'N/A' : `${numValue.toFixed(0)}%`;
            }}
            // --- استخدام الألوان من الـ Hook --- VVV
            cursor={{ fill: muted ? `${muted}80` : 'rgba(206, 206, 206, 0.2)' }} // Use muted color with alpha
            contentStyle={{
              backgroundColor: tooltipBg || '#ffffff',
              border: `1px solid ${grid || '#ccc'}`,
              borderRadius: 'var(--radius)', // Use CSS variable if defined
              padding: '8px', // Example padding
              boxShadow: 'var(--tw-shadow)', // Use tailwind shadow if needed
            }}
            labelStyle={{ marginBottom: '4px', color: tooltipText || '#000000' }}
            itemStyle={{ color: tooltipText || '#000000', fontSize: '12px' }}
          />
          {/* --- استخدام الألوان من الـ Hook --- VVV */}
          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
          <Bar dataKey="hvacAvg" fill={COLORS.HVAC} name="HVAC Avg %" radius={[4, 4, 0, 0]} />
          <Bar dataKey="ffAvg" fill={COLORS.Firefighting} name="FF Avg %" radius={[4, 4, 0, 0]} />
          <Bar dataKey="faAvg" fill={COLORS.FireAlarm} name="FA Avg %" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
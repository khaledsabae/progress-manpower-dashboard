// src/components/ManpowerChartJS.tsx
"use client";

import type { ScriptableContext, ChartOptions, ChartDataset, Color } from 'chart.js'; // Added ChartDataset, Color
import type { ManpowerSheetRow } from '@/services/google-sheets';
import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { format, isValid } from 'date-fns';
import { useChartColors } from '@/hooks/use-chart-colors'; // Make sure this path is correct

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
);

interface ManpowerChartJSProps {
  data: ManpowerSheetRow[];
}

const formatDateDisplay = (timestamp: number | null): string => {
  if (timestamp && isValid(new Date(timestamp))) {
    return format(new Date(timestamp), 'dd-MMM');
  }
  return '';
};

export function ManpowerChartJS({ data }: ManpowerChartJSProps) {
  const { chart1, chart2, chart3, axis, grid, tooltipBg, tooltipText, background } = useChartColors();

  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return { labels: [], datasets: [] };
    }
    const sortedData = [...data].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
    const labels = sortedData.map(row => formatDateDisplay(row.timestamp));

    // Helper function to create gradient background color
    const createGradient = (context: ScriptableContext<'line'>, baseColorHsl: string): CanvasGradient | undefined => {
      const chart = context.chart;
      const { ctx, chartArea } = chart;
      if (!chartArea || !baseColorHsl) { return undefined; }

      const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
      // Convert base hsl to hsla with desired opacity for gradient stops
      const baseColorWithOpacity = baseColorHsl.replace('hsl(', 'hsla(').replace(')', ', 0.5)');
      const bgColorTransparent = background ? background.replace('hsl(', 'hsla(').replace(')', ', 0)') : 'hsla(0, 0%, 100%, 0)';

      gradient.addColorStop(0, bgColorTransparent);
      gradient.addColorStop(0.7, baseColorWithOpacity);
      gradient.addColorStop(1, baseColorWithOpacity);

      return gradient;
    }

    const datasets: ChartDataset<'line', (number | null)[]>[] = [
      {
        label: 'FA',
        data: sortedData.map(r => r.fireAlarmManpower ?? null),
        borderColor: chart3, // Use formatted hsl color
        backgroundColor: (context: ScriptableContext<'line'>) => createGradient(context, chart3),
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        order: 1
      },
      {
        label: 'FF',
        data: sortedData.map(r => r.firefightingManpower ?? null),
        borderColor: chart2, // Use formatted hsl color
        backgroundColor: (context: ScriptableContext<'line'>) => createGradient(context, chart2),
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        order: 2
      },
      {
        label: 'HVAC',
        data: sortedData.map(r => r.hvacManpower ?? null),
        borderColor: chart1, // Use formatted hsl color
        backgroundColor: (context: ScriptableContext<'line'>) => createGradient(context, chart1),
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        order: 3
      },
    ];
    return { labels, datasets };
  }, [data, chart1, chart2, chart3, background]);

  const options = useMemo((): ChartOptions<'line'> => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false, },
    plugins: {
      legend: { position: 'bottom', labels: { color: axis, boxWidth: 12, font: { size: 10 }, padding: 15 } },
      tooltip: {
        enabled: true,
        backgroundColor: tooltipBg,
        titleColor: tooltipText,
        bodyColor: tooltipText,
        borderColor: grid,
        borderWidth: 1,
        padding: 8,
        itemSort: (a, b) => b.datasetIndex - a.datasetIndex,
      }
    },
    animation: { duration: 500, easing: 'linear', },
    scales: {
      x: {
        type: 'category',
        labels: chartData.labels,
        grid: { display: false },
        ticks: { color: axis, font: { size: 10 }, maxRotation: 0, autoSkipPadding: 15 },
        border: { color: grid }
      },
      y: {
        position: 'right',
        stacked: true,
        beginAtZero: true,
        grid: { drawOnChartArea: true, color: grid },
        ticks: { precision: 0, font: { size: 10 }, color: axis },
        border: { display: false }
      }
    }
  }), [chartData.labels, axis, grid, tooltipBg, tooltipText, background]);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {chartData.datasets.length === 0 ? (
        // --- التعليق الغلط اتشال من هنا --- VVV
        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
          No data to display chart.
        </div>
       ) : (
        <Line options={options} data={chartData} />
       )}
    </div>
  );
}
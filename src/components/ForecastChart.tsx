// src/components/ForecastChart.tsx
// Module 2: Forecast Chart Component

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

interface ForecastData {
  historical: number[];
  forecast: number[];
  method: string;
  window: number;
  horizon: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: number;
}

interface ForecastChartProps {
  data: ForecastData;
  discipline: string;
  locale?: 'en' | 'ar';
}

interface ChartDataPoint {
  period: string;
  historical: number | null;
  forecast: number | null;
  type: 'historical' | 'forecast';
}

const ForecastChart: React.FC<ForecastChartProps> = ({
  data,
  discipline,
  locale = 'en'
}) => {
  // Prepare chart data
  const chartData: ChartDataPoint[] = [];

  // Add historical data
  data.historical.forEach((value, index) => {
    chartData.push({
      period: `H${index + 1}`,
      historical: value,
      forecast: null,
      type: 'historical'
    });
  });

  // Add forecast data
  data.forecast.forEach((value, index) => {
    chartData.push({
      period: `F${index + 1}`,
      historical: null,
      forecast: value,
      type: 'forecast'
    });
  });

  const trendColor = data.trend === 'increasing' ? '#10b981' :
                     data.trend === 'decreasing' ? '#ef4444' : '#6b7280';

  const title = locale === 'ar'
    ? `توقع ${discipline.toUpperCase()} (${data.method.toUpperCase()})`
    : `${discipline.toUpperCase()} Forecast (${data.method.toUpperCase()})`;

  return (
    <div className="w-full bg-white rounded-lg shadow-md p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {title}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-600">
              {locale === 'ar' ? 'الطريقة:' : 'Method:'}
            </span>
            <span className="font-medium ml-1">{data.method.toUpperCase()}</span>
          </div>
          <div>
            <span className="text-gray-600">
              {locale === 'ar' ? 'النافذة:' : 'Window:'}
            </span>
            <span className="font-medium ml-1">{data.window}</span>
          </div>
          <div>
            <span className="text-gray-600">
              {locale === 'ar' ? 'الأفق:' : 'Horizon:'}
            </span>
            <span className="font-medium ml-1">{data.horizon}</span>
          </div>
          <div>
            <span className="text-gray-600">
              {locale === 'ar' ? 'الاتجاه:' : 'Trend:'}
            </span>
            <span className={`font-medium ml-1`} style={{ color: trendColor }}>
              {locale === 'ar'
                ? (data.trend === 'increasing' ? 'متزايد' : data.trend === 'decreasing' ? 'متناقص' : 'مستقر')
                : data.trend
              }
            </span>
          </div>
        </div>
        <div className="mt-2">
          <span className="text-gray-600">
            {locale === 'ar' ? 'الثقة:' : 'Confidence:'}
          </span>
          <span className="font-medium ml-1">
            {(data.confidence * 100).toFixed(0)}%
          </span>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${data.confidence * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 12 }}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            label={{
              value: locale === 'ar' ? 'عدد الأفراد' : 'Manpower Count',
              angle: -90,
              position: 'insideLeft'
            }}
          />
          <Tooltip
            formatter={(value: any, name: string) => [
              value ? value.toFixed(1) : 'N/A',
              name === 'historical'
                ? (locale === 'ar' ? 'تاريخي' : 'Historical')
                : (locale === 'ar' ? 'متوقع' : 'Forecast')
            ]}
            labelFormatter={(label) =>
              label.startsWith('H')
                ? (locale === 'ar' ? `الفترة التاريخية ${label.slice(1)}` : `Historical Period ${label.slice(1)}`)
                : (locale === 'ar' ? `التوقع ${label.slice(1)}` : `Forecast ${label.slice(1)}`)
            }
          />
          <Legend
            formatter={(value) =>
              value === 'historical'
                ? (locale === 'ar' ? 'البيانات التاريخية' : 'Historical Data')
                : (locale === 'ar' ? 'البيانات المتوقعة' : 'Forecast Data')
            }
          />
          <ReferenceLine
            x={`H${data.historical.length}`}
            stroke="#6b7280"
            strokeDasharray="5 5"
            label={{
              value: locale === 'ar' ? 'نقطة الانتقال' : 'Transition Point',
              position: 'top'
            }}
          />
          <Line
            type="monotone"
            dataKey="historical"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="forecast"
            stroke="#10b981"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 text-sm text-gray-600">
        <p>
          {locale === 'ar'
            ? `الرسم البياني يظهر البيانات التاريخية (أزرق) والتوقعات (أخضر متقطع) لـ ${discipline.toUpperCase()} باستخدام ${data.method.toUpperCase()}.`
            : `Chart shows historical data (blue) and forecasts (green dashed) for ${discipline.toUpperCase()} using ${data.method.toUpperCase()}.`
          }
        </p>
      </div>
    </div>
  );
};

export default ForecastChart;

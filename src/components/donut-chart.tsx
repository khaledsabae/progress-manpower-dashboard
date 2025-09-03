// src/components/donut-chart.tsx
"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Text } from "recharts";
import React from 'react';
import { useChartColors } from '@/hooks/use-chart-colors';

interface DonutChartProps {
    value: number | null;
    loading?: boolean;
    size?: number;
}

export function DonutChart({ value, loading = false, size = 120 }: DonutChartProps) {
    const { primary, muted, foreground, mutedForeground } = useChartColors();

    const validPercentage = (typeof value === 'number' && !isNaN(value)) ? Math.max(0, Math.min(100, value)) : 0;
    const data = [
        { name: "Complete", value: validPercentage },
        { name: "Remaining", value: Math.max(0, 100 - validPercentage) },
    ];

    let displayText: string;
    if (loading) { displayText = "..."; }
    else if (value === null || value === undefined || isNaN(value)) { displayText = "N/A"; }
    else { displayText = `${validPercentage.toFixed(0)}%`; }

    const COLORS = [primary || '#3b82f6', muted || '#e5e7eb'];
    const textColor = foreground || '#111827';
    const mutedTextColor = mutedForeground || '#6b7280';

    const outerRadiusPercent = 80;
    const innerRadiusPercent = 60;
    const labelFontSize = Math.max(10, Math.min(20, size / 6));

    // --- تعديل تعريف الدالة هنا --- VVV
    // نقبل الأوبجكت كامل اللي فيه index وغيره
    const renderCustomizedLabel = (props: any) => {
        const { cx, cy, index } = props; // نستخرج cx, cy, index من الـ props

        // نستخدم index هنا عادي
        if (index === 0 && displayText && displayText !== 'N/A' && displayText !== '...') {
            return (
                <Text
                    x={cx}
                    y={cy}
                    fill={textColor}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="font-bold"
                    style={{ fontSize: `${labelFontSize}px` }}
                >
                    {displayText}
                </Text>
            );
        }
        return null; // لا تعرض label للشريحة الثانية أو لو لا يوجد نص
    };
    // --- نهاية التعديل ---

    return (
        <ResponsiveContainer width="100%" height={size}>
            <PieChart width={size} height={size}>
                <Pie
                    data={data}
                    cx="50%" cy="50%"
                    innerRadius={`${innerRadiusPercent}%`}
                    outerRadius={`${outerRadiusPercent}%`}
                    dataKey="value"
                    stroke="none"
                    startAngle={90}
                    endAngle={-270}
                    isAnimationActive={!loading}
                    labelLine={false}
                    // --- تمرير الدالة هنا للـ prop label --- VVV
                    label={renderCustomizedLabel}
                >
                    {data.map((entry, index) => (
                        <Cell
                            key={`cell-${index}`}
                            fill={index === 0 && entry.value > 0 && !loading ? COLORS[0] : COLORS[1]}
                        />
                    ))}
                </Pie>
                {/* Fallback text */}
                {loading && (
                    <Text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="font-bold" fill={textColor} style={{ fontSize: `${labelFontSize}px` }}>...</Text>
                )}
                {!loading && displayText === 'N/A' && (
                    <Text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="font-bold" fill={mutedTextColor} style={{ fontSize: `${labelFontSize}px` }}>N/A</Text>
                )}
            </PieChart>
        </ResponsiveContainer>
    );
}
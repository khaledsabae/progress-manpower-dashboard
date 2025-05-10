// src/hooks/use-chart-colors.ts
"use client"; // لازم يكون Client Hook

import { useTheme } from "next-themes";
import { useEffect, useState, useMemo } from "react";

// Helper function to safely read CSS variable value from the root element
const getCssVariableValue = (variableName: string): string => {
  // Check if running in a browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return '';
  }
  try {
    if (document.documentElement) {
      const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
      return value || '';
    }
    return '';
  } catch (e) {
    console.warn(`Could not read CSS variable ${variableName}:`, e);
    return '';
  }
};

// --- إضافة الدوال المساعدة لتنسيق HSL --- VVV
// Helper: Converts HSL string "H S% L%" to "hsl(H, S%, L%)"
const formatHslString = (hslValue: string): string => {
  if (!hslValue || typeof hslValue !== 'string' || hslValue.split(' ').length < 3) {
    // Return a fallback color string or empty
    // console.warn(`Invalid HSL value for formatHslString: "${hslValue}"`);
    return 'hsl(0, 0%, 50%)'; // Return a default gray for visibility
  }
  // Add hsl() wrapper
  return `hsl(${hslValue.split(' ').join(', ')})`;
};

// Helper: Converts HSL string "H S% L%" to "hsla(H, S%, L%, A)"
const formatHslaString = (hslValue: string, alpha: number): string => {
    if (!hslValue || typeof hslValue !== 'string' || hslValue.split(' ').length < 3) {
        // Return a fallback color string or empty
        // console.warn(`Invalid HSL value for formatHslaString: "${hslValue}"`);
        return 'hsla(0, 0%, 50%, 0.5)'; // Return a default semi-transparent gray
    }
    // Clamp alpha between 0 and 1
    const validAlpha = Math.max(0, Math.min(1, alpha));
    // Add hsla() wrapper with alpha
    return `hsla(${hslValue.split(' ').join(', ')}, ${validAlpha})`;
};
// --- نهاية الدوال المساعدة ---

// Define the structure of the colors object returned by the hook
interface ChartColorConfig {
  axis: string; grid: string; tooltipBg: string; tooltipText: string;
  chart1: string; chart2: string; chart3: string; chart4: string; chart5: string;
  primary: string; primaryForeground: string; secondary: string; secondaryForeground: string;
  muted: string; mutedForeground: string; accent: string; accentForeground: string;
  destructive: string; destructiveForeground: string; background: string; foreground: string;
  success: string; warning: string;
  // Add any other specific variables you need
  // Example alpha versions added for convenience
  primary_75: string;
  muted_50: string;
}

export function useChartColors(): ChartColorConfig {
  const { resolvedTheme } = useTheme();
  const [chartColors, setChartColors] = useState<Partial<ChartColorConfig>>({});

  useEffect(() => {
    if (typeof window !== 'undefined' && resolvedTheme) {
      // --- قراءة القيم الخام من CSS --- VVV
      const rawAxis = getCssVariableValue('--muted-foreground');
      const rawGrid = getCssVariableValue('--border');
      const rawTooltipBg = getCssVariableValue('--popover');
      const rawTooltipText = getCssVariableValue('--popover-foreground');
      const rawChart1 = getCssVariableValue('--chart-1');
      const rawChart2 = getCssVariableValue('--chart-2');
      const rawChart3 = getCssVariableValue('--chart-3');
      const rawChart4 = getCssVariableValue('--chart-4');
      const rawChart5 = getCssVariableValue('--chart-5');
      const rawPrimary = getCssVariableValue('--primary');
      const rawPrimaryFg = getCssVariableValue('--primary-foreground');
      const rawSecondary = getCssVariableValue('--secondary');
      const rawSecondaryFg = getCssVariableValue('--secondary-foreground');
      const rawMuted = getCssVariableValue('--muted');
      const rawMutedFg = getCssVariableValue('--muted-foreground');
      const rawAccent = getCssVariableValue('--accent');
      const rawAccentFg = getCssVariableValue('--accent-foreground');
      const rawDestructive = getCssVariableValue('--destructive');
      const rawDestructiveFg = getCssVariableValue('--destructive-foreground');
      const rawBackground = getCssVariableValue('--background');
      const rawForeground = getCssVariableValue('--foreground');
      const rawSuccess = getCssVariableValue('--success');
      const rawWarning = getCssVariableValue('--warning');

      // --- تنسيق القيم باستخدام الدوال المساعدة --- VVV
      const currentColors: ChartColorConfig = {
        axis: formatHslString(rawAxis),
        grid: formatHslString(rawGrid),
        tooltipBg: formatHslString(rawTooltipBg),
        tooltipText: formatHslString(rawTooltipText),
        chart1: formatHslString(rawChart1),
        chart2: formatHslString(rawChart2),
        chart3: formatHslString(rawChart3),
        chart4: formatHslString(rawChart4),
        chart5: formatHslString(rawChart5),
        primary: formatHslString(rawPrimary),
        primaryForeground: formatHslString(rawPrimaryFg),
        secondary: formatHslString(rawSecondary),
        secondaryForeground: formatHslString(rawSecondaryFg),
        muted: formatHslString(rawMuted),
        mutedForeground: formatHslString(rawMutedFg),
        accent: formatHslString(rawAccent),
        accentForeground: formatHslString(rawAccentFg),
        destructive: formatHslString(rawDestructive),
        destructiveForeground: formatHslString(rawDestructiveFg),
        background: formatHslString(rawBackground),
        foreground: formatHslString(rawForeground),
        success: formatHslString(rawSuccess),
        warning: formatHslString(rawWarning),
        // Add alpha versions
        primary_75: formatHslaString(rawPrimary, 0.75),
        muted_50: formatHslaString(rawMuted, 0.50),
      };
      setChartColors(currentColors);
    }
  }, [resolvedTheme]);

  // Provide default fallbacks using functional hsl() format
  const memoizedColors = useMemo(() => ({
    axis: 'hsl(240, 5.3%, 45.1%)', // Fallback muted-foreground
    grid: 'hsl(0, 0%, 89.8%)',     // Fallback border
    tooltipBg: 'hsl(0, 0%, 100%)', // Fallback popover
    tooltipText: 'hsl(240, 5.3%, 26.1%)', // Fallback popover-foreground
    chart1: 'hsl(12, 76%, 61%)',   // Fallback chart-1
    chart2: 'hsl(173, 58%, 39%)',  // Fallback chart-2
    chart3: 'hsl(197, 37%, 24%)',  // Fallback chart-3
    chart4: 'hsl(43, 74%, 66%)',   // Fallback chart-4
    chart5: 'hsl(27, 87%, 67%)',   // Fallback chart-5
    primary: 'hsl(211, 57%, 45%)', // Fallback primary
    primaryForeground: 'hsl(0, 0%, 100%)', // Fallback primary-foreground
    secondary: 'hsl(0, 0%, 96.1%)', // Fallback secondary
    secondaryForeground: 'hsl(240, 5.3%, 26.1%)', // Fallback secondary-foreground
    muted: 'hsl(0, 0%, 96.1%)',     // Fallback muted
    mutedForeground: 'hsl(240, 5.3%, 45.1%)', // Fallback muted-foreground
    accent: 'hsl(157, 54%, 50%)',   // Fallback accent
    accentForeground: 'hsl(0, 0%, 100%)', // Fallback accent-foreground
    destructive: 'hsl(0, 84.2%, 60.2%)', // Fallback destructive
    destructiveForeground: 'hsl(0, 0%, 98%)', // Fallback destructive-foreground
    background: 'hsl(0, 0%, 96.1%)', // Fallback background
    foreground: 'hsl(240, 5.3%, 26.1%)', // Fallback foreground
    success: 'hsl(142.1, 76.2%, 36.3%)', // Fallback success
    warning: 'hsl(43.0, 96.0%, 50.0%)',  // Fallback warning
    primary_75: 'hsla(211, 57%, 45%, 0.75)', // Fallback alpha
    muted_50: 'hsla(0, 0%, 96.1%, 0.50)',   // Fallback alpha
    ...chartColors // Override defaults with computed values
  }), [chartColors]);

  return memoizedColors;
}
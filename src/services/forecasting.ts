// src/services/forecasting.ts
// Module 2: Forecasting Service for Project Grandeur (Enhanced with Stress Testing)

export interface ForecastParams {
  method: 'sma' | 'ema';
  window: number; // For SMA/EMA calculation
  horizon: number; // Number of future periods to forecast
  discipline?: 'hvac' | 'firefighting' | 'firealarm' | 'total';
}

export interface ForecastResult {
  historical: number[]; // Original data points
  forecast: number[]; // Forecasted values
  method: string;
  window: number;
  horizon: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: number; // 0-1 scale
  warnings?: string[]; // New: warnings for edge cases
  qualityScore?: number; // New: data quality assessment
}

export interface StressTestResult {
  testName: string;
  passed: boolean;
  dataQuality: number; // 0-1 scale
  recommendations: string[];
  performanceMetrics: {
    executionTime: number;
    memoryUsage?: number;
    dataPointsProcessed: number;
  };
}

// Enhanced SMA with stress testing
export function calculateSMA(data: (number | null)[], window: number): number[] {
  const cleanData = data.filter(x => x !== null) as number[];
  if (cleanData.length < window) {
    console.warn(`[Stress Test] Insufficient data for SMA: ${cleanData.length} points, window=${window}`);
    return [];
  }

  const sma: number[] = [];
  for (let i = window - 1; i < cleanData.length; i++) {
    const sum = cleanData.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
    sma.push(sum / window);
  }
  return sma;
}

// Enhanced EMA with stress testing
export function calculateEMA(data: (number | null)[], window: number): number[] {
  const cleanData = data.filter(x => x !== null) as number[];
  if (cleanData.length < 2) {
    console.warn(`[Stress Test] Insufficient data for EMA: ${cleanData.length} points`);
    return [];
  }

  const multiplier = 2 / (window + 1);
  let ema = [cleanData[0]];
  for (let i = 1; i < cleanData.length; i++) {
    const currentEMA = (cleanData[i] * multiplier) + (ema[i - 1] * (1 - multiplier));
    ema.push(currentEMA);
  }
  return ema;
}

// Enhanced forecast SMA with better edge case handling
export function forecastSMA(data: (number | null)[], horizon: number, window: number): number[] {
  const cleanData = data.filter(x => x !== null) as number[];
  if (cleanData.length < window) {
    console.error(`[Stress Test] Cannot forecast with insufficient data: ${cleanData.length} < ${window}`);
    return [];
  }

  // Calculate trend from last window values
  const recent = cleanData.slice(-window);
  const trend = recent.length > 1 ? recent[recent.length - 1] - recent[0] : 0;
  const avgSlope = trend / (recent.length - 1 || 1);

  const forecast: number[] = [];
  const lastValue = cleanData[cleanData.length - 1];
  for (let i = 1; i <= horizon; i++) {
    const predictedValue = lastValue + (avgSlope * i);
    // Prevent unrealistic forecasts (more than 50% change per period)
    const maxChange = lastValue * 0.5;
    const predictedChange = Math.abs(predictedValue - lastValue);
    if (predictedChange > maxChange) {
      console.warn(`[Stress Test] Unrealistic forecast detected: ${predictedChange} > ${maxChange}`);
      forecast.push(lastValue + (avgSlope > 0 ? maxChange : -maxChange));
    } else {
      forecast.push(predictedValue);
    }
  }
  return forecast;
}

// Enhanced forecast EMA with better edge case handling
export function forecastEMA(data: (number | null)[], horizon: number, window: number): number[] {
  const cleanData = data.filter(x => x !== null) as number[];
  if (cleanData.length < 2) {
    console.error(`[Stress Test] Cannot forecast EMA with insufficient data: ${cleanData.length} < 2`);
    return [];
  }

  // Calculate EMA of the data
  const ema = calculateEMA(cleanData, window);
  if (ema.length < 2) {
    console.warn(`[Stress Test] EMA calculation failed, using fallback`);
    return forecastSMA(data, horizon, 2); // Fallback to SMA
  }

  // Calculate trend from last two EMA values
  const recentEMA = ema.slice(-2);
  const slope = recentEMA[1] - recentEMA[0];

  const forecast: number[] = [];
  const lastEMA = ema[ema.length - 1];
  for (let i = 1; i <= horizon; i++) {
    const predictedValue = lastEMA + (slope * i);
    // Prevent negative forecasts for manpower
    if (predictedValue < 0) {
      console.warn(`[Stress Test] Negative forecast detected, capping at 0`);
      forecast.push(0);
    } else {
      forecast.push(predictedValue);
    }
  }
  return forecast;
}

// Enhanced trend detection with more sophisticated analysis
function detectTrend(data: number[]): 'increasing' | 'decreasing' | 'stable' {
  if (data.length < 3) return 'stable';

  // Use linear regression for better trend detection
  const n = data.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = data.reduce((a, b) => a + b, 0);
  const sumXY = data.reduce((sum, y, x) => sum + x * y, 0);
  const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  if (slope > 0.1) return 'increasing';
  if (slope < -0.1) return 'decreasing';
  return 'stable';
}

// Enhanced confidence calculation with data quality assessment
function calculateConfidence(data: number[]): number {
  if (data.length < 3) return 0.3; // Low confidence with insufficient data

  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
  const stdDev = Math.sqrt(variance);

  // Coefficient of variation (lower is better)
  const cv = mean !== 0 ? stdDev / Math.abs(mean) : 0;

  // Data consistency score
  const consistencyScore = Math.max(0, 1 - cv);

  // Data volume score
  const volumeScore = Math.min(1, data.length / 10); // Optimal with 10+ points

  // Outlier detection
  const q1 = data.sort((a, b) => a - b)[Math.floor(data.length * 0.25)];
  const q3 = data.sort((a, b) => a - b)[Math.floor(data.length * 0.75)];
  const iqr = q3 - q1;
  const outliers = data.filter(val => val < q1 - 1.5 * iqr || val > q3 + 1.5 * iqr).length;
  const outlierScore = Math.max(0, 1 - (outliers / data.length));

  return (consistencyScore * 0.4 + volumeScore * 0.3 + outlierScore * 0.3);
}

// Enhanced data quality assessment
function assessDataQuality(data: (number | null)[]): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  let score = 1.0;

  const nullCount = data.filter(x => x === null).length;
  const nullRatio = nullCount / data.length;

  if (nullRatio > 0.3) {
    warnings.push(`High null ratio: ${(nullRatio * 100).toFixed(1)}%`);
    score -= 0.3;
  }

  const cleanData = data.filter(x => x !== null) as number[];
  if (cleanData.length < 3) {
    warnings.push('Insufficient data points for reliable forecasting');
    score -= 0.5;
  }

  // Check for data gaps (consecutive nulls)
  let maxGap = 0;
  let currentGap = 0;
  data.forEach(val => {
    if (val === null) {
      currentGap++;
      maxGap = Math.max(maxGap, currentGap);
    } else {
      currentGap = 0;
    }
  });

  if (maxGap > 3) {
    warnings.push(`Large data gap detected: ${maxGap} consecutive missing points`);
    score -= 0.2;
  }

  // Check for unrealistic values
  const unrealistic = cleanData.filter(val => val < 0 || val > 1000).length;
  if (unrealistic > 0) {
    warnings.push(`${unrealistic} unrealistic values detected`);
    score -= 0.1;
  }

  return { score: Math.max(0, score), warnings };
}

// Main forecasting function with enhanced stress testing
export function forecastManpower(
  manpowerData: { dateString: string | null; hvacManpower: number | null; firefightingManpower: number | null; fireAlarmManpower: number | null; totalManpower: number | null }[],
  params: ForecastParams
): ForecastResult | null {
  const startTime = Date.now();

  if (!manpowerData || manpowerData.length === 0) {
    console.error('[Stress Test] No manpower data provided');
    return null;
  }

  const sortedData = manpowerData.sort((a, b) => (a.dateString || '').localeCompare(b.dateString || ''));

  const hvacData = sortedData.map(r => r.hvacManpower);
  const firefightingData = sortedData.map(r => r.firefightingManpower);
  const firealarmData = sortedData.map(r => r.fireAlarmManpower);
  const totalData = sortedData.map(r => r.totalManpower);

  const { method, window, horizon, discipline = 'total' } = params;

  // Select the appropriate dataset
  let selectedData: (number | null)[];
  switch (discipline.toLowerCase()) {
    case 'hvac':
      selectedData = hvacData;
      break;
    case 'firefighting':
      selectedData = firefightingData;
      break;
    case 'firealarm':
      selectedData = firealarmData;
      break;
    default:
      selectedData = totalData;
  }

  // Assess data quality
  const qualityAssessment = assessDataQuality(selectedData);

  const forecastFn = method === 'sma' ? forecastSMA : forecastEMA;
  const forecast = forecastFn(selectedData, horizon, window);

  if (forecast.length === 0) {
    console.error('[Stress Test] Forecast generation failed');
    return null;
  }

  const cleanData = selectedData.filter(x => x !== null) as number[];
  const result: ForecastResult = {
    historical: cleanData,
    forecast,
    method,
    window,
    horizon,
    trend: detectTrend(cleanData),
    confidence: calculateConfidence(cleanData),
    warnings: qualityAssessment.warnings,
    qualityScore: qualityAssessment.score
  };

  const executionTime = Date.now() - startTime;
  console.log(`[Stress Test] Forecast completed in ${executionTime}ms for ${cleanData.length} data points`);

  return result;
}

// Stress testing function
export function stressTestForecast(
  manpowerData: { dateString: string | null; hvacManpower: number | null; firefightingManpower: number | null; fireAlarmManpower: number | null; totalManpower: number | null }[],
  testCases: { name: string; params: ForecastParams; expectedFailure?: boolean }[]
): StressTestResult[] {
  const results: StressTestResult[] = [];

  testCases.forEach(testCase => {
    const startTime = Date.now();
    const result = forecastManpower(manpowerData, testCase.params);
    const executionTime = Date.now() - startTime;

    const passed = testCase.expectedFailure ? !result : !!result;
    const dataQuality = result ? (result.qualityScore || 0) : 0;
    const dataPoints = manpowerData.length;

    const recommendations: string[] = [];
    if (result?.warnings) {
      recommendations.push(...result.warnings.map(w => `Fix: ${w}`));
    }
    if (executionTime > 5000) {
      recommendations.push('Optimize: Execution time exceeds 5 seconds');
    }
    if (dataQuality < 0.5) {
      recommendations.push('Improve: Data quality is low, consider data cleansing');
    }

    results.push({
      testName: testCase.name,
      passed,
      dataQuality,
      recommendations,
      performanceMetrics: {
        executionTime,
        dataPointsProcessed: dataPoints
      }
    });
  });

  return results;
}

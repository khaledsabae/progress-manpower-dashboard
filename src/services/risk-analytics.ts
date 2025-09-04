// src/services/risk-analytics.ts
// Module 3: Risk Analytics Service

import { getRiskRegisterData, RiskRegisterItem } from './google-sheets';

export interface RiskData {
  riskId: string | null;
  riskDescription: string | null;
  systemFocus: string | null;
  likelyCauses: string | null;
  potentialImpactConsequence: string | null;
}

export interface RiskAnalysisParams {
  analysisType: 'system_correlation' | 'cause_impact' | 'severity_distribution';
  minSeverity?: number;
  systemFilter?: string;
}

export interface RiskCorrelation {
  source: string;
  target: string;
  correlationStrength: number; // 0-1
  riskCount: number;
  description: string;
}

export interface RiskAnalysisResult {
  analysisType: string;
  correlations: RiskCorrelation[];
  summary: {
    totalRisks: number;
    highSeverityRisks: number;
    systemDistribution: Record<string, number>;
    causeDistribution: Record<string, number>;
  };
  recommendations: string[];
}

// Analyze correlations between systems and risks
function analyzeSystemCorrelations(risks: RiskData[]): RiskCorrelation[] {
  const systemRisks: Record<string, RiskData[]> = {};

  // Group risks by system
  risks.forEach(risk => {
    const system = risk.systemFocus || 'Unknown';
    if (!systemRisks[system]) systemRisks[system] = [];
    systemRisks[system].push(risk);
  });

  const correlations: RiskCorrelation[] = [];
  const systems = Object.keys(systemRisks);

  // Calculate correlations between systems
  for (let i = 0; i < systems.length; i++) {
    for (let j = i + 1; j < systems.length; j++) {
      const system1 = systems[i];
      const system2 = systems[j];

      // Simple correlation based on shared causes
      const causes1 = new Set(systemRisks[system1].map(r => r.likelyCauses).filter(Boolean));
      const causes2 = new Set(systemRisks[system2].map(r => r.likelyCauses).filter(Boolean));

      const sharedCauses = new Set([...causes1].filter(cause => causes2.has(cause)));
      const correlationStrength = sharedCauses.size / Math.max(causes1.size, causes2.size, 1);

      if (correlationStrength > 0.1) {
        correlations.push({
          source: system1,
          target: system2,
          correlationStrength,
          riskCount: sharedCauses.size,
          description: `Shared ${sharedCauses.size} risk causes`
        });
      }
    }
  }

  return correlations.sort((a, b) => b.correlationStrength - a.correlationStrength);
}

// Analyze correlations between causes and impacts
function analyzeCauseImpactCorrelations(risks: RiskData[]): RiskCorrelation[] {
  const causeImpactMap: Record<string, { impacts: Set<string>; count: number }> = {};

  risks.forEach(risk => {
    const cause = risk.likelyCauses || 'Unknown Cause';
    const impact = risk.potentialImpactConsequence || 'Unknown Impact';

    if (!causeImpactMap[cause]) {
      causeImpactMap[cause] = { impacts: new Set(), count: 0 };
    }
    causeImpactMap[cause].impacts.add(impact);
    causeImpactMap[cause].count++;
  });

  const correlations: RiskCorrelation[] = [];

  Object.entries(causeImpactMap).forEach(([cause, data]) => {
    data.impacts.forEach(impact => {
      correlations.push({
        source: cause,
        target: impact,
        correlationStrength: 1, // Direct relationship
        riskCount: data.count,
        description: `${data.count} risks with this cause-impact relationship`
      });
    });
  });

  return correlations.slice(0, 10); // Top 10
}

// Analyze severity distribution
function analyzeSeverityDistribution(risks: RiskData[]): { high: number; medium: number; low: number } {
  let high = 0, medium = 0, low = 0;

  risks.forEach(risk => {
    const description = (risk.riskDescription || '').toLowerCase();
    if (description.includes('high') || description.includes('critical') || description.includes('severe')) {
      high++;
    } else if (description.includes('medium') || description.includes('moderate')) {
      medium++;
    } else {
      low++;
    }
  });

  return { high, medium, low };
}

interface RiskAnalysisSummary {
  totalRisks: number;
  highSeverityRisks: number;
  systemDistribution: Record<string, number>;
  causeDistribution: Record<string, number>;
}

// Generate recommendations based on analysis
function generateRecommendations(correlations: RiskCorrelation[], summary: RiskAnalysisSummary): string[] {
  const recommendations: string[] = [];

  if (correlations.length > 0) {
    const topCorrelation = correlations[0];
    recommendations.push(
      `Focus on ${topCorrelation.source} and ${topCorrelation.target} systems as they share ${topCorrelation.riskCount} common risk factors.`
    );
  }

  const highRiskPercentage = (summary.highSeverityRisks / summary.totalRisks) * 100;
  if (highRiskPercentage > 30) {
    recommendations.push(
      `High-priority risks constitute ${highRiskPercentage.toFixed(1)}% of total risks. Prioritize mitigation efforts.`
    );
  }

  const dominantSystem = Object.entries(summary.systemDistribution)
    .sort(([, a], [, b]) => b - a)[0];

  if (dominantSystem) {
    recommendations.push(
      `${dominantSystem[0]} system has the highest risk concentration (${dominantSystem[1]} risks). Consider focused risk management.`
    );
  }

  return recommendations;
}

// Main risk analysis function
export function analyzeRisks(
  riskData: RiskData[],
  params: RiskAnalysisParams
): RiskAnalysisResult | null {
  if (!riskData || riskData.length === 0) return null;

  // Filter by system if specified
  let filteredRisks = riskData;
  if (params.systemFilter) {
    filteredRisks = riskData.filter(risk =>
      (risk.systemFocus || '').toLowerCase().includes(params.systemFilter!.toLowerCase())
    );
  }

  let correlations: RiskCorrelation[] = [];

  switch (params.analysisType) {
    case 'system_correlation':
      correlations = analyzeSystemCorrelations(filteredRisks);
      break;
    case 'cause_impact':
      correlations = analyzeCauseImpactCorrelations(filteredRisks);
      break;
    case 'severity_distribution':
      // For severity, we'll create correlations based on severity levels
      const severity = analyzeSeverityDistribution(filteredRisks);
      correlations = [
        {
          source: 'High Severity',
          target: 'Critical Systems',
          correlationStrength: severity.high / filteredRisks.length,
          riskCount: severity.high,
          description: `${severity.high} high-severity risks identified`
        }
      ];
      break;
  }

  // Calculate system distribution
  const systemDistribution: Record<string, number> = {};
  filteredRisks.forEach(risk => {
    const system = risk.systemFocus || 'Unknown';
    systemDistribution[system] = (systemDistribution[system] || 0) + 1;
  });

  // Calculate cause distribution
  const causeDistribution: Record<string, number> = {};
  filteredRisks.forEach(risk => {
    const cause = risk.likelyCauses || 'Unknown';
    causeDistribution[cause] = (causeDistribution[cause] || 0) + 1;
  });

  const severity = analyzeSeverityDistribution(filteredRisks);

  const summary = {
    totalRisks: filteredRisks.length,
    highSeverityRisks: severity.high,
    systemDistribution,
    causeDistribution
  };

  const recommendations = generateRecommendations(correlations, summary);

  return {
    analysisType: params.analysisType,
    correlations,
    summary,
    recommendations
  };
}

// Detect risks function for /detectrisks command
export async function detectRisks(): Promise<{
  total: number;
  high: number;
  medium: number;
  low: number;
  open: number;
  closed: number;
  recommendation: string;
} | null> {
  try {
    const riskData = await getRiskRegisterData();
    if (!riskData || riskData.length === 0) return null;

    let high = 0, medium = 0, low = 0;
    let open = 0, closed = 0;

    riskData.forEach(risk => {
      // Classify severity
      const desc = (risk.riskDescription || '').toLowerCase();
      const level = (risk.riskLevelScore || '').toLowerCase();
      const severity = (risk.severityImpactLevel || '').toLowerCase();

      if (desc.includes('high') || desc.includes('critical') || level.includes('high') || severity.includes('high')) {
        high++;
      } else if (desc.includes('medium') || desc.includes('moderate') || level.includes('medium') || severity.includes('medium')) {
        medium++;
      } else {
        low++;
      }

      // Classify status
      const status = (risk.status || '').toLowerCase();
      if (status.includes('open') || status.includes('active')) {
        open++;
      } else if (status.includes('closed') || status.includes('mitigated')) {
        closed++;
      }
    });

    const total = riskData.length;

    // Generate recommendation
    let recommendation = '';
    if (high > 0) {
      const highPercent = (high / total) * 100;
      if (highPercent > 50) {
        recommendation = 'عالية جداً: يتطلب انتباه فوري للمخاطر ذات الشدة العالية.';
      } else if (highPercent > 20) {
        recommendation = 'عالية: ركز على تقليل المخاطر ذات الشدة العالية.';
      } else {
        recommendation = 'معتدلة: راقب المخاطر ذات الشدة العالية.';
      }
    } else {
      recommendation = 'منخفضة: المخاطر تحت السيطرة.';
    }

    return {
      total,
      high,
      medium,
      low,
      open,
      closed,
      recommendation
    };
  } catch (error) {
    console.error('[detectRisks] Error:', error);
    return null;
  }
}

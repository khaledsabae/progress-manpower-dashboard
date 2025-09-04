// src/services/autonomous-insights.ts
// Module: Autonomous Insights - Proactive Analysis and Notifications

import { getManpowerSheetData, SHEET_NAMES } from './google-sheets';
import { forecastManpower, ForecastParams } from './forecasting';
import { analyzeRisks, RiskAnalysisParams } from './risk-analytics';

export interface ProactiveNotification {
  id: string;
  type: 'critical_risk' | 'workforce_shortage' | 'trend_alert' | 'system_warning';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  recommendations: string[];
  data: any;
  timestamp: number;
  acknowledged: boolean;
  expiresAt?: number;
}

export interface AutonomousAnalysisResult {
  timestamp: number;
  duration: number;
  notifications: ProactiveNotification[];
  summary: {
    risksAnalyzed: number;
    forecastsGenerated: number;
    criticalAlerts: number;
    recommendationsCount: number;
  };
}

// In-memory storage for notifications (in production, use database)
let notifications: ProactiveNotification[] = [];
const MAX_NOTIFICATIONS = 100;

// Generate unique notification ID
function generateNotificationId(): string {
  return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Create notification for critical risk
function createCriticalRiskNotification(
  riskData: any,
  analysisType: string,
  severity: 'high' | 'critical'
): ProactiveNotification {
  const title = severity === 'critical'
    ? '🚨 خطر حرج مكتشف في النظام'
    : '⚠️ خطر عالي يتطلب انتباه فوري';

  const recommendations = riskData.recommendations || [
    'مراجعة النظام المعرض للخطر',
    'تطبيق الإجراءات الوقائية المقترحة',
    'جدولة اجتماع طوارئ للمناقشة'
  ];

  return {
    id: generateNotificationId(),
    type: 'critical_risk',
    severity,
    title,
    message: `تم اكتشاف ${analysisType} في ${riskData.source || 'نظام غير محدد'}. مستوى الخطر: ${severity.toUpperCase()}`,
    recommendations,
    data: riskData,
    timestamp: Date.now(),
    acknowledged: false,
    expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
  };
}

// Create notification for workforce shortage
function createWorkforceShortageNotification(
  forecastData: any,
  discipline: string,
  shortageLevel: 'moderate' | 'severe'
): ProactiveNotification {
  const title = shortageLevel === 'severe'
    ? '🚨 نقص حاد متوقع في القوى العاملة'
    : '⚠️ نقص متوقع في القوى العاملة';

  const nextValue = forecastData.forecast?.[0] || 0;
  const recommendations = [
    `تخطيط لتوظيف ${Math.max(5, Math.ceil((forecastData.historical?.slice(-1)[0] || 0) - nextValue))} شخص إضافي`,
    'مراجعة جدولة المشاريع لتجنب التأخير',
    'تقييم إمكانية إعادة التوزيع من أنظمة أخرى'
  ];

  return {
    id: generateNotificationId(),
    type: 'workforce_shortage',
    severity: shortageLevel === 'severe' ? 'high' : 'medium',
    title,
    message: `التوقع يشير إلى نقص ${shortageLevel === 'severe' ? 'حاد' : 'متوسط'} في ${discipline.toUpperCase()}. القيمة المتوقعة: ${nextValue.toFixed(1)}`,
    recommendations,
    data: { ...forecastData, discipline },
    timestamp: Date.now(),
    acknowledged: false,
    expiresAt: Date.now() + (3 * 24 * 60 * 60 * 1000) // 3 days
  };
}

// Create notification for trend alerts
function createTrendAlertNotification(
  trendData: any,
  trendType: 'increasing' | 'decreasing',
  discipline: string
): ProactiveNotification {
  const title = trendType === 'increasing'
    ? '📈 اتجاه إيجابي مستمر في القوى العاملة'
    : '📉 اتجاه سلبي مستمر في القوى العاملة';

  const recommendations = trendType === 'increasing'
    ? [
      'الاستفادة من الزيادة في التوسع المخطط',
      'تقييم إمكانية تسريع المشاريع',
      'مراجعة كفاءة الاستخدام الحالية'
    ]
    : [
      'تقييم أسباب الانخفاض في القوى العاملة',
      'تطوير خطة لتعويض النقص',
      'مراجعة جدولة المشاريع لتجنب التأخير'
    ];

  return {
    id: generateNotificationId(),
    type: 'trend_alert',
    severity: 'medium',
    title,
    message: `اتجاه ${trendType === 'increasing' ? 'تصاعدي' : 'تنازلي'} مستمر في ${discipline.toUpperCase()} لمدة ${trendData.period || 'فترة طويلة'}.`,
    recommendations,
    data: { ...trendData, discipline, trendType },
    timestamp: Date.now(),
    acknowledged: false,
    expiresAt: Date.now() + (14 * 24 * 60 * 60 * 1000) // 14 days
  };
}

// Analyze risks and generate notifications
async function analyzeRisksAndNotify(): Promise<ProactiveNotification[]> {
  const notifications: ProactiveNotification[] = [];

  try {
    // In a real implementation, we would fetch risk data from database
    // For now, we'll simulate with mock data
    const mockRiskData = [
      {
        riskId: 'R001',
        riskDescription: 'عدم كفاية القوى العاملة للمشاريع الجديدة',
        systemFocus: 'HVAC',
        likelyCauses: 'نقص في التدريب',
        potentialImpactConsequence: 'تأخير في التسليم',
        severity: 'high' as const
      },
      {
        riskId: 'R002',
        riskDescription: 'مشاكل في سلسلة التوريد',
        systemFocus: 'Firefighting',
        likelyCauses: 'مشاكل لوجستية',
        potentialImpactConsequence: 'توقف المشروع',
        severity: 'critical' as const
      }
    ];

    mockRiskData.forEach(risk => {
      if (risk.severity === 'critical' || risk.severity === 'high') {
        notifications.push(createCriticalRiskNotification(
          risk,
          risk.systemFocus || 'Unknown System',
          risk.severity
        ));
      }
    });

  } catch (error) {
    console.error('[Autonomous] Error in risk analysis:', error);
  }

  return notifications;
}

// Analyze forecasts and generate notifications
async function analyzeForecastsAndNotify(): Promise<ProactiveNotification[]> {
  const notifications: ProactiveNotification[] = [];

  try {
    const manpowerData = await getManpowerSheetData(SHEET_NAMES.MANPOWER);
    if (!manpowerData || manpowerData.length === 0) {
      console.warn('[Autonomous] No manpower data available for forecasting');
      return notifications;
    }

    const disciplines = ['hvac', 'firefighting', 'firealarm', 'total'] as const;

    for (const discipline of disciplines) {
      const params: ForecastParams = {
        method: 'ema',
        window: 7,
        horizon: 4,
        discipline
      };

      const forecastResult = forecastManpower(manpowerData, params);
      if (!forecastResult) continue;

      const nextForecast = forecastResult.forecast[0] || 0;
      const lastHistorical = forecastResult.historical[forecastResult.historical.length - 1] || 0;
      const change = ((nextForecast - lastHistorical) / lastHistorical) * 100;

      // Check for severe workforce shortage
      if (change < -20) { // More than 20% decrease
        notifications.push(createWorkforceShortageNotification(
          forecastResult,
          discipline,
          'severe'
        ));
      } else if (change < -10) { // More than 10% decrease
        notifications.push(createWorkforceShortageNotification(
          forecastResult,
          discipline,
          'moderate'
        ));
      }

      // Check for significant trends
      if (forecastResult.trend === 'increasing' && change > 15) {
        notifications.push(createTrendAlertNotification(
          forecastResult,
          'increasing',
          discipline
        ));
      } else if (forecastResult.trend === 'decreasing' && change < -15) {
        notifications.push(createTrendAlertNotification(
          forecastResult,
          'decreasing',
          discipline
        ));
      }
    }

  } catch (error) {
    console.error('[Autonomous] Error in forecast analysis:', error);
  }

  return notifications;
}

// Main autonomous analysis function
export async function runAutonomousAnalysis(): Promise<AutonomousAnalysisResult> {
  const startTime = Date.now();
  console.log('[Autonomous] Starting daily analysis...');

  const riskNotifications = await analyzeRisksAndNotify();
  const forecastNotifications = await analyzeForecastsAndNotify();

  const allNotifications = [...riskNotifications, ...forecastNotifications];

  // Add new notifications (avoid duplicates)
  allNotifications.forEach(notification => {
    const existing = notifications.find(n =>
      n.type === notification.type &&
      n.data?.source === notification.data?.source &&
      !n.acknowledged
    );

    if (!existing) {
      notifications.unshift(notification); // Add to beginning
    }
  });

  // Clean up old notifications
  const now = Date.now();
  notifications = notifications.filter(n =>
    !n.expiresAt || n.expiresAt > now
  ).slice(0, MAX_NOTIFICATIONS); // Keep only recent ones

  const duration = Date.now() - startTime;

  const result: AutonomousAnalysisResult = {
    timestamp: now,
    duration,
    notifications: allNotifications,
    summary: {
      risksAnalyzed: riskNotifications.length,
      forecastsGenerated: forecastNotifications.length,
      criticalAlerts: allNotifications.filter(n => n.severity === 'critical').length,
      recommendationsCount: allNotifications.reduce((sum, n) => sum + n.recommendations.length, 0)
    }
  };

  console.log(`[Autonomous] Analysis completed in ${duration}ms. Generated ${allNotifications.length} notifications.`);
  return result;
}

// Get active notifications
export function getActiveNotifications(): ProactiveNotification[] {
  const now = Date.now();
  return notifications.filter(n =>
    !n.acknowledged &&
    (!n.expiresAt || n.expiresAt > now)
  );
}

// Acknowledge notification
export function acknowledgeNotification(notificationId: string): boolean {
  const notification = notifications.find(n => n.id === notificationId);
  if (notification) {
    notification.acknowledged = true;
    return true;
  }
  return false;
}

// Get notification summary
export function getNotificationSummary(): {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  recent: ProactiveNotification[];
} {
  const active = getActiveNotifications();
  const recent = active.slice(0, 5); // Last 5 notifications

  return {
    total: active.length,
    critical: active.filter(n => n.severity === 'critical').length,
    high: active.filter(n => n.severity === 'high').length,
    medium: active.filter(n => n.severity === 'medium').length,
    low: active.filter(n => n.severity === 'low').length,
    recent
  };
}

// Initialize autonomous analysis (call this when the app starts)
export function initializeAutonomousAnalysis() {
  // Run initial analysis
  runAutonomousAnalysis().catch(console.error);

  // Set up daily analysis (every 24 hours)
  const interval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  setInterval(() => {
    runAutonomousAnalysis().catch(console.error);
  }, interval);

  console.log('[Autonomous] Initialized daily analysis system');
}

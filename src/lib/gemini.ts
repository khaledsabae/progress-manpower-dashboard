import { GoogleGenerativeAI } from '@google/generative-ai';
import { withTimeout, AI_INSIGHTS_TIMEOUT_MS, isTimeoutError, TimeoutError } from '@/lib/http/timeout';

export interface ProjectData {
  manpower?: Record<string, any>[];
  mechanicalPlan?: Record<string, any>[];
  riskRegister?: Record<string, any>[];
  [key: string]: any; // Allow for additional dynamic properties
}

interface AIInsights {
  predictedCompletionDate: string;
  summaryReport: string;
  recommendations: string[];
  riskAnalysis: string;
}

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  async generateInsights(projectData: ProjectData): Promise<AIInsights> {
    try {
      const prompt = this.buildAnalysisPrompt(projectData);
      const result = await withTimeout(this.model.generateContent(prompt), AI_INSIGHTS_TIMEOUT_MS, 'generateContent') as any;
      const response = await result.response;
      const text = response.text();

      return this.parseAIResponse(text);
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new TimeoutError('AI insights generation timed out', AI_INSIGHTS_TIMEOUT_MS, 'generateContent', error);
      }
      console.error('Error generating AI insights:', error);
      throw new Error('Failed to generate AI insights');
    }
  }

  private buildAnalysisPrompt(data: ProjectData): string {
    // Provide empty arrays as defaults for missing data
    const manpowerData = data.manpower || [];
    const mechanicalPlanData = data.mechanicalPlan || [];
    const riskData = data.riskRegister || [];
    
    const manpowerSummary = this.summarizeManpower(manpowerData);
    const progressSummary = this.summarizeProgress(mechanicalPlanData);
    const riskSummary = this.summarizeRisks(riskData);

    return `
تحليل بيانات المشروع والتنبؤ بتاريخ الإنجاز:

بيانات القوى العاملة:
${manpowerSummary}

بيانات التقدم في المشروع:
${progressSummary}

بيانات المخاطر:
${riskSummary}

المطلوب:
1. تحليل التقدم الحالي للمشروع
2. التنبؤ بتاريخ الإنجاز المتوقع بناءً على البيانات الحالية
3. تحديد المخاطر الرئيسية وتأثيرها على الجدول الزمني
4. تقديم توصيات لتحسين الأداء

يرجى تقديم الإجابة بالتنسيق التالي:
COMPLETION_DATE: [التاريخ المتوقع]
SUMMARY: [ملخص حالة المشروع]
RECOMMENDATIONS: [التوصيات مفصولة بـ |]
RISK_ANALYSIS: [تحليل المخاطر]
    `;
  }

  private summarizeManpower(manpower: Record<string, any>[]): string {
    if (!manpower || manpower.length === 0) return 'لا توجد بيانات للقوى العاملة';

    const totalPlanned = manpower.reduce((sum, item) => {
      const value = item['Total Planned'] || item['المخطط الإجمالي'] || 0;
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);
    
    const totalActual = manpower.reduce((sum, item) => {
      const value = item['Total Actual'] || item['الفعلي الإجمالي'] || 0;
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);
    
    const totalUtilization = manpower.reduce((sum, item) => {
      const value = item['Utilization %'] || item['نسبة الاستخدام'] || 0;
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);
    
    const avgUtilization = manpower.length > 0 ? totalUtilization / manpower.length : 0;

    return `إجمالي المخطط: ${totalPlanned}، إجمالي الفعلي: ${totalActual}، متوسط الاستخدام: ${avgUtilization.toFixed(1)}%`;
  }

  private summarizeProgress(mechanicalPlan: Record<string, any>[]): string {
    if (!mechanicalPlan || mechanicalPlan.length === 0) return 'لا توجد بيانات للتقدم';

    const totalProgress = mechanicalPlan.reduce((sum, item) => {
      const value = item['Progress %'] || item['نسبة الإنجاز'] || 0;
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);
    
    const avgProgress = mechanicalPlan.length > 0 ? totalProgress / mechanicalPlan.length : 0;
    
    const completedTasks = mechanicalPlan.filter(item => {
      const progress = item['Progress %'] || item['نسبة الإنجاز'] || 0;
      return (typeof progress === 'number' ? progress : 0) >= 100;
    }).length;
    
    const totalTasks = mechanicalPlan.length;

    return `متوسط التقدم: ${avgProgress.toFixed(1)}%، المهام المكتملة: ${completedTasks}/${totalTasks}`;
  }

  private summarizeRisks(riskRegister: Record<string, any>[]): string {
    if (!riskRegister || riskRegister.length === 0) return 'لا توجد مخاطر مسجلة';

    const getRiskScore = (risk: Record<string, any>): number => {
      const score = risk['Risk Score'] || risk['درجة المخاطرة'] || 0;
      return typeof score === 'number' ? score : 0;
    };

    const highRisks = riskRegister.filter(risk => getRiskScore(risk) >= 15).length;
    const mediumRisks = riskRegister.filter(risk => {
      const score = getRiskScore(risk);
      return score >= 8 && score < 15;
    }).length;
    const lowRisks = riskRegister.filter(risk => getRiskScore(risk) < 8).length;

    return `المخاطر العالية: ${highRisks}، المتوسطة: ${mediumRisks}، المنخفضة: ${lowRisks}`;
  }

  private parseAIResponse(text: string): AIInsights {
    const lines = text.split('\n');
    let predictedCompletionDate = '';
    let summaryReport = '';
    let recommendations: string[] = [];
    let riskAnalysis = '';

    for (const line of lines) {
      if (line.startsWith('COMPLETION_DATE:')) {
        predictedCompletionDate = line.replace('COMPLETION_DATE:', '').trim();
      } else if (line.startsWith('SUMMARY:')) {
        summaryReport = line.replace('SUMMARY:', '').trim();
      } else if (line.startsWith('RECOMMENDATIONS:')) {
        const recText = line.replace('RECOMMENDATIONS:', '').trim();
        recommendations = recText.split('|').map(r => r.trim()).filter(r => r.length > 0);
      } else if (line.startsWith('RISK_ANALYSIS:')) {
        riskAnalysis = line.replace('RISK_ANALYSIS:', '').trim();
      }
    }

    // Fallback values if parsing fails
    return {
      predictedCompletionDate: predictedCompletionDate || 'غير محدد',
      summaryReport: summaryReport || 'تحليل غير متوفر',
      recommendations: recommendations.length > 0 ? recommendations : ['لا توجد توصيات متاحة'],
      riskAnalysis: riskAnalysis || 'تحليل المخاطر غير متوفر'
    };
  }
}

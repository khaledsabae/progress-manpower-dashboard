// src/services/grandeur.ts
// Project Grandeur: Command Router (Complete Implementation)

import { getManpowerSheetData, getProgressSheetData, getMaterialStatusData, getMechanicalPlanData, getRiskRegisterData, SHEET_NAMES } from './google-sheets';
import { forecastManpower, ForecastParams } from './forecasting';
import { detectRisks, analyzeRisks, RiskAnalysisParams } from './risk-analytics';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Setup Gemini
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set.");
}
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

export interface ParsedCommand {
  command: string;
  args: Record<string, string>;
}

export interface GrandeurCommandResult {
  success: boolean;
  data?: any;
  message: string;
}

/**
 * Parses a slash command into command and arguments.
 * @param input The input string starting with '/'
 * @returns ParsedCommand object
 */
export function parseSlashCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) {
    throw new Error('Command must start with /');
  }
  const parts = trimmed.slice(1).split(/\s+/);
  const command = parts[0].toLowerCase();
  const args: Record<string, string> = {};
  
  if (command === 'ask') {
    args['query'] = trimmed.slice(trimmed.indexOf('/ask') + 4).trim();
  } else {
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const eqIndex = part.indexOf('=');
      if (eqIndex > 0) {
        const key = part.slice(0, eqIndex).trim();
        const value = part.slice(eqIndex + 1).trim();
        args[key] = value;
      }
    }
  }
  
  return { command, args };
}

// Extract keywords from query
function extractKeywords(query: string): string[] {
  const words = query.toLowerCase().split(/\s+/);
  const keywords = ['manpower', 'risk', 'hvac', 'firefighting', 'firealarm', 'progress', 'material', 'plan', 'mechanical'];
  return keywords.filter(k => words.includes(k));
}

// Retrieve context for ask
async function retrieveContextForAsk(query: string): Promise<string> {
  const keywords = extractKeywords(query);
  let context = '';

  if (keywords.includes('manpower')) {
    try {
      const data = await getManpowerSheetData(SHEET_NAMES.MANPOWER);
      if (data && data.length > 0) {
        const recent = data.slice(-5).map(r => `Date: ${r.dateString}, HVAC: ${r.hvacManpower}, Firefighting: ${r.firefightingManpower}, Total: ${r.totalManpower}`).join('\n');
        context += `Manpower Data (last 5 entries):\n${recent}\n`;
      }
    } catch (e) {
      console.error('[retrieveContextForAsk] Error fetching manpower:', e);
    }
  }

  if (keywords.includes('risk')) {
    try {
      const data = await getRiskRegisterData();
      if (data && data.length > 0) {
        const recent = data.slice(0,5).map(r => `Risk: ${r.riskDescription}, System: ${r.systemFocus}, Severity: ${r.severityImpactLevel}`).join('\n');
        context += `Risk Data (first 5 entries):\n${recent}\n`;
      }
    } catch (e) {
      console.error('[retrieveContextForAsk] Error fetching risk:', e);
    }
  }

  if (keywords.includes('progress')) {
    try {
      const data = await getProgressSheetData(SHEET_NAMES.PROGRESS);
      if (data && data.length > 0) {
        const recent = data.slice(0,5).map(r => `Building: ${r.buildingName}, HVAC: ${r.hvacPercentage}%, Firefighting: ${r.firefightingPercentage}%`).join('\n');
        context += `Progress Data (first 5 entries):\n${recent}\n`;
      }
    } catch (e) {
      console.error('[retrieveContextForAsk] Error fetching progress:', e);
    }
  }

  if (keywords.includes('material')) {
    try {
      const data = await getMaterialStatusData(SHEET_NAMES.MATERIAL);
      if (data && data.length > 0) {
        const recent = data.slice(0,5).map(r => `Item: ${r.itemDescription}, Status: ${r.deliveryStatus}`).join('\n');
        context += `Material Data (first 5 entries):\n${recent}\n`;
      }
    } catch (e) {
      console.error('[retrieveContextForAsk] Error fetching material:', e);
    }
  }

  if (keywords.includes('plan') || keywords.includes('mechanical')) {
    try {
      const data = await getMechanicalPlanData(SHEET_NAMES.PLAN);
      if (data && data.length > 0) {
        const recent = data.slice(0,5).map(r => `Activity: ${r.mechanicalActivitySystem}, Start: ${r.calculatedStartDateString}`).join('\n');
        context += `Plan Data (first 5 entries):\n${recent}\n`;
      }
    } catch (e) {
      console.error('[retrieveContextForAsk] Error fetching plan:', e);
    }
  }

  return context || 'No relevant data found.';
}

/**
 * Executes a grandeur command based on the parsed command.
 * @param params Object containing command, args, and locale
 * @returns Promise<GrandeurCommandResult>
 */
export async function executeGrandeurCommand(params: {
  command: string;
  args: Record<string, string>;
  locale: 'en' | 'ar';
  history?: { role: string; content: string }[];
}): Promise<GrandeurCommandResult> {
  const { command, args, locale, history } = params;

  try {
    switch (command) {
      case 'help':
        return {
          success: true,
          message: locale === 'ar' 
            ? 'أوامر Project Grandeur:\n/help - عرض هذه المساعدة\n/forecast method=sma window=7 horizon=4 discipline=hvac - توقع القوى العاملة\n/status - حالة النظام\n/version - إصدار النظام'
            : 'Project Grandeur Commands:\n/help - Show help\n/forecast method=sma window=7 horizon=4 discipline=hvac - Forecast manpower\n/status - System status\n/version - System version'
        };

      case 'forecast':
      case 'forecastmanpower':
        const method = args.method || 'sma';
        const window = parseInt(args.window || '7');
        const horizon = parseInt(args.horizon || '4');
        const discipline = (args.discipline || 'total').toLowerCase();

        if (!['sma', 'ema'].includes(method)) {
          return {
            success: false,
            message: locale === 'ar' ? 'طريقة التوقع غير صحيحة. استخدم sma أو ema' : 'Invalid forecast method. Use sma or ema'
          };
        }

        if (isNaN(window) || window < 2 || window > 50) {
          return {
            success: false,
            message: locale === 'ar' ? 'نافذة التوقع يجب أن تكون بين 2 و 50' : 'Window must be between 2 and 50'
          };
        }

        if (isNaN(horizon) || horizon < 1 || horizon > 12) {
          return {
            success: false,
            message: locale === 'ar' ? 'الأفق يجب أن يكون بين 1 و 12' : 'Horizon must be between 1 and 12'
          };
        }

        const manpowerData = await getManpowerSheetData(SHEET_NAMES.MANPOWER);
        if (!manpowerData || manpowerData.length === 0) {
          return {
            success: false,
            message: locale === 'ar' ? 'لا توجد بيانات قوى عاملة متاحة' : 'No manpower data available'
          };
        }

        const selectedDiscipline = (discipline === 'hvac' ? 'hvac' :
          discipline === 'firefighting' ? 'firefighting' :
          discipline === 'firealarm' ? 'firealarm' : 'total') as 'hvac' | 'firefighting' | 'firealarm' | 'total';

        const forecastParams: ForecastParams = { method: method as 'sma' | 'ema', window, horizon, discipline: selectedDiscipline };
        const forecastResult = forecastManpower(manpowerData, forecastParams);

        if (!forecastResult) {
          return {
            success: false,
            message: locale === 'ar' ? 'فشل في حساب التوقع' : 'Failed to calculate forecast'
          };
        }

        const discData = forecastResult;
        const lastHistorical = discData.historical[discData.historical.length - 1] || 0;
        const nextForecast = discData.forecast[0] || 0;
        const change = nextForecast - lastHistorical;
        const changePercent = lastHistorical !== 0 ? ((change / lastHistorical) * 100).toFixed(1) : '0';

        const message = locale === 'ar'
          ? `توقع ${selectedDiscipline.toUpperCase()} (${method.toUpperCase()}):\nآخر قيمة تاريخية: ${lastHistorical}\nالتوقع التالي: ${nextForecast.toFixed(1)}\nالتغيير: ${change >= 0 ? '+' : ''}${change.toFixed(1)} (${change >= 0 ? '+' : ''}${changePercent}%)\nالاتجاه: ${discData.trend === 'increasing' ? 'متزايد' : discData.trend === 'decreasing' ? 'متناقص' : 'مستقر'}\nالثقة: ${(discData.confidence * 100).toFixed(0)}%`
          : `${selectedDiscipline.toUpperCase()} Forecast (${method.toUpperCase()}):\nLast historical: ${lastHistorical}\nNext forecast: ${nextForecast.toFixed(1)}\nChange: ${change >= 0 ? '+' : ''}${change.toFixed(1)} (${change >= 0 ? '+' : ''}${changePercent}%)\nTrend: ${discData.trend}\nConfidence: ${(discData.confidence * 100).toFixed(0)}%`;

        return {
          success: true,
          data: { type: 'forecastResult', data: discData, discipline: selectedDiscipline },
          message
        };

      case 'status':
        return {
          success: true,
          message: locale === 'ar' ? 'حالة النظام: نشط' : 'System status: Active'
        };

      case 'version':
        return {
          success: true,
          message: 'Project Grandeur v1.0.0'
        };

      case 'detectrisks':
        const riskAnalysis = await detectRisks();
        if (!riskAnalysis) {
          return {
            success: false,
            message: locale === 'ar' ? 'لا توجد بيانات مخاطر متاحة' : 'No risk data available'
          };
        }
        // Add correlations
        const riskData = await getRiskRegisterData(SHEET_NAMES.RISK_REGISTER);
        const correlationsResult = riskData ? analyzeRisks(riskData, { analysisType: 'system_correlation' }) : null;
        const correlationsText = correlationsResult && correlationsResult.correlations.length > 0
          ? (locale === 'ar' ? '\nالارتباطات:' : '\nCorrelations:') + correlationsResult.correlations.slice(0,3).map(c => ` ${c.source} -> ${c.target} (${(c.correlationStrength * 100).toFixed(0)}%)`).join('') + (correlationsResult.correlations.length > 3 ? '...' : '')
          : '';
        const riskMessage = locale === 'ar'
          ? `تحليل المخاطر:\nإجمالي المخاطر: ${riskAnalysis.total}\nشدة عالية: ${riskAnalysis.high}\nشدة متوسطة: ${riskAnalysis.medium}\nشدة منخفضة: ${riskAnalysis.low}\nمفتوحة: ${riskAnalysis.open}\nمغلقة: ${riskAnalysis.closed}\nالتوصية: ${riskAnalysis.recommendation}${correlationsText}`
          : `Risk Analysis:\nTotal Risks: ${riskAnalysis.total}\nHigh Severity: ${riskAnalysis.high}\nMedium Severity: ${riskAnalysis.medium}\nLow Severity: ${riskAnalysis.low}\nOpen: ${riskAnalysis.open}\nClosed: ${riskAnalysis.closed}\nRecommendation: ${riskAnalysis.recommendation}${correlationsText}`;
        return {
          success: true,
          message: riskMessage
        };

      case 'chatcontext':
      case 'ask':
        const query = args.query;
        if (!query) {
          return {
            success: false,
            message: locale === 'ar' ? 'يرجى تقديم سؤال بعد /ask' : 'Please provide a question after /ask'
          };
        }
        try {
          const context = await retrieveContextForAsk(query);
          let historyText = '';
          if (history && history.length > 0) {
            historyText = 'Conversation history:\n' + history.slice(-5).map(h => `${h.role === 'bot' ? 'assistant' : h.role}: ${h.content}`).join('\n') + '\n';
          }
          const prompt = `You are a mechanical engineer assistant for the Mowaih Power Plant project. Based on the following context from project data, answer the user's question concisely. If the context doesn't contain the information, say so. Include the data source in your answer.

${historyText}Context:
${context}

Question: ${query}

Answer:`;
          const response = await model.generateContent(prompt);
          const answer = response.response.text();
          return {
            success: true,
            message: answer
          };
        } catch (e) {
          console.error('[ask] Error:', e);
          return {
            success: false,
            message: locale === 'ar' ? 'خطأ في معالجة السؤال' : 'Error processing question'
          };
        };

      default:
        return {
          success: false,
          message: locale === 'ar' ? `الأمر غير معروف: ${command}` : `Unknown command: ${command}`
        };
    }
  } catch (error) {
    console.error('[Grandeur Command Error]', error);
    return {
      success: false,
      message: locale === 'ar' ? 'خطأ في تنفيذ الأمر' : 'Error executing command'
    };
  }
}

/**
 * Formats the result for chat response.
 * @param result GrandeurCommandResult
 * @param locale Language locale
 * @returns Formatted string
 */
export function formatResultForChat(result: GrandeurCommandResult, locale: 'en' | 'ar'): string {
  if (result.success) {
    return result.message;
  } else {
    return locale === 'ar' ? `خطأ: ${result.message}` : `Error: ${result.message}`;
  }
}

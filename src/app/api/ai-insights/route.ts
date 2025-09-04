import { NextRequest, NextResponse } from 'next/server';
import { GeminiService } from '@/lib/gemini';
import { withTimeout, AI_INSIGHTS_TIMEOUT_MS, isTimeoutError } from '@/lib/http/timeout';

export const maxDuration = 30;

interface ProjectData {
  manpower?: Record<string, any>[];
  mechanicalPlan?: Record<string, any>[];
  riskRegister?: Record<string, any>[];
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse request body
    const body = await request.json();
    
    // Basic validation without Zod
    if (!body || typeof body !== 'object' || !('projectData' in body)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data',
          message: 'Request must include projectData',
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    const { projectData } = body as { projectData: ProjectData };
    
    // Log the request (without sensitive data)
    console.log('Generating AI insights for project data with structure:', {
      manpowerCount: projectData.manpower?.length || 0,
      mechanicalPlanCount: projectData.mechanicalPlan?.length || 0,
      riskRegisterCount: projectData.riskRegister?.length || 0,
    });

    const geminiService = new GeminiService();
    const insights = await withTimeout(geminiService.generateInsights(projectData), AI_INSIGHTS_TIMEOUT_MS, 'ai-insights route');
    
    const responseTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      data: insights,
      meta: {
        timestamp: new Date().toISOString(),
        responseTimeMs: responseTime,
        model: process.env.GEMINI_MODEL_NAME || 'gemini-1.5-flash',
      }
    }, { headers: { 'x-duration-ms': responseTime.toString() } });
    
  } catch (error: unknown) {
    const errorId = Math.random().toString(36).substring(2, 8);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`[${errorId}] Error in ai-insights API:`, error);
    
    if (isTimeoutError(error)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Request timed out',
          message: 'The AI insights generation timed out. Please try again.',
          timestamp: new Date().toISOString(),
          retryAfter: '30'
        },
        {
          status: 504,
          headers: { 'Retry-After': '30' }
        }
      );
    }
    
    // Handle rate limiting or service unavailable errors
    if (errorMessage.includes('429') || errorMessage.includes('503')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Service temporarily unavailable',
          message: 'The AI service is currently experiencing high demand. Please try again later.',
          errorId,
          timestamp: new Date().toISOString(),
          retryAfter: '30s'
        },
        { 
          status: 503,
          headers: { 'Retry-After': '30' }
        }
      );
    }
    
    // Default error response
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate AI insights',
        message: errorMessage,
        errorId,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; // Ensure dynamic response for each request

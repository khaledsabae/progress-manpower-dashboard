import { NextRequest, NextResponse } from 'next/server';
import { GoogleSheetsService } from '@/lib/googleSheets';
import { withTimeout, API_PROJECT_DATA_TIMEOUT_MS, TimeoutError, isTimeoutError } from '@/lib/http/timeout';

export const maxDuration = 20;

export async function GET(request: NextRequest) {
  try {
    const sheetsService = new GoogleSheetsService();
    const projectData = await withTimeout(sheetsService.getProjectData(), API_PROJECT_DATA_TIMEOUT_MS, 'project-data API');

    return NextResponse.json({
      success: true,
      data: projectData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in project-data API:', error);
    if (isTimeoutError(error)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Request timed out',
          message: error instanceof Error ? error.message : 'Unknown timeout error',
          code: 'TIMEOUT',
        },
        { status: 504 }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch project data',
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  }
}

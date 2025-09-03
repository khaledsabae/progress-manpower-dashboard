import { NextRequest, NextResponse } from 'next/server';
import { GoogleSheetsService } from '@/lib/googleSheets';

export async function GET(request: NextRequest) {
  try {
    const sheetsService = new GoogleSheetsService();
    const projectData = await sheetsService.getProjectData();

    return NextResponse.json({
      success: true,
      data: projectData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in project-data API:', error);
    
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

import { NextRequest, NextResponse } from 'next/server';
import { TrainingManager } from '@/lib/managers/TrainingManager';
import { TrainingModuleRequest } from '@/types/training';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      sourceDocumentIds,
      title,
      category,
      difficulty = 'intermediate',
      estimatedDuration,
      learningObjectives,
      generateAssessment = true,
      tenantId = 'demo-tenant',
      accessLevel = 'ACCOUNT'
    } = body;

    // Validate required fields
    if (!sourceDocumentIds || !Array.isArray(sourceDocumentIds) || sourceDocumentIds.length === 0) {
      return NextResponse.json(
        { error: 'sourceDocumentIds is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    if (!category) {
      return NextResponse.json(
        { error: 'category is required' },
        { status: 400 }
      );
    }

    const request_data: TrainingModuleRequest = {
      sourceDocumentIds,
      title,
      category,
      difficulty: difficulty as 'beginner' | 'intermediate' | 'advanced',
      estimatedDuration,
      learningObjectives,
      generateAssessment,
      tenantId,
      accessLevel: accessLevel as 'PUBLIC' | 'ACCOUNT' | 'COMPANY' | 'OFFICE'
    };

    console.log('🎓 Generating training module from documents:', sourceDocumentIds);

    const trainingManager = new TrainingManager();
    const result = await trainingManager.generateTrainingModule(request_data);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate training module' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      module: result.module,
      assessment: result.assessment,
      generationTime: result.generationTime,
      contentQuality: result.contentQuality,
      suggestions: result.suggestions,
      message: `Training module "${result.module.title}" generated successfully`
    });

  } catch (error) {
    console.error('❌ Error in generate-module API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || 'demo-tenant';
    const accessLevel = searchParams.get('accessLevel') || 'ACCOUNT';

    const trainingManager = new TrainingManager();
    const modules = await trainingManager.getTrainingModules(tenantId, accessLevel);

    return NextResponse.json({
      success: true,
      modules,
      count: modules.length
    });

  } catch (error) {
    console.error('❌ Error fetching training modules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch training modules' },
      { status: 500 }
    );
  }
}

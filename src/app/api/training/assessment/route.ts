import { NextRequest, NextResponse } from 'next/server';
import { CertificationManager } from '@/lib/managers/CertificationManager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const moduleId = searchParams.get('moduleId');
    const tenantId = searchParams.get('tenantId') || 'demo-tenant';

    if (!moduleId) {
      return NextResponse.json(
        { error: 'moduleId is required' },
        { status: 400 }
      );
    }

    const certificationManager = new CertificationManager();
    const assessment = await certificationManager.getAssessment(moduleId, tenantId);

    if (!assessment) {
      return NextResponse.json(
        { error: 'Assessment not found for this module' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      assessment
    });

  } catch (error) {
    console.error('❌ Error fetching assessment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assessment' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    const certificationManager = new CertificationManager();

    switch (action) {
      case 'start':
        return await handleStartAssessment(certificationManager, data);
      case 'submit':
        return await handleSubmitAssessment(certificationManager, data);
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use "start" or "submit"' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('❌ Error in assessment API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleStartAssessment(certificationManager: CertificationManager, data: any) {
  const { userId, assessmentId, tenantId = 'demo-tenant' } = data;

  if (!userId || !assessmentId) {
    return NextResponse.json(
      { error: 'userId and assessmentId are required' },
      { status: 400 }
    );
  }

  try {
    const result = await certificationManager.startAssessment(userId, assessmentId, tenantId);
    
    return NextResponse.json({
      success: true,
      attempt: result.attempt,
      questions: result.questions,
      message: 'Assessment started successfully'
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start assessment' },
      { status: 400 }
    );
  }
}

async function handleSubmitAssessment(certificationManager: CertificationManager, data: any) {
  const { attemptId, answers, tenantId = 'demo-tenant' } = data;

  if (!attemptId || !answers) {
    return NextResponse.json(
      { error: 'attemptId and answers are required' },
      { status: 400 }
    );
  }

  try {
    const result = await certificationManager.submitAssessment(attemptId, answers, tenantId);
    
    return NextResponse.json({
      success: true,
      attempt: result.attempt,
      certification: result.certification,
      message: result.attempt.passed 
        ? 'Congratulations! You passed the assessment and earned a certification.'
        : 'Assessment completed. You did not meet the passing score this time.'
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit assessment' },
      { status: 400 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { TrainingManager } from '@/lib/managers/TrainingManager';
import { CertificationManager } from '@/lib/managers/CertificationManager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const moduleId = searchParams.get('moduleId');
    const tenantId = searchParams.get('tenantId') || 'demo-tenant';
    const type = searchParams.get('type') || 'progress'; // 'progress', 'certifications', 'attempts'

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const trainingManager = new TrainingManager();
    const certificationManager = new CertificationManager();

    switch (type) {
      case 'progress':
        if (moduleId) {
          // Get progress for specific module
          const progress = await trainingManager.getUserProgress(userId, moduleId, tenantId);
          return NextResponse.json({
            success: true,
            progress
          });
        } else {
          // Get all progress for user
          const allProgress = await trainingManager.getAllUserProgress(userId, tenantId);
          return NextResponse.json({
            success: true,
            progress: allProgress
          });
        }

      case 'certifications':
        const certifications = await certificationManager.getUserCertifications(userId, tenantId);
        return NextResponse.json({
          success: true,
          certifications
        });

      case 'attempts':
        if (!moduleId) {
          return NextResponse.json(
            { error: 'moduleId is required for attempts type' },
            { status: 400 }
          );
        }
        const attempts = await certificationManager.getUserAssessmentAttempts(userId, moduleId, tenantId);
        return NextResponse.json({
          success: true,
          attempts
        });

      default:
        return NextResponse.json(
          { error: 'Invalid type. Use "progress", "certifications", or "attempts"' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('❌ Error fetching user progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user progress' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      userId, 
      moduleId, 
      sectionId, 
      timeSpent = 0, 
      tenantId = 'demo-tenant' 
    } = body;

    if (!userId || !moduleId || !sectionId) {
      return NextResponse.json(
        { error: 'userId, moduleId, and sectionId are required' },
        { status: 400 }
      );
    }

    const trainingManager = new TrainingManager();
    const progress = await trainingManager.updateUserProgress(
      userId, 
      moduleId, 
      sectionId, 
      timeSpent, 
      tenantId
    );

    return NextResponse.json({
      success: true,
      progress,
      message: `Progress updated: ${progress.progress}% complete`
    });

  } catch (error) {
    console.error('❌ Error updating user progress:', error);
    return NextResponse.json(
      { error: 'Failed to update user progress' },
      { status: 500 }
    );
  }
}

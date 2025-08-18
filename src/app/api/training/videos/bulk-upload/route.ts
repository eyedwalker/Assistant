import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { VideoProcessingManager } from '@/lib/managers/VideoProcessingManager';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import { S3Accessor } from '@/lib/accessors/S3Accessor';
import { AnthropicAccessor } from '@/lib/accessors/AnthropicAccessor';
import { authOptions } from '@/lib/auth';
import { ProcessingConfig, ContentType, ContentSource } from '@/lib/types/content';

export const maxDuration = 300; // 5 minutes for large batch processing

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const videos = formData.getAll('videos') as File[];
    const title = formData.get('title') as string || 'Video Training Batch';
    const description = formData.get('description') as string || '';
    const processingMode = formData.get('mode') as string || 'training';

    if (!videos || videos.length === 0) {
      return NextResponse.json(
        { error: 'No videos provided' },
        { status: 400 }
      );
    }

    // Initialize accessors
    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI!,
      process.env.MONGODB_DB_NAME!
    );
    const s3Accessor = new S3Accessor(
      process.env.AWS_S3_BUCKET!,
      process.env.AWS_REGION!
    );
    const anthropicAccessor = new AnthropicAccessor(
      process.env.ANTHROPIC_API_KEY!
    );

    // Initialize video processing manager
    const videoManager = new VideoProcessingManager(
      mongoAccessor,
      s3Accessor,
      anthropicAccessor
    );

    // Create batch processing job
    const batchJobId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const processingJobs = [];

    console.log(`📹 Starting batch video processing for ${videos.length} videos`);

    // Process each video
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const videoBuffer = Buffer.from(await video.arrayBuffer());
      
      const source: ContentSource = {
        type: 'file',
        source: video.name,
        metadata: {
          filename: video.name,
          mimeType: video.type,
          size: video.size,
          batchJobId,
          videoIndex: i + 1,
          totalVideos: videos.length,
          title: `${title} - ${video.name}`,
          description,
          uploadedBy: session.user.email || session.user.id
        }
      };
      
      const config: ProcessingConfig = {
        contentType: 'video',
        extractText: true,
        generateEmbeddings: true,
        enableTranscription: true,
        enableOCR: false,
        enableObjectDetection: true,
        quality: processingMode === 'comprehensive' ? 'high' : 'medium',
        maxDuration: 3600, // 1 hour max
        phiDetection: true,
        auditLogging: true
      };

      try {
        // Start processing the video
        const result = await videoManager.processVideo(
          source,
          config,
          session.user.id,
          session.user.accessId || 'default'
        );
        const jobId = result.jobId;

        processingJobs.push({
          jobId,
          filename: video.name,
          status: 'processing',
          index: i + 1
        });

        console.log(`✅ Started processing video ${i + 1}/${videos.length}: ${video.name}`);
      } catch (error) {
        console.error(`❌ Failed to process video ${video.name}:`, error);
        processingJobs.push({
          jobId: null,
          filename: video.name,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          index: i + 1
        });
      }
    }

    // Store batch job information
    await mongoAccessor.connect();
    await mongoAccessor.create('batch_jobs', {
      batchJobId,
      type: 'video_training',
      title,
      description,
      userId: session.user.id,
      tenantId: session.user.accessId || 'default',
      totalVideos: videos.length,
      processingJobs,
      status: 'processing',
      createdAt: new Date(),
      mode: processingMode
    });

    return NextResponse.json({
      success: true,
      batchJobId,
      message: `Started processing ${videos.length} videos for training`,
      totalVideos: videos.length,
      jobs: processingJobs,
      trackingUrl: `/api/training/videos/status/${batchJobId}`
    });

  } catch (error) {
    console.error('Batch video upload error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process videos',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check batch processing status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const batchJobId = searchParams.get('batchJobId');

    if (!batchJobId) {
      return NextResponse.json(
        { error: 'Batch job ID required' },
        { status: 400 }
      );
    }

    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI!,
      process.env.MONGODB_DB_NAME!
    );

    // Get batch job status
    await mongoAccessor.connect();
    const batchJobs = await mongoAccessor.find('batch_jobs', {
      batchJobId,
      userId: session.user.id
    });
    const batchJob = batchJobs[0];

    if (!batchJob) {
      return NextResponse.json(
        { error: 'Batch job not found' },
        { status: 404 }
      );
    }

    // Check individual job statuses
    const updatedJobs = [];
    let allCompleted = true;
    let successCount = 0;
    let failedCount = 0;

    for (const job of batchJob.processingJobs) {
      if (job.jobId) {
        const jobStatuses = await mongoAccessor.find('processing_jobs', {
          jobId: job.jobId
        });
        const jobStatus = jobStatuses[0];

        if (jobStatus) {
          const status = jobStatus.status === 'completed' ? 'completed' : 
                        jobStatus.status === 'failed' ? 'failed' : 'processing';
          
          updatedJobs.push({
            ...job,
            status,
            progress: jobStatus.progress || 0,
            result: jobStatus.result
          });

          if (status === 'completed') successCount++;
          else if (status === 'failed') failedCount++;
          else allCompleted = false;
        } else {
          updatedJobs.push(job);
          if (job.status !== 'failed') allCompleted = false;
        }
      } else {
        updatedJobs.push(job);
        failedCount++;
      }
    }

    // Update batch job status if all completed
    if (allCompleted && batchJob.status !== 'completed') {
      const batchJobDocs = await mongoAccessor.find('batch_jobs', { batchJobId });
      if (batchJobDocs.length > 0) {
        await mongoAccessor.update('batch_jobs', batchJobDocs[0]._id.toString(), {
          status: 'completed',
          completedAt: new Date(),
          successCount,
          failedCount,
          processingJobs: updatedJobs
        });
      }
    }

    return NextResponse.json({
      batchJobId,
      status: allCompleted ? 'completed' : 'processing',
      totalVideos: batchJob.totalVideos,
      successCount,
      failedCount,
      processingCount: batchJob.totalVideos - successCount - failedCount,
      jobs: updatedJobs,
      createdAt: batchJob.createdAt,
      completedAt: batchJob.completedAt || null
    });

  } catch (error) {
    console.error('Batch status check error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check batch status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

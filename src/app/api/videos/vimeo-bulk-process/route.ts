import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { VimeoAccessor } from '@/lib/accessors/VimeoAccessor';
import { VideoProcessingManager } from '@/lib/managers/VideoProcessingManager';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import { S3Accessor } from '@/lib/accessors/S3Accessor';
import { AnthropicAccessor } from '@/lib/accessors/AnthropicAccessor';
import { ContentSource, ProcessingConfig } from '@/lib/types/content';

interface VimeoBulkProcessRequest {
  query?: string; // Optional search query to filter videos
  limit?: number; // Maximum number of videos to process
  processTranscripts?: boolean;
  analyzeContent?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: VimeoBulkProcessRequest = await request.json();
    const { query, limit = 100, processTranscripts = true, analyzeContent = true } = body;

    // Initialize services
    const vimeoAccessor = new VimeoAccessor(process.env.VIMEO_ACCESS_TOKEN!);
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

    await mongoAccessor.connect();

    try {
      const videoManager = new VideoProcessingManager(
        mongoAccessor,
        s3Accessor,
        anthropicAccessor
      );

      // Fetch videos from Vimeo
      console.log('🎬 Fetching videos from Vimeo...');
      const allVideos = await vimeoAccessor.fetchAllVideos(query);
      const videosToProcess = allVideos.slice(0, limit);
      
      console.log(`Found ${allVideos.length} videos, processing ${videosToProcess.length}`);

      const results = {
        total: videosToProcess.length,
        processed: 0,
        successful: 0,
        failed: 0,
        jobs: [] as any[]
      };

      // Process videos in batches of 5 to avoid overwhelming the system
      const batchSize = 5;
      for (let i = 0; i < videosToProcess.length; i += batchSize) {
        const batch = videosToProcess.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (video) => {
          try {
            console.log(`Processing: ${video.name}`);

            // Get transcript if available
            let transcript = null;
            if (processTranscripts) {
              transcript = await vimeoAccessor.getVideoTranscript(
                video.uri.split('/').pop()!
              );
            }

            // Create processing job
            const source: ContentSource = {
              type: 'url',
              url: video.link,
              metadata: {
                filename: video.name,
                title: video.name,
                description: video.description,
                duration: video.duration,
                vimeoId: video.uri.split('/').pop(),
                createdTime: video.created_time,
                modifiedTime: video.modified_time
              }
            };
            
            const config: ProcessingConfig = {
              extractKeyFrames: true,
              extractTranscript: processTranscripts,
              performAIAnalysis: analyzeContent,
              generateSummary: analyzeContent,
              accessLevel: 'ACCOUNT'
            };
            
            const job = await videoManager.processVideo(
              source,
              config,
              session.user.id || 'vimeo-user',
              'default-tenant'
            );

            results.successful++;
            results.jobs.push({
              vimeoId: video.uri.split('/').pop(),
              name: video.name,
              jobId: job.jobId,
              status: 'processing'
            });

          } catch (error) {
            console.error(`Failed to process ${video.name}:`, error);
            results.failed++;
            results.jobs.push({
              vimeoId: video.uri.split('/').pop(),
              name: video.name,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        });

        await Promise.all(batchPromises);
        results.processed += batch.length;

        // Add delay between batches
        if (i + batchSize < videosToProcess.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      return NextResponse.json({
        success: true,
        message: `Vimeo bulk processing initiated`,
        results,
        summary: {
          totalVideosFound: allVideos.length,
          videosProcessed: results.processed,
          successful: results.successful,
          failed: results.failed
        }
      });

    } finally {
      await mongoAccessor.disconnect();
    }

  } catch (error) {
    console.error('Vimeo bulk processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process Vimeo videos' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Vimeo Bulk Video Processing',
    description: 'Process multiple videos from your Vimeo account',
    usage: {
      endpoint: 'POST /api/videos/vimeo-bulk-process',
      body: {
        query: 'Optional search query to filter videos',
        limit: 'Maximum number of videos to process (default: 100)',
        processTranscripts: 'Extract/process video transcripts (default: true)',
        analyzeContent: 'Perform AI analysis on videos (default: true)'
      }
    }
  });
}

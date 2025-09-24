import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { VimeoAccessor } from '@/lib/accessors/VimeoAccessor';
import { ProductionKnowledgeBaseAccessor } from '@/lib/accessors/ProductionKnowledgeBaseAccessor';
import { BedrockAccessor } from '@/lib/accessors/BedrockAccessor';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';

interface VideoProcessingRequest {
  videoIds?: string[];
  batchSize?: number;
  includeAnalysis?: boolean;
  category?: string;
  accessLevel?: string;
}

interface ProcessingResult {
  videoId: string;
  title: string;
  success: boolean;
  s3Key?: string;
  error?: string;
  transcriptLength?: number;
  analysisGenerated?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.VIMEO_ACCESS_TOKEN) {
      return NextResponse.json({ 
        error: 'Vimeo access token not configured' 
      }, { status: 500 });
    }

    const body: VideoProcessingRequest = await request.json();
    const { 
      videoIds = [], 
      batchSize = 10, 
      includeAnalysis = true,
      category = 'Video Content',
      accessLevel = 'COMPANY'
    } = body;

    console.log(`🎬 Processing ${videoIds.length} videos to Knowledge Base`);

    // Initialize services
    const vimeoAccessor = new VimeoAccessor(process.env.VIMEO_ACCESS_TOKEN);
    const kbAccessor = new ProductionKnowledgeBaseAccessor();
    const bedrockAccessor = new BedrockAccessor({
      region: 'us-west-2',
      modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0'
    });
    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI!,
      process.env.MONGODB_DB_NAME || 'ai-assistant-platform'
    );

    await mongoAccessor.connect();

    const results: ProcessingResult[] = [];
    const batchId = `video-batch-${Date.now()}`;

    // Process videos in batches
    for (let i = 0; i < videoIds.length; i += batchSize) {
      const batch = videoIds.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}: ${batch.length} videos`);

      const batchPromises = batch.map(async (videoId) => {
        try {
          // Step 1: Get video metadata from Vimeo
          const videoData = await vimeoAccessor.getVideo(videoId);
          if (!videoData) {
            throw new Error('Video not found on Vimeo');
          }

          console.log(`🔍 Processing: ${videoData.name}`);

          // Step 2: Extract transcript
          const transcript = await vimeoAccessor.getVideoTranscript(videoId);
          if (!transcript || transcript.trim().length < 50) {
            throw new Error('No meaningful transcript found');
          }

          // Step 3: Generate enhanced analysis with Bedrock
          let enhancedAnalysis = '';
          let keyPoints: string[] = [];
          
          if (includeAnalysis && transcript.length > 100) {
            const analysisPrompt = `Analyze this eyecare video transcript and provide:
1. Key learning objectives
2. Important procedures or techniques mentioned  
3. Clinical insights and best practices
4. Relevant VSP/Eyefinity workflow connections

Video: ${videoData.name}
Transcript: ${transcript}

Provide a structured summary suitable for AI knowledge retrieval.`;

            const analysisResponse = await bedrockAccessor.generateChatResponse(
              analysisPrompt,
              'You are an expert eyecare educator analyzing training content.',
              session.user.id || 'system',
              'video-processing'
            );

            enhancedAnalysis = analysisResponse.message;

            // Extract key points for metadata
            keyPoints = enhancedAnalysis
              .split('\n')
              .filter(line => line.trim().startsWith('-') || line.match(/^\d+\./))
              .map(point => point.replace(/^[-\d\.\s]+/, '').trim())
              .slice(0, 10);
          }

          // Step 4: Format content for Knowledge Base
          const knowledgeContent = formatVideoKnowledge({
            videoId,
            videoData,
            transcript,
            enhancedAnalysis,
            keyPoints,
            category,
            accessLevel,
            processedAt: new Date().toISOString(),
            batchId
          });

          // Step 5: Upload to S3 and Knowledge Base
          const s3Key = `videos/${category.toLowerCase().replace(/\s+/g, '-')}/${videoId}/knowledge.txt`;
          
          await kbAccessor.uploadContent(s3Key, knowledgeContent, {
            title: videoData.name,
            contentType: 'video_transcript',
            category,
            videoId,
            duration: videoData.duration?.toString() || '0',
            vimeoUrl: videoData.link,
            accessLevel,
            keyPoints: keyPoints.join('; '),
            batchId,
            uploadedBy: session.user.id || 'system'
          });

          // Step 6: Update MongoDB with processing status
          await mongoAccessor.create('video_kb_processing', {
            videoId,
            title: videoData.name,
            s3Key,
            batchId,
            transcriptLength: transcript.length,
            analysisGenerated: includeAnalysis,
            processedAt: new Date(),
            status: 'completed',
            userId: session.user.id
          });

          console.log(`✅ Processed: ${videoData.name} → ${s3Key}`);

          return {
            videoId,
            title: videoData.name,
            success: true,
            s3Key,
            transcriptLength: transcript.length,
            analysisGenerated: includeAnalysis
          };

        } catch (error: any) {
          console.error(`❌ Failed to process video ${videoId}:`, error.message);
          
          // Log error to MongoDB
          await mongoAccessor.create('video_kb_processing', {
            videoId,
            batchId,
            error: error.message,
            processedAt: new Date(),
            status: 'failed',
            userId: session.user.id
          });

          return {
            videoId,
            title: 'Unknown',
            success: false,
            error: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < videoIds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    await mongoAccessor.disconnect();

    // Trigger Knowledge Base sync
    try {
      await kbAccessor.syncKnowledgeBase();
      console.log('🔄 Knowledge Base sync triggered');
    } catch (syncError) {
      console.warn('⚠️ Knowledge Base sync failed, but content was uploaded');
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} videos: ${successCount} successful, ${failureCount} failed`,
      batchId,
      results: results.map(r => ({
        videoId: r.videoId,
        title: r.title,
        success: r.success,
        s3Key: r.s3Key,
        error: r.error
      })),
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
        totalTranscriptChars: results
          .filter(r => r.success)
          .reduce((sum, r) => sum + (r.transcriptLength || 0), 0)
      },
      knowledgeBaseStatus: await kbAccessor.getKnowledgeBaseStatus()
    });

  } catch (error: any) {
    console.error('❌ Video processing error:', error);
    return NextResponse.json({
      error: 'Failed to process videos',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Format video content for Knowledge Base ingestion
 */
function formatVideoKnowledge(params: {
  videoId: string;
  videoData: any;
  transcript: string;
  enhancedAnalysis: string;
  keyPoints: string[];
  category: string;
  accessLevel: string;
  processedAt: string;
  batchId: string;
}): string {
  const {
    videoId,
    videoData,
    transcript,
    enhancedAnalysis,
    keyPoints,
    category,
    accessLevel,
    processedAt,
    batchId
  } = params;

  return `# ${videoData.name}

## Video Information
- **Video ID**: ${videoId}
- **Duration**: ${Math.floor((videoData.duration || 0) / 60)}:${String((videoData.duration || 0) % 60).padStart(2, '0')}
- **Vimeo URL**: ${videoData.link}
- **Category**: ${category}
- **Access Level**: ${accessLevel}
- **Processing Date**: ${processedAt}
- **Batch ID**: ${batchId}

## Description
${videoData.description || 'No description available'}

## Key Learning Points
${keyPoints.map(point => `- ${point}`).join('\n')}

## Enhanced Analysis
${enhancedAnalysis}

## Full Transcript
${transcript}

## Metadata
- **Content Type**: Video Training Material
- **Target Audience**: Eyecare Professionals
- **Processing Method**: Vimeo API + AWS Bedrock Analysis
- **Transcript Length**: ${transcript.length} characters
- **Knowledge Base Ready**: Yes

---
*This content was automatically processed and enhanced for AI-powered search and retrieval in the VSP eyecare knowledge system.*
`;
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/videos/process-to-kb',
    method: 'POST',
    description: 'Process Vimeo videos and upload to AWS Knowledge Base',
    parameters: {
      videoIds: 'Array of Vimeo video IDs',
      batchSize: 'Number of videos to process concurrently (default: 10)',
      includeAnalysis: 'Generate enhanced analysis with Bedrock (default: true)',
      category: 'Content category for organization (default: "Video Content")',
      accessLevel: 'Access level: PUBLIC|ACCOUNT|COMPANY|OFFICE (default: "COMPANY")'
    },
    example: {
      videoIds: ['123456789', '987654321'],
      batchSize: 5,
      includeAnalysis: true,
      category: 'Contact Lens Training',
      accessLevel: 'COMPANY'
    }
  });
}

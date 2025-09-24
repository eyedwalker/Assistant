import { NextRequest, NextResponse } from 'next/server';
import { VimeoAccessor } from '@/lib/accessors/VimeoAccessor';
import { ProductionKnowledgeBaseAccessor } from '@/lib/accessors/ProductionKnowledgeBaseAccessor';
import { BedrockAccessor } from '@/lib/accessors/BedrockAccessor';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';

interface VideoProcessingRequest {
  videoIds: string[];
  batchSize?: number;
  includeAnalysis?: boolean;
  category?: string;
  accessLevel?: string;
  apiKey?: string;
}

// Simple API key for internal processing (in production, use proper authentication)
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'vsp-internal-2024';

export async function POST(request: NextRequest) {
  try {
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
      category = 'Eyecare Video Training',
      accessLevel = 'COMPANY',
      apiKey = ''
    } = body;

    // Simple internal authentication
    if (apiKey !== INTERNAL_API_KEY) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    console.log(`🎬 Internal processing: ${videoIds.length} videos to Knowledge Base`);

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

    const results: any[] = [];
    const batchId = `video-batch-${Date.now()}`;

    // Process videos individually to avoid memory issues
    for (const videoId of videoIds) {
      try {
        console.log(`🔄 Processing video: ${videoId}`);

        // Step 1: Get video metadata from Vimeo
        const videoData = await vimeoAccessor.getVideo(videoId);
        if (!videoData) {
          throw new Error('Video not found on Vimeo');
        }

        console.log(`📺 Found: ${videoData.name}`);

        // Step 2: Extract transcript
        const transcript = await vimeoAccessor.getVideoTranscript(videoId);
        if (!transcript || transcript.trim().length < 50) {
          throw new Error('No meaningful transcript found');
        }

        console.log(`📝 Transcript extracted: ${transcript.length} characters`);

        // Step 3: Generate enhanced analysis with Bedrock
        let enhancedAnalysis = '';
        let keyPoints: string[] = [];
        
        if (includeAnalysis && transcript.length > 100) {
          const analysisPrompt = `Analyze this eyecare training video transcript and provide:

1. **Key Learning Objectives**: What should viewers learn?
2. **Important Procedures**: Step-by-step processes mentioned
3. **Clinical Insights**: Best practices and professional tips
4. **System Integration**: How this relates to Eyefinity/VSP workflows
5. **Practical Applications**: Real-world implementation guidance

Video Title: ${videoData.name}
Duration: ${Math.floor((videoData.duration || 0) / 60)}:${String((videoData.duration || 0) % 60).padStart(2, '0')}

Transcript:
${transcript}

Provide a structured, searchable summary for AI knowledge retrieval.`;

          const analysisResponse = await bedrockAccessor.generateChatResponse(
            analysisPrompt,
            'You are an expert eyecare educator analyzing training content for VSP professionals.',
            'system-video-processor',
            'video-analysis'
          );

          enhancedAnalysis = analysisResponse.message;

          // Extract key points for metadata
          keyPoints = enhancedAnalysis
            .split('\n')
            .filter(line => line.trim().startsWith('-') || line.match(/^\d+\./) || line.includes('**'))
            .map(point => point.replace(/^[-\d\.\s\*]+/, '').trim())
            .filter(point => point.length > 10)
            .slice(0, 8);

          console.log(`🧠 Analysis generated: ${keyPoints.length} key points`);
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
        
        await kbAccessor.uploadContent(knowledgeContent, {
          title: videoData.name,
          contentType: 'video',
          category,
          videoId,
          duration: videoData.duration?.toString() || '0',
          vimeoUrl: videoData.link,
          accessLevel: 'PUBLIC' as const,
          keyPoints: keyPoints.join('; '),
          batchId,
          uploadedBy: 'system-video-processor'
        });

        console.log(`✅ Uploaded to S3: ${s3Key}`);

        results.push({
          videoId,
          title: videoData.name,
          success: true,
          s3Key,
          transcriptLength: transcript.length,
          analysisGenerated: includeAnalysis,
          keyPointsCount: keyPoints.length
        });

        // Small delay between videos
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error: any) {
        console.error(`❌ Failed to process video ${videoId}:`, error.message);
        
        results.push({
          videoId,
          title: 'Unknown',
          success: false,
          error: error.message
        });
      }
    }

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
        error: r.error,
        transcriptLength: r.transcriptLength,
        keyPointsCount: r.keyPointsCount
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
    console.error('❌ Internal video processing error:', error);
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

  const duration = videoData.duration || 0;
  const durationFormatted = `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`;

  return `# ${videoData.name}

## Video Overview
- **Video ID**: ${videoId}
- **Duration**: ${durationFormatted}
- **Vimeo URL**: ${videoData.link}
- **Category**: ${category}
- **Access Level**: ${accessLevel}
- **Processing Date**: ${processedAt}

## Description
${videoData.description || 'Professional eyecare training content from VSP Vision Care.'}

## Key Learning Points
${keyPoints.length > 0 ? keyPoints.map(point => `- ${point}`).join('\n') : '- Comprehensive eyecare training content\n- Professional development material\n- VSP best practices and procedures'}

## Detailed Analysis
${enhancedAnalysis || 'This video provides essential training content for eyecare professionals, covering important procedures, best practices, and system workflows relevant to VSP operations.'}

## Complete Transcript
${transcript}

## Training Metadata
- **Content Type**: Video Training Material  
- **Target Audience**: Eyecare Professionals, VSP Network
- **Training Category**: ${category}
- **Video Source**: Vimeo Professional Training Library
- **Transcript Length**: ${transcript.length} characters
- **Processing Method**: AI-Enhanced Analysis with AWS Bedrock
- **Knowledge Base Ready**: Yes
- **Batch ID**: ${batchId}

## Search Keywords
eyecare, training, VSP, ${videoData.name.toLowerCase()}, ${category.toLowerCase()}, video, tutorial, procedures, ${keyPoints.join(', ').toLowerCase()}

---
*This content was automatically processed from Vimeo training videos and enhanced with AI analysis for optimal search and retrieval in the VSP eyecare knowledge system.*
`;
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/internal/process-videos-to-kb',
    method: 'POST',
    description: 'Internal endpoint for processing Vimeo videos to AWS Knowledge Base',
    authentication: 'Requires internal API key',
    parameters: {
      videoIds: 'Array of Vimeo video IDs (required)',
      batchSize: 'Processing batch size (default: 10)',
      includeAnalysis: 'Generate enhanced analysis (default: true)',
      category: 'Content category (default: "Eyecare Video Training")',
      accessLevel: 'Access level (default: "COMPANY")',
      apiKey: 'Internal API key (required)'
    }
  });
}

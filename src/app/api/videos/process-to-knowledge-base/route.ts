/**
 * API Route: Process Vimeo Videos to AWS Bedrock Knowledge Base
 * 
 * POST /api/videos/process-to-knowledge-base
 * Processes Vimeo videos and stores them in S3 for AWS Bedrock Knowledge Base ingestion
 */

import { NextRequest, NextResponse } from 'next/server';
import { VimeoAccessor } from '@/lib/accessors/VimeoAccessor';
import { S3Accessor } from '@/lib/accessors/S3Accessor';
import { AnthropicAccessor } from '@/lib/accessors/AnthropicAccessor';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';

interface VideoProcessingResult {
  vimeoId: string;
  title: string;
  transcript: string | null;
  aiAnalysis: string | null;
  s3Key: string | null;
  s3Url: string | null;
  success: boolean;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      limit = 10,
      processTranscripts = true,
      analyzeContent = true,
      query = null,
      skipExisting = true
    } = body;

    // Get configuration from environment
    const vimeoAccessToken = process.env.VIMEO_ACCESS_TOKEN;
    const s3BucketName = process.env.AWS_S3_KNOWLEDGE_BUCKET || 'encompass-knowledgebase';
    const s3Region = process.env.AWS_REGION || 'us-west-2';

    if (!vimeoAccessToken) {
      return NextResponse.json({
        success: false,
        error: 'VIMEO_ACCESS_TOKEN not configured'
      }, { status: 500 });
    }

    console.log(`🎬 Starting Vimeo to Knowledge Base processing (limit: ${limit})`);

    // Initialize accessors
    const vimeoAccessor = new VimeoAccessor(vimeoAccessToken);
    const s3Accessor = new S3Accessor(s3BucketName, s3Region);
    const anthropicAccessor = new AnthropicAccessor();
    // MongoDB is optional for this process - we're storing in S3 for Knowledge Base
    let mongoAccessor: MongoDBAccessor | null = null;
    try {
      mongoAccessor = new MongoDBAccessor();
      await mongoAccessor.connect();
      console.log('✅ MongoDB connected for logging');
    } catch (error) {
      console.warn('⚠️  MongoDB connection failed - continuing without logging:', error);
    }

    // Get videos from Vimeo
    console.log('📡 Fetching videos from Vimeo...');
    const videosResponse = await vimeoAccessor.getAllVideos({
      page: 1,
      perPage: limit,
      query: query,
      fields: 'uri,name,description,duration,link,created_time'
    });

    const videos = videosResponse.data;
    console.log(`📊 Found ${videos.length} videos to process`);

    const results: VideoProcessingResult[] = [];
    let successCount = 0;
    let failCount = 0;

    // Process each video
    for (const video of videos) {
      const vimeoId = video.uri.split('/').pop() || 'unknown';
      console.log(`🔄 Processing: ${video.name} (${vimeoId})`);

      try {
        // Generate S3 key for Knowledge Base
        const sanitizedTitle = video.name.replace(/[^a-zA-Z0-9\-_\.]/g, '_');
        const s3Key = `vimeo-videos/${vimeoId}/${sanitizedTitle}.json`;

        // Check if already exists in S3
        if (skipExisting && await s3Accessor.objectExists(s3Key)) {
          console.log(`⏭️  Skipping ${video.name} - already exists in S3`);
          results.push({
            vimeoId,
            title: video.name,
            transcript: null,
            aiAnalysis: null,
            s3Key,
            s3Url: `https://${s3BucketName}.s3.${s3Region}.amazonaws.com/${s3Key}`,
            success: true
          });
          successCount++;
          continue;
        }

        let transcript: string | null = null;
        let aiAnalysis: string | null = null;

        // Extract transcript if requested
        if (processTranscripts) {
          console.log(`🗣️  Extracting transcript for ${video.name}...`);
          transcript = await vimeoAccessor.getVideoTranscript(vimeoId);
          if (transcript) {
            console.log(`✅ Transcript extracted: ${transcript.length} characters`);
          } else {
            console.log(`⚠️  No transcript available for ${video.name}`);
          }
        }

        // Perform AI analysis if requested
        if (analyzeContent && transcript) {
          console.log(`🤖 Performing AI analysis for ${video.name}...`);
          const analysisPrompt = `Please analyze this eyecare training video transcript and provide:

1. **Summary**: A concise overview of the video content
2. **Key Topics**: Main topics covered
3. **Learning Objectives**: What viewers should learn
4. **Key Procedures**: Any procedures or workflows mentioned
5. **Important Points**: Critical information for eyecare professionals

Video Title: ${video.name}
Transcript: ${transcript}

Please format your analysis in a structured way for easy reference.`;

          aiAnalysis = await anthropicAccessor.generateChatResponse(analysisPrompt, '');
          if (aiAnalysis) {
            console.log(`✅ AI analysis completed: ${aiAnalysis.length} characters`);
          }
        }

        // Create knowledge base document
        const knowledgeDocument = {
          videoId: vimeoId,
          title: video.name,
          description: video.description,
          duration: video.duration,
          vimeoUrl: video.link,
          transcript: transcript || 'No transcript available',
          aiAnalysis: aiAnalysis || 'No AI analysis performed',
          contentType: 'video',
          source: 'vimeo',
          processingDate: new Date().toISOString(),
          metadata: {
            created_time: video.created_time,
            hasTranscript: !!transcript,
            transcriptLength: transcript ? transcript.length : 0,
            hasAIAnalysis: !!aiAnalysis
          }
        };

        // Store in S3 for Knowledge Base ingestion
        console.log(`☁️  Uploading to S3: ${s3Key}`);
        const uploadResult = await s3Accessor.uploadContent(
          s3Key,
          JSON.stringify(knowledgeDocument, null, 2),
          'application/json'
        );

        if (!uploadResult.success) {
          throw new Error(`S3 upload failed: ${uploadResult.error}`);
        }

        // Also store processing record in MongoDB for tracking (if available)
        if (mongoAccessor) {
          try {
            await mongoAccessor.create('videoProcessingLogs', {
              vimeoId,
              title: video.name,
              s3Key,
              s3Url: uploadResult.url,
              processingStatus: 'completed',
              timestamp: new Date(),
              hasTranscript: !!transcript,
              hasAIAnalysis: !!aiAnalysis
            });
          } catch (error) {
            console.warn('Failed to log to MongoDB:', error);
          }
        }

        console.log(`✅ Successfully processed: ${video.name}`);
        
        results.push({
          vimeoId,
          title: video.name,
          transcript,
          aiAnalysis,
          s3Key,
          s3Url: uploadResult.url,
          success: true
        });
        
        successCount++;

        // Add small delay between videos to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ Failed to process ${video.name}:`, error);
        
        results.push({
          vimeoId,
          title: video.name,
          transcript: null,
          aiAnalysis: null,
          s3Key: null,
          s3Url: null,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        failCount++;
      }
    }

    if (mongoAccessor) {
      await mongoAccessor.disconnect();
    }

    const summary = {
      totalVideosFound: videosResponse.total,
      videosProcessed: videos.length,
      successful: successCount,
      failed: failCount,
      s3Bucket: s3BucketName,
      knowledgeBaseReady: true
    };

    console.log(`🎉 Processing complete: ${successCount}/${videos.length} successful`);
    console.log(`📁 Files stored in S3 bucket: ${s3BucketName}`);
    console.log(`🧠 Ready for Knowledge Base ingestion`);

    return NextResponse.json({
      success: true,
      message: 'Videos processed and stored for Knowledge Base ingestion',
      results,
      summary,
      nextSteps: [
        'Files are now stored in S3 bucket for Knowledge Base',
        'Trigger Knowledge Base data source sync to ingest new content',
        'Videos will be available for RAG queries after ingestion'
      ]
    });

  } catch (error) {
    console.error('Video processing error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Process Vimeo Videos to Knowledge Base',
    description: 'Processes Vimeo videos and stores them in S3 for AWS Bedrock Knowledge Base ingestion',
    endpoint: '/api/videos/process-to-knowledge-base',
    method: 'POST',
    parameters: {
      optional: [
        'limit - Number of videos to process (default: 10)',
        'processTranscripts - Extract video transcripts (default: true)',
        'analyzeContent - Perform AI analysis (default: true)',
        'query - Search query to filter videos (default: null)',
        'skipExisting - Skip videos already in S3 (default: true)'
      ]
    },
    configuration: {
      required_env_vars: [
        'VIMEO_ACCESS_TOKEN',
        'AWS_S3_KNOWLEDGE_BUCKET',
        'AWS_REGION'
      ],
      s3_bucket: process.env.AWS_S3_KNOWLEDGE_BUCKET || 'encompass-knowledgebase',
      knowledge_base_id: process.env.AWS_KNOWLEDGE_BASE_ID || 'L3AVNMAT2F'
    },
    example: {
      limit: 50,
      processTranscripts: true,
      analyzeContent: true,
      query: 'eyefinity',
      skipExisting: true
    }
  });
}

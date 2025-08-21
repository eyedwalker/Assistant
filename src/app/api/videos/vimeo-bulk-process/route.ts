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
  category?: string; // Video category for organization
  tags?: string; // Comma-separated tags for filtering
  autoCategorizize?: boolean; // Let AI determine categories
  processingMode?: 'new-only' | 'reprocess-all' | 'reprocess-failed'; // Processing strategy
  dateFilter?: {
    startDate?: string; // ISO date string - only process videos after this date
    endDate?: string; // ISO date string - only process videos before this date
  };
  forceReprocess?: boolean; // Force reprocessing even if already processed
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication - allow bypass in development
    const session = await getServerSession(authOptions);
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (!session && !isDevelopment) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: VimeoBulkProcessRequest = await request.json();
    const { 
      query, 
      limit = 100, 
      processTranscripts = true, 
      analyzeContent = true, 
      category = 'eyecare-training',
      tags = '',
      autoCategorizize = true,
      processingMode = 'new-only',
      dateFilter,
      forceReprocess = false
    } = body;

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
      let allVideos = await vimeoAccessor.fetchAllVideos(query);
      
      // Apply date filtering if specified
      if (dateFilter) {
        console.log('📅 Applying date filters...');
        allVideos = allVideos.filter(video => {
          const videoDate = new Date(video.created_time);
          let includeVideo = true;
          
          if (dateFilter.startDate) {
            const startDate = new Date(dateFilter.startDate);
            includeVideo = includeVideo && videoDate >= startDate;
          }
          
          if (dateFilter.endDate) {
            const endDate = new Date(dateFilter.endDate);
            includeVideo = includeVideo && videoDate <= endDate;
          }
          
          return includeVideo;
        });
        console.log(`📅 After date filtering: ${allVideos.length} videos`);
      }

      // Filter based on processing mode
      let videosToProcess = [];
      if (processingMode === 'new-only' && !forceReprocess) {
        console.log('🔍 Checking for already processed videos...');
        
        // Get list of already processed video IDs (using enhanced processing criteria)
        const processedVideos = await mongoAccessor.find('documents', {
          contentType: 'video',
          optimizedForAI: true,
          analysisVersion: '2.0'
        });
        
        const processedVimeoIds = new Set(processedVideos.map((v: any) => v.vimeoId));
        
        // Filter out already processed videos
        const newVideos = allVideos.filter(video => {
          const vimeoId = video.uri.split('/').pop()!;
          return !processedVimeoIds.has(vimeoId);
        });
        
        console.log(`🆕 Found ${newVideos.length} new videos to process (${allVideos.length - newVideos.length} already processed)`);
        videosToProcess = newVideos.slice(0, limit);
        
      } else if (processingMode === 'reprocess-failed') {
        console.log('🔄 Finding failed videos to reprocess...');
        
        // Get videos that failed processing (need enhanced analysis)
        const failedVideos = await mongoAccessor.find('documents', {
          contentType: 'video',
          $or: [
            { optimizedForAI: { $ne: true } },
            { analysisVersion: { $ne: '2.0' } },
            { aiAnalysis: { $exists: false } },
            { vspProduct: { $exists: false } }
          ]
        });
        
        const failedVimeoIds = new Set(failedVideos.map((v: any) => v.vimeoId));
        
        // Filter to only failed videos
        const videosToReprocess = allVideos.filter(video => {
          const vimeoId = video.uri.split('/').pop()!;
          return failedVimeoIds.has(vimeoId);
        });
        
        console.log(`❌ Found ${videosToReprocess.length} failed videos to reprocess`);
        videosToProcess = videosToReprocess.slice(0, limit);
        
      } else {
        // reprocess-all or forceReprocess = true
        console.log('🔄 Processing all videos (including reprocessing)...');
        videosToProcess = allVideos.slice(0, limit);
      }
      
      console.log(`📊 Final selection: Processing ${videosToProcess.length} videos`);

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

            // Enhanced AI analysis with Claude 3.5 Sonnet for eyecare training
            let suggestedCategory = category;
            let aiAnalysis = null;
            let vspProduct = 'General';
            let productFeatures: string[] = [];
            let productConfidence = 0;
            
            if (analyzeContent && (transcript || video.description)) {
              const enhancedPrompt = `You are an expert AI assistant specializing in eyecare training content analysis. Analyze this eyecare professional training video and provide comprehensive insights.

**Video Information:**
- Title: ${video.name}
- Description: ${video.description || 'N/A'}  
- Transcript: ${transcript && typeof transcript === 'string' ? transcript.substring(0, 3000) : 'Not available'}
- Tags: ${(video as any).tags?.map((t: any) => t.name || t.tag).join(', ') || 'None'}

**Analysis Required:**

1. **CONTENT SUMMARY** (2-3 professional sentences)
2. **KEY LEARNING OBJECTIVES** (3-5 specific, actionable points)
3. **CLINICAL RELEVANCE** (How this applies to patient care)
4. **VSP PRODUCT CATEGORIZATION:**
   - Primary Product: Officemate, Acuity Logic, EPM (Encompass Practice Management), Encompass, or General
   - Product Features: Contact Lens Management, Analytics & Insights, Billing & Claims, Patient Management, Training & Education, Integration, Online Services
   - Confidence Score: 0.0-1.0

5. **DIFFICULTY LEVEL:** Beginner, Intermediate, Advanced
6. **TARGET AUDIENCE:** Front desk, Clinical staff, Management, IT/Technical
7. **ESTIMATED LEARNING TIME:** Minutes to complete training

**Keywords to detect VSP products:**
- Officemate: Practice management, scheduling, patient records, front office, appointments
- Acuity Logic: EHR, electronic health records, clinical documentation, exam data
- EPM/Encompass: Practice management system, billing, claims processing
- Analytics & Insights: Reporting, dashboards, business intelligence, practice analytics

Return ONLY valid JSON:
{
  "summary": "string",
  "learningObjectives": ["string"],
  "clinicalRelevance": "string", 
  "vspProduct": "string",
  "productFeatures": ["string"],
  "productConfidence": 0.0,
  "difficultyLevel": "string",
  "targetAudience": ["string"],
  "estimatedTime": "string",
  "keyTopics": ["string"]
}`;
              
              try {
                const analysisResponse = await anthropicAccessor.generateChatResponse(enhancedPrompt);
                const analysis = JSON.parse(analysisResponse.message);
                
                aiAnalysis = `**Summary:** ${analysis.summary}

**Learning Objectives:**
${analysis.learningObjectives?.map((obj: string, i: number) => `${i + 1}. ${obj}`).join('\n') || 'Not specified'}

**Clinical Relevance:** ${analysis.clinicalRelevance || 'General eyecare training'}

**Target Audience:** ${analysis.targetAudience?.join(', ') || 'Eyecare professionals'}
**Difficulty:** ${analysis.difficultyLevel || 'Intermediate'}
**Estimated Time:** ${analysis.estimatedTime || '10-15 minutes'}

**Key Topics:** ${analysis.keyTopics?.join(', ') || 'General training'}`;

                vspProduct = analysis.vspProduct || 'General';
                productFeatures = analysis.productFeatures || [];
                productConfidence = analysis.productConfidence || 0;
                
              } catch (error) {
                console.error('Enhanced AI analysis failed:', error);
                // Fallback basic analysis
                aiAnalysis = `**Summary:** Training video covering eyecare procedures and best practices.

**Learning Objectives:**
1. Understand key concepts presented in the video
2. Apply learned techniques in clinical practice  
3. Improve patient care delivery

**Clinical Relevance:** Provides essential training for eyecare professionals to enhance patient care and operational efficiency.`;
              }
            }

            // Store processed video data in 'documents' collection for RAG integration
            const vimeoId = video.uri.split('/').pop()!;
            const videoDocument = {
              title: video.name,
              url: video.link,
              contentType: 'video',
              source: 'vimeo',
              vimeoId,
              extractedText: transcript || '',
              aiAnalysis: aiAnalysis || 'Training video for eyecare professionals',
              vspProduct,
              productFeatures,
              productConfidence,
              // Enhanced processing markers (matching standalone scripts)
              optimizedForAI: true,
              analysisVersion: '2.0',
              aiModel: 'claude-3-5-sonnet-20241022',
              reprocessedAt: new Date(),
              categorizedAt: new Date(),
              processingStatus: 'completed',
              processedAt: new Date(),
              accessLevel: 'PUBLIC',
              metadata: {
                duration: video.duration,
                thumbnail: (video as any).pictures?.sizes?.[3]?.link || '',
                vimeoCreated: video.created_time,
                vimeoModified: video.modified_time,
                category: suggestedCategory,
                tags: (video as any).tags?.map((t: any) => t.name || t.tag) || []
              }
            };

            // Upsert the video document in the 'documents' collection
            const existingVideo = await mongoAccessor.find('documents', { 
              contentType: 'video', 
              vimeoId 
            });
            
            if (existingVideo.length > 0) {
              await mongoAccessor.update(
                'documents',
                existingVideo[0]._id.toString(),
                videoDocument
              );
              console.log(`✅ Updated existing video: ${video.name}`);
            } else {
              await mongoAccessor.create('documents', videoDocument);
              console.log(`✅ Created new video document: ${video.name}`);
            }

            results.successful++;
            results.jobs.push({
              vimeoId: video.uri.split('/').pop(),
              name: video.name,
              status: 'processed'
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

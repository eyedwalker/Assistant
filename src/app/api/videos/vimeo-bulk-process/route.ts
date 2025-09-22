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
      process.env.AWS_S3_KNOWLEDGE_BUCKET || 'encompass-knowledgebase',
      process.env.AWS_REGION || 'us-west-2'
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
          analysisVersion: '3.0',  // Only skip videos with latest analysis version
          s3Key: { $exists: true }  // Only skip videos already stored in S3
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
            { analysisVersion: { $ne: '3.0' } },  // Updated to current version
            { aiAnalysis: { $exists: false } },
            { vspProduct: { $exists: false } },
            { s3Key: { $exists: false } }  // Include videos not in S3
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

            // Get transcript if available with enhanced detection
            let transcript = null;
            if (processTranscripts) {
              const vimeoId = video.uri.split('/').pop()!;
              console.log(`🗣️  Checking transcript for ${video.name}...`);
              
              transcript = await vimeoAccessor.getVideoTranscript(vimeoId);
              
              if (transcript && transcript.length > 10) {
                console.log(`✅ Transcript found: ${transcript.length} characters`);
              } else {
                console.log(`⚠️  No transcript available for ${video.name}`);
                // Try to extract text from description or title for analysis
                if (video.description && video.description.length > 20) {
                  transcript = `Video Description: ${video.description}`;
                  console.log(`📝 Using description as fallback: ${transcript.length} chars`);
                }
              }
            }

            // Enhanced AI analysis with Claude 3.5 Sonnet for eyecare training
            let suggestedCategory = category;
            let aiAnalysis = null;
            let vspProduct = 'General';
            let productFeatures: string[] = [];
            let productConfidence = 0;
            
            if (analyzeContent) {
              console.log(`🤖 Starting enhanced AI analysis for ${video.name}...`);
              
              // Enhanced content analysis using latest Claude model
              const contentToAnalyze = [
                `Title: ${video.name}`,
                video.description ? `Description: ${video.description}` : '',
                transcript && transcript.length > 10 ? `Transcript: ${transcript.substring(0, 4000)}` : '',
                (video as any).tags?.length ? `Tags: ${(video as any).tags.map((t: any) => t.name || t.tag).join(', ')}` : ''
              ].filter(Boolean).join('\n\n');
              
              const enhancedPrompt = `You are an expert AI assistant specializing in VSP eyecare training content analysis. Analyze this eyecare professional training video comprehensively.

**CONTENT TO ANALYZE:**
${contentToAnalyze}

**DETAILED ANALYSIS REQUIRED:**

1. **COMPREHENSIVE SUMMARY** (3-4 detailed sentences covering key concepts)
2. **SPECIFIC LEARNING OBJECTIVES** (4-6 actionable, measurable points)
3. **CLINICAL RELEVANCE & APPLICATIONS** (Detailed patient care impact)
4. **VSP PRODUCT IDENTIFICATION:**
   - Primary Product: Eyefinity, Officemate, Acuity Logic, EPM, Encompass, Analytics & Insights, or General
   - Specific Features: Frame Selection, Contact Lens Management, EHR Integration, Billing & Claims, Patient Scheduling, Insurance Processing, Reporting, Training Modules
   - Confidence Score: 0.0-1.0 (be honest about uncertainty)
   - Reasoning: Why you selected this product/confidence level

5. **SKILL LEVEL & AUDIENCE:**
   - Difficulty: Beginner/Intermediate/Advanced
   - Primary Audience: Front Desk, Opticians, Clinical Staff, Management, IT
   - Prerequisites: What knowledge is assumed

6. **PRACTICAL DETAILS:**
   - Estimated Duration: Realistic time to complete
   - Key Procedures: Step-by-step processes covered
   - Common Issues: Problems this training addresses

**ENHANCED VSP PRODUCT DETECTION:**
- **Eyefinity**: Practice management suite, comprehensive system, all-in-one solution
- **Officemate**: Scheduling, appointments, patient flow, front office operations
- **Acuity Logic**: EHR, clinical documentation, exam workflows, patient records
- **EPM/Encompass**: Billing, claims, insurance processing, financial management
- **Analytics & Insights**: Reports, KPIs, business intelligence, practice metrics
- **Frame/Contact Management**: Inventory, dispensing, fitting, product selection

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
                console.log(`🔍 Sending to Claude for analysis (${contentToAnalyze.length} chars)...`);
                const analysisResponse = await anthropicAccessor.generateChatResponse(enhancedPrompt, '');
                
                // Handle ChatResponse type properly
                const responseText = typeof analysisResponse === 'string' ? analysisResponse : analysisResponse.message;
                
                let analysis;
                try {
                  analysis = JSON.parse(responseText);
                } catch (parseError) {
                  console.warn('JSON parse failed, extracting data from text response');
                  // Fallback: try to extract data from text response
                  const textLower = responseText.toLowerCase();
                  analysis = {
                    summary: responseText.substring(0, 500),
                    learningObjectives: ['Enhanced training content'],
                    clinicalRelevance: 'Eyecare professional development',
                    vspProduct: textLower.includes('eyefinity') ? 'Eyefinity' : 
                               textLower.includes('officemate') ? 'Officemate' : 'General',
                    productFeatures: ['Training & Education'],
                    productConfidence: 0.5,
                    difficultyLevel: 'Intermediate',
                    targetAudience: ['Eyecare professionals'],
                    estimatedTime: '10-15 minutes',
                    keyTopics: [video.name]
                  };
                }
                
                aiAnalysis = `**COMPREHENSIVE SUMMARY:**
${analysis.summary || 'Training video covering essential eyecare concepts and procedures.'}

**LEARNING OBJECTIVES:**
${analysis.learningObjectives?.map((obj: string, i: number) => `${i + 1}. ${obj}`).join('\n') || '1. Understand key concepts\n2. Apply techniques in practice\n3. Improve patient care delivery'}

**CLINICAL RELEVANCE:**
${analysis.clinicalRelevance || 'Provides essential training for eyecare professionals to enhance patient care and operational efficiency.'}

**VSP PRODUCT FOCUS:**
- Primary Product: ${analysis.vspProduct || 'General'}
- Key Features: ${analysis.productFeatures?.join(', ') || 'General training'}
- Confidence Level: ${Math.round((analysis.productConfidence || 0) * 100)}%
${analysis.reasoning ? `- Reasoning: ${analysis.reasoning}` : ''}

**TRAINING DETAILS:**
- Target Audience: ${analysis.targetAudience?.join(', ') || 'Eyecare professionals'}
- Difficulty Level: ${analysis.difficultyLevel || 'Intermediate'}
- Estimated Duration: ${analysis.estimatedTime || '10-15 minutes'}
${analysis.prerequisites ? `- Prerequisites: ${analysis.prerequisites}` : ''}

**KEY TOPICS & PROCEDURES:**
${analysis.keyTopics?.join(', ') || video.name}
${analysis.keyProcedures?.join('\n') || ''}
${analysis.commonIssues ? `\n**COMMON ISSUES ADDRESSED:**\n${analysis.commonIssues}` : ''}`;

                vspProduct = analysis.vspProduct || 'General';
                productFeatures = analysis.productFeatures || ['Training & Education'];
                productConfidence = analysis.productConfidence || 0.3;
                
                console.log(`✅ AI Analysis complete - Product: ${vspProduct} (${Math.round(productConfidence * 100)}% confidence)`);
                
              } catch (error) {
                console.error('Enhanced AI analysis failed:', error);
                
                // Enhanced fallback analysis based on video title and available content
                const titleLower = video.name.toLowerCase();
                let detectedProduct = 'General';
                let detectedFeatures = ['Training & Education'];
                let confidence = 0.2;
                
                if (titleLower.includes('eyefinity') || titleLower.includes('pupils of eyefinity')) {
                  detectedProduct = 'Eyefinity';
                  detectedFeatures = ['Practice Management', 'Training & Education'];
                  confidence = 0.8;
                } else if (titleLower.includes('officemate')) {
                  detectedProduct = 'Officemate';
                  detectedFeatures = ['Scheduling', 'Patient Management'];
                  confidence = 0.8;
                } else if (titleLower.includes('encompass') || titleLower.includes('billing') || titleLower.includes('claims')) {
                  detectedProduct = 'EPM';
                  detectedFeatures = ['Billing & Claims', 'Financial Management'];
                  confidence = 0.7;
                } else if (titleLower.includes('contact lens') || titleLower.includes('lens')) {
                  detectedFeatures = ['Contact Lens Management', 'Clinical Procedures'];
                  confidence = 0.6;
                } else if (titleLower.includes('frame') || titleLower.includes('optical')) {
                  detectedFeatures = ['Frame Selection', 'Optical Services'];
                  confidence = 0.6;
                }
                
                vspProduct = detectedProduct;
                productFeatures = detectedFeatures;
                productConfidence = confidence;
                
                aiAnalysis = `**COMPREHENSIVE SUMMARY:**
This ${detectedProduct} training video covers essential eyecare procedures and best practices for ${detectedFeatures.join(' and ')}.

**LEARNING OBJECTIVES:**
1. Understand key concepts and procedures presented in the training
2. Apply learned techniques effectively in clinical practice
3. Improve patient care delivery and satisfaction
4. Master ${detectedProduct !== 'General' ? detectedProduct + ' system' : 'eyecare'} workflows and processes

**CLINICAL RELEVANCE:**
Provides essential training for eyecare professionals to enhance patient care, operational efficiency, and ${detectedFeatures.join(', ').toLowerCase()} capabilities.

**VSP PRODUCT FOCUS:**
- Primary Product: ${detectedProduct}
- Key Features: ${detectedFeatures.join(', ')}
- Confidence Level: ${Math.round(confidence * 100)}%

**TRAINING DETAILS:**
- Target Audience: Eyecare professionals, ${detectedProduct !== 'General' ? detectedProduct + ' users' : 'clinical staff'}
- Difficulty Level: Intermediate
- Estimated Duration: ${Math.max(Math.round(video.duration / 60), 2)}-${Math.max(Math.round(video.duration / 60) + 3, 5)} minutes

**KEY TOPICS & PROCEDURES:**
${video.name} - Core training module

**NOTE:** Analysis based on title and metadata due to limited transcript data. Enhanced analysis available with full transcript.`;
                
                console.log(`⚠️  Using fallback analysis - Product: ${detectedProduct} (${Math.round(confidence * 100)}% confidence)`);
              }
            }

            // Create knowledge base document for S3 storage
            const vimeoId = video.uri.split('/').pop()!;
            const knowledgeDocument = {
              videoId: vimeoId,
              title: video.name,
              description: video.description || '',
              duration: video.duration,
              vimeoUrl: video.link,
              transcript: transcript || 'No transcript available',
              aiAnalysis: aiAnalysis || 'Training video for eyecare professionals',
              vspProduct,
              productFeatures,
              productConfidence,
              contentType: 'video',
              source: 'vimeo',
              processingDate: new Date().toISOString(),
              // Enhanced processing markers
              optimizedForAI: true,
              analysisVersion: '3.0',
              aiModel: 'claude-3-5-sonnet-enhanced',
              metadata: {
                duration: video.duration,
                thumbnail: (video as any).pictures?.sizes?.[3]?.link || '',
                created_time: video.created_time,
                modified_time: video.modified_time,
                category: suggestedCategory,
                tags: (video as any).tags?.map((t: any) => t.name || t.tag) || [],
                hasTranscript: !!transcript,
                transcriptLength: transcript ? transcript.length : 0,
                hasAIAnalysis: !!aiAnalysis
              }
            };

            // Store in S3 for Knowledge Base ingestion
            const sanitizedTitle = video.name.replace(/[^a-zA-Z0-9\-_\.]/g, '_');
            const s3Key = `vimeo-videos/${vimeoId}/${sanitizedTitle}.json`;
            
            const uploadResult = await s3Accessor.uploadContent(
              s3Key,
              JSON.stringify(knowledgeDocument, null, 2),
              'application/json'
            );

            if (!uploadResult.success) {
              throw new Error(`S3 upload failed: ${uploadResult.error}`);
            }

            // Also store in MongoDB for backwards compatibility and internal tracking
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
              s3Key,
              s3Url: uploadResult.url,
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

            console.log(`☁️  Stored in S3 for Knowledge Base: ${s3Key}`);

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

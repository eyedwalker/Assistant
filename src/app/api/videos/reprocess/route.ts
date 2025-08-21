import { NextRequest, NextResponse } from 'next/server';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import { VimeoAccessor } from '@/lib/accessors/VimeoAccessor';
import { BedrockAccessor } from '@/lib/accessors/BedrockAccessor';
import { getServerSession } from 'next-auth';

const mongoAccessor = new MongoDBAccessor(
  process.env.MONGODB_URI!,
  process.env.MONGODB_DB_NAME || 'ai-assistant-platform'
);

const vimeoAccessor = new VimeoAccessor(process.env.VIMEO_ACCESS_TOKEN!);
const bedrockAccessor = new BedrockAccessor({
  region: process.env.AWS_BEDROCK_REGION || 'us-east-1',
  modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20240620-v1:0'
});

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await mongoAccessor.connect();
    const { videoId } = await request.json();

    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    // Find the video in MongoDB
    const existingVideo = await mongoAccessor.findById('documents', videoId);
    if (!existingVideo) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const vimeoId = existingVideo.vimeoId || videoId;
    console.log(`🔄 Reprocessing video: ${vimeoId}`);

    // Fetch fresh video data from Vimeo
    const videoDetails = await vimeoAccessor.getVideo(vimeoId);
    if (!videoDetails) {
      return NextResponse.json({ error: 'Video not found on Vimeo' }, { status: 404 });
    }

    // Get fresh transcript
    const transcriptData = await vimeoAccessor.getVideoTranscript(vimeoId);
    let transcriptText = '';
    
    if (transcriptData?.data?.[0]?.link) {
      try {
        const vttResponse = await fetch(transcriptData.data[0].link);
        if (vttResponse.ok) {
          const vttContent = await vttResponse.text();
          // Parse VTT content to extract text
          transcriptText = vttContent
            .split('\n')
            .filter(line => line.trim() && 
              !line.includes('-->') && 
              !line.startsWith('WEBVTT') && 
              !line.match(/^\d+$/))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        }
      } catch (error) {
        console.error('Error fetching VTT content:', error);
      }
    }

    if (!transcriptText) {
      return NextResponse.json({ error: 'No transcript available for this video' }, { status: 400 });
    }

    // Enhanced AI analysis with AWS Bedrock
    const analysisPrompt = `Please analyze this VSP training video transcript and provide a comprehensive analysis in the following format:

**Summary:** (2-3 sentence overview of the video content)

**Learning Objectives:**
- (List 3-5 specific learning objectives)

**Clinical Relevance:** (How this applies to eye care practice)

**Key Topics:**
- (List main topics covered)

**Target Audience:** (Who should watch this video)

**Difficulty Level:** (Beginner/Intermediate/Advanced)

**Estimated Time to Complete:** (Including any exercises)

**Product Categorization:**
Based on the content, categorize this video into one of these VSP product categories:
- Eyefinity Practice Management
- Officemate
- RevolutionEHR
- FameData
- VSP Optics
- VSP Vision Care
- General (if none of the above fit)

**Product Features:** (List specific product features or capabilities mentioned)

**Confidence Level:** (Rate your confidence in the product categorization from 0.0 to 1.0)

Transcript to analyze:
${transcriptText.slice(0, 8000)}`;

    const aiAnalysis = await bedrockAccessor.generateContent(analysisPrompt);
    
    // Parse the AI analysis to extract structured data
    const extractProductInfo = (analysis: string) => {
      const productMatch = analysis.match(/\*\*Product Categorization:\*\*[\s\S]*?- (Eyefinity Practice Management|Officemate|RevolutionEHR|FameData|VSP Optics|VSP Vision Care|General)/i);
      const confidenceMatch = analysis.match(/\*\*Confidence Level:\*\*.*?(0\.\d+|1\.0)/);
      const featuresMatch = analysis.match(/\*\*Product Features:\*\*([\s\S]*?)(?=\*\*|$)/);
      
      let features: string[] = [];
      if (featuresMatch) {
        features = featuresMatch[1]
          .split('\n')
          .filter(line => line.trim().startsWith('-'))
          .map(line => line.replace(/^-\s*/, '').trim())
          .filter(feature => feature.length > 0);
      }

      return {
        vspProduct: productMatch ? productMatch[1] : 'General',
        productConfidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5,
        productFeatures: features
      };
    };

    const { vspProduct, productConfidence, productFeatures } = extractProductInfo(aiAnalysis);

    // Update the video document in MongoDB
    const updatedVideo = {
      ...existingVideo,
      title: videoDetails.name,
      description: videoDetails.description || '',
      duration: videoDetails.duration,
      transcript: transcriptText,
      transcriptLength: transcriptText.length,
      aiAnalysis,
      aiModel: 'claude-3-5-sonnet-20240620-v1:0',
      analysisVersion: 'enhanced-v2',
      vspProduct,
      productConfidence,
      productFeatures,
      processedAt: new Date().toISOString(),
      reprocessedAt: new Date().toISOString(),
      contentMetrics: {
        hasTranscript: transcriptText.length > 0,
        hasAIAnalysis: aiAnalysis.length > 0,
        hasProductCategorization: vspProduct !== 'General',
        transcriptWordCount: transcriptText.split(' ').length,
        analysisWordCount: aiAnalysis.split(' ').length
      }
    };

    await mongoAccessor.updateWithFilter(
      'documents',
      { _id: existingVideo._id },
      updatedVideo
    );

    console.log(`✅ Successfully reprocessed video: ${videoDetails.name}`);

    return NextResponse.json({
      success: true,
      message: 'Video reprocessed successfully',
      videoId,
      vspProduct,
      productConfidence: Math.round(productConfidence * 100) + '%'
    });

  } catch (error) {
    console.error('❌ Video reprocessing error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reprocess video'
      },
      { status: 500 }
    );
  }
}

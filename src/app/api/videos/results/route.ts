import { NextRequest, NextResponse } from 'next/server';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import { detectProduct } from '@/lib/utils/productDetection';

function getTranscriptText(extractedText: any): string {
  // Handle case where extractedText is already a string
  if (typeof extractedText === 'string') {
    return extractedText;
  }
  
  // Handle case where extractedText is a Vimeo API response object
  if (extractedText && typeof extractedText === 'object' && extractedText.data) {
    // This indicates the field contains the raw Vimeo API response instead of extracted text
    return '';
  }
  
  return '';
}

const mongoAccessor = new MongoDBAccessor(
  process.env.MONGODB_URI!,
  process.env.MONGODB_DB_NAME || 'ai-assistant-platform'
);

export async function GET(request: NextRequest) {
  try {
    await mongoAccessor.connect();
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const vimeoId = searchParams.get('vimeoId');
    
    // Build query
    let query: any = { 
      contentType: 'video'
    };
    
    if (vimeoId) {
      query.vimeoId = vimeoId;
    }
    
    if (category && category !== 'all') {
      query.vspProduct = category;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { aiAnalysis: { $regex: search, $options: 'i' } },
        { extractedText: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Get total count
    const total = await mongoAccessor.count('documents', query);
    
    // Get videos with pagination
    const videos = await mongoAccessor.find('documents', query, {
      sort: { reprocessedAt: -1 },
      skip: (page - 1) * limit,
      limit
    });
    
    // Format results with detailed analysis
    const formattedResults = videos.map(video => {
      const detectedProduct = detectProduct(video.title, video.description || '', video.extractedText || '');
      
      return {
        id: video._id,
        vimeoId: video.vimeoId,
        title: video.title,
        url: video.url,
        description: video.description || '',
        
        // Processing metadata
        processedAt: video.reprocessedAt || video.processedAt,
        aiModel: video.aiModel,
        analysisVersion: video.analysisVersion,
        
        // Content analysis
        transcriptLength: getTranscriptText(video.extractedText)?.length || 0,
        transcript: getTranscriptText(video.extractedText) || '',
        aiAnalysis: video.aiAnalysis || '',
        
        // VSP Product categorization
        vspProduct: video.vspProduct || detectedProduct,
        productFeatures: video.productFeatures || [],
        productConfidence: video.productConfidence || 0,
        
        // Video metadata
        duration: video.metadata?.duration || 0,
        thumbnail: video.metadata?.thumbnail || '',
        vimeoCreated: video.metadata?.vimeoCreated,
        tags: video.metadata?.tags || [],
        
        // Learning content extracted by AI
        learningContent: extractLearningContent(video.aiAnalysis || ''),
        
        // Usefulness metrics
        contentMetrics: {
          hasTranscript: Boolean(getTranscriptText(video.extractedText) && getTranscriptText(video.extractedText).length > 0),
          hasAIAnalysis: Boolean(video.aiAnalysis && typeof video.aiAnalysis === 'string' && video.aiAnalysis.length > 0),
          hasProductCategorization: Boolean(video.vspProduct && video.vspProduct !== 'General'),
          transcriptWordCount: getTranscriptText(video.extractedText) ? getTranscriptText(video.extractedText).split(' ').filter((w: string) => w.length > 0).length : 0,
          analysisWordCount: (video.aiAnalysis && typeof video.aiAnalysis === 'string') ? video.aiAnalysis.split(' ').filter((w: string) => w.length > 0).length : 0
        }
      };
    });
    
    // Category statistics
    const categoryStats = await getCategoryStats(mongoAccessor);
    
    return NextResponse.json({
      success: true,
      data: {
        videos: formattedResults,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        },
        categoryStats,
        summary: {
          totalVideos: total,
          avgTranscriptLength: formattedResults.reduce((sum, v) => sum + v.transcriptLength, 0) / formattedResults.length || 0,
          avgAnalysisLength: formattedResults.reduce((sum, v) => sum + (v.aiAnalysis?.length || 0), 0) / formattedResults.length || 0,
          productsIdentified: [...new Set(formattedResults.map(v => v.vspProduct))].length,
          processingModels: [...new Set(formattedResults.map(v => v.aiModel))].filter(Boolean)
        }
      }
    });
    
  } catch (error) {
    console.error('Video results API error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : typeof error
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch video results',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    await mongoAccessor.disconnect();
  }
}

function extractLearningContent(aiAnalysis: string) {
  const content = {
    summary: '',
    learningObjectives: [] as string[],
    clinicalRelevance: '',
    keyTopics: [] as string[],
    targetAudience: [] as string[],
    difficultyLevel: '',
    estimatedTime: ''
  };
  
  if (!aiAnalysis) return content;
  
  // Extract summary
  const summaryMatch = aiAnalysis.match(/\*\*Summary:\*\*([\s\S]*?)(?=\*\*|$)/);
  if (summaryMatch) {
    content.summary = summaryMatch[1].trim();
  }
  
  // Extract learning objectives
  const objectivesMatch = aiAnalysis.match(/\*\*Learning Objectives:\*\*([\s\S]*?)(?=\*\*|$)/);
  if (objectivesMatch) {
    const objectives = objectivesMatch[1].match(/\d+\.\s*([^\n]+)/g);
    if (objectives) {
      content.learningObjectives = objectives.map(obj => obj.replace(/^\d+\.\s*/, '').trim());
    }
  }
  
  // Extract clinical relevance
  const clinicalMatch = aiAnalysis.match(/\*\*Clinical Relevance:\*\*([\s\S]*?)(?=\*\*|$)/);
  if (clinicalMatch) {
    content.clinicalRelevance = clinicalMatch[1].trim();
  }
  
  // Extract target audience
  const audienceMatch = aiAnalysis.match(/\*\*Target Audience:\*\*([\s\S]*?)(?=\*\*|$)/);
  if (audienceMatch) {
    content.targetAudience = audienceMatch[1].split(',').map(a => a.trim()).filter(Boolean);
  }
  
  // Extract difficulty level
  const difficultyMatch = aiAnalysis.match(/\*\*Difficulty:\*\*([\s\S]*?)(?=\*\*|$)/);
  if (difficultyMatch) {
    content.difficultyLevel = difficultyMatch[1].trim();
  }
  
  // Extract estimated time
  const timeMatch = aiAnalysis.match(/\*\*Estimated Time:\*\*([\s\S]*?)(?=\*\*|$)/);
  if (timeMatch) {
    content.estimatedTime = timeMatch[1].trim();
  }
  
  // Extract key topics
  const topicsMatch = aiAnalysis.match(/\*\*Key Topics:\*\*([\s\S]*?)(?=\*\*|$)/);
  if (topicsMatch) {
    content.keyTopics = topicsMatch[1].split(',').map(t => t.trim()).filter(Boolean);
  }
  
  return content;
}

async function getCategoryStats(accessor: MongoDBAccessor) {
  try {
    const pipeline = [
      { $match: { contentType: 'video' } },
      { $group: { _id: '$vspProduct', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ];
    
    const stats = await accessor.aggregate('documents', pipeline);
    return stats.map((stat: any) => ({
      category: stat._id || 'General',
      count: stat.count
    }));
  } catch (error) {
    console.error('Failed to get category stats:', error);
    return [];
  }
}

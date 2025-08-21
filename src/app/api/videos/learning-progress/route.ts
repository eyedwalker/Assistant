import { NextRequest, NextResponse } from 'next/server';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import { getTopicAnalysis } from '@/lib/utils/productDetection';

const mongoAccessor = new MongoDBAccessor(
  process.env.MONGODB_URI!,
  process.env.MONGODB_DB_NAME || 'ai-assistant-platform'
);

export async function GET(request: NextRequest) {
  try {
    await mongoAccessor.connect();
    
    // Processing statistics (matching monitor-learning-progress.js)
    const totalVideos = await mongoAccessor.count('documents', { contentType: 'video' });
    const enhancedVideos = await mongoAccessor.count('documents', { 
      contentType: 'video',
      optimizedForAI: true,
      analysisVersion: '2.0'
    });
    
    // Get all enhanced videos for topic analysis
    const videos = await mongoAccessor.find('documents', {
      contentType: 'video',
      optimizedForAI: true
    });
    
    // Get recent videos
    const recentVideos = await mongoAccessor.find('documents', {
      contentType: 'video',
      optimizedForAI: true
    }, {
      sort: { reprocessedAt: -1 },
      limit: 5
    });
    
    // Topic analysis
    const topicCounts = getTopicAnalysis(videos);
    
    const progress = {
      processing: {
        total: totalVideos,
        enhanced: enhancedVideos,
        pending: totalVideos - enhancedVideos,
        percentage: Math.round((enhancedVideos / totalVideos) * 100)
      },
      knowledgeAreas: Object.entries(topicCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([topic, count]) => ({ topic, count })),
      recentLearning: recentVideos.map(video => ({
        title: video.title,
        aiModel: video.aiModel,
        enhancedAt: video.reprocessedAt,
        url: video.url
      })),
      capabilities: {
        procedures: enhancedVideos,
        stepByStepInstructions: true,
        questionAnswering: true,
        implementationTips: true,
        relatedTopics: true
      }
    };
    
    return NextResponse.json({
      success: true,
      data: progress
    });
    
  } catch (error) {
    console.error('Learning progress API error:', error);
    return NextResponse.json(
      { error: 'Failed to get learning progress' },
      { status: 500 }
    );
  } finally {
    await mongoAccessor.disconnect();
  }
}

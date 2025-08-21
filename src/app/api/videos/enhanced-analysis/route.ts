import { NextRequest, NextResponse } from 'next/server';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';

const mongoAccessor = new MongoDBAccessor(
  process.env.MONGODB_URI!,
  process.env.MONGODB_DB_NAME || 'ai-assistant-platform'
);

export async function GET(request: NextRequest) {
  try {
    await mongoAccessor.connect();
    
    // Check for enhanced videos (matching check-enhanced-analysis.js)
    const enhancedVideos = await mongoAccessor.find('documents', {
      contentType: 'video',
      optimizedForAI: true,
      analysisVersion: '2.0'
    });
    
    const totalVideos = await mongoAccessor.count('documents', { contentType: 'video' });
    const pendingVideos = totalVideos - enhancedVideos.length;
    
    // Sample enhanced analysis
    const sampleVideo = enhancedVideos.length > 0 ? enhancedVideos[0] : null;
    
    const result = {
      enhancedCount: enhancedVideos.length,
      totalCount: totalVideos,
      pendingCount: pendingVideos,
      progress: Math.round((enhancedVideos.length / totalVideos) * 100),
      sampleAnalysis: sampleVideo ? {
        title: sampleVideo.title,
        aiModel: sampleVideo.aiModel,
        reprocessedAt: sampleVideo.reprocessedAt,
        analysisVersion: sampleVideo.analysisVersion,
        aiAnalysisPreview: sampleVideo.aiAnalysis?.substring(0, 1000) + '...',
        url: sampleVideo.url
      } : null,
      dataStructure: {
        title: 'Video title',
        url: 'Vimeo URL for watching',
        extractedText: 'Full transcript',
        aiAnalysis: 'Enhanced analysis (learning objectives, procedures, Q&As)',
        aiModel: 'claude-3-5-sonnet-20241022',
        optimizedForAI: true,
        analysisVersion: '2.0',
        reprocessedAt: 'timestamp'
      }
    };
    
    return NextResponse.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Enhanced analysis API error:', error);
    return NextResponse.json(
      { error: 'Failed to get enhanced analysis data' },
      { status: 500 }
    );
  } finally {
    await mongoAccessor.disconnect();
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { VimeoAccessor } from '@/lib/accessors/VimeoAccessor';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const search = searchParams.get('search') || '';

    if (!process.env.VIMEO_ACCESS_TOKEN) {
      return NextResponse.json({
        success: false,
        error: 'Vimeo access token not configured'
      }, { status: 500 });
    }

    const vimeoAccessor = new VimeoAccessor(process.env.VIMEO_ACCESS_TOKEN);
    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI!,
      process.env.MONGODB_DB_NAME!
    );

    // Connect to MongoDB
    await mongoAccessor.connect();

    // Get all processed video IDs from MongoDB
    const processedVideos = await mongoAccessor.find('documents', 
      { contentType: 'video', source: 'vimeo' }
    );

    const processedVideoIds = new Set(processedVideos.map((v: any) => v.vimeoId));
    const processedVideoMap = new Map(processedVideos.map((v: any) => [v.vimeoId, v]));

    // Fetch videos from Vimeo
    const vimeoResponse = await vimeoAccessor.getAllVideos({
      page,
      perPage: limit,
      query: search,
      fields: 'uri,name,description,duration,link,pictures,created_time,modified_time'
    });

    // Combine Vimeo data with processing status
    const videosWithStatus = vimeoResponse.data.map((video: any) => {
      const vimeoId = video.uri.split('/').pop();
      const isProcessed = processedVideoIds.has(vimeoId);
      const processedData = processedVideoMap.get(vimeoId);

      return {
        vimeoId,
        title: video.name,
        description: video.description,
        duration: video.duration,
        url: video.link,
        thumbnailUrl: video.pictures?.sizes?.[0]?.link || null,
        createdAt: video.created_time,
        isProcessed,
        processedAt: processedData?.processedAt || null,
        hasTranscript: isProcessed && !!processedData?.extractedText,
        hasAIAnalysis: isProcessed && !!processedData?.aiAnalysis,
        vspProduct: processedData?.vspProduct || null,
        transcriptLength: processedData?.extractedText?.length || 0
      };
    });

    // Get total count for pagination
    const totalVideos = vimeoResponse.total;
    const totalPages = Math.ceil(totalVideos / limit);

    await mongoAccessor.disconnect();

    return NextResponse.json({
      success: true,
      data: {
        videos: videosWithStatus,
        pagination: {
          page,
          limit,
          totalVideos,
          totalPages,
          hasNext: vimeoResponse.paging.next !== null,
          hasPrev: vimeoResponse.paging.previous !== null
        },
        summary: {
          total: videosWithStatus.length,
          processed: videosWithStatus.filter(v => v.isProcessed).length,
          unprocessed: videosWithStatus.filter(v => !v.isProcessed).length,
          withTranscript: videosWithStatus.filter(v => v.hasTranscript).length,
          withAIAnalysis: videosWithStatus.filter(v => v.hasAIAnalysis).length
        }
      }
    });

  } catch (error) {
    console.error('Error fetching Vimeo status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch video status'
    }, { status: 500 });
  }
}

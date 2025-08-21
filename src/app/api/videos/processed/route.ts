import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const query = searchParams.get('query') || '';
    const tags = searchParams.get('tags') || '';
    
    // Fetch videos from Vimeo
    const vimeoUrl = new URL('https://api.vimeo.com/me/videos');
    vimeoUrl.searchParams.append('page', page.toString());
    vimeoUrl.searchParams.append('per_page', limit.toString());
    
    if (query) {
      vimeoUrl.searchParams.append('query', query);
    }

    const vimeoResponse = await fetch(vimeoUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    });

    if (!vimeoResponse.ok) {
      throw new Error('Failed to fetch videos from Vimeo');
    }

    const vimeoData = await vimeoResponse.json();
    
    // Filter by tags if provided
    let filteredVideos = vimeoData.data;
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim().toLowerCase());
      filteredVideos = vimeoData.data.filter((video: any) => {
        if (!video.tags || !Array.isArray(video.tags)) return false;
        const videoTags = video.tags.map((t: any) => (t.name || t.tag || '').toLowerCase());
        return tagList.some(tag => videoTags.includes(tag));
      });
    }

    // Get processing data from MongoDB
    const mongoAccessor = new MongoDBAccessor();
    const videoIds = filteredVideos.map((v: any) => v.uri.split('/').pop());
    
    // Fetch processed video data
    const processedVideos = await mongoAccessor.find(
      'videoContent',
      { 
        'source.vimeoId': { $in: videoIds }
      }
    );

    // Create a map for quick lookup
    const processedMap = new Map();
    processedVideos.forEach((pv: any) => {
      if (pv.source?.vimeoId) {
        processedMap.set(pv.source.vimeoId, pv);
      }
    });

    // Combine Vimeo data with processing data
    const enrichedVideos = filteredVideos.map((video: any) => {
      const vimeoId = video.uri.split('/').pop();
      const processed = processedMap.get(vimeoId);
      
      return {
        id: vimeoId,
        name: video.name,
        description: video.description,
        duration: video.duration,
        thumbnail: video.pictures?.sizes?.[2]?.link || video.pictures?.sizes?.[0]?.link,
        tags: video.tags?.map((t: any) => t.name || t.tag) || [],
        created_time: video.created_time,
        // Processing data
        processed: !!processed,
        processingStatus: processed?.processingStatus || 'not_started',
        processedAt: processed?.processedAt,
        // AI Analysis
        aiSummary: processed?.aiSummary || null,
        keyInsights: processed?.keyInsights || [],
        suggestedCategory: processed?.suggestedCategory || null,
        // Transcript
        transcript: processed?.transcript || null,
        transcriptStatus: processed?.transcriptStatus || 'not_started',
        // Additional metadata
        topics: processed?.topics || [],
        confidence: processed?.confidence || 0
      };
    });

    return NextResponse.json({
      videos: enrichedVideos,
      pagination: {
        page,
        perPage: limit,
        total: vimeoData.total,
        paging: vimeoData.paging
      }
    });

  } catch (error) {
    console.error('Error fetching processed videos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch processed videos' },
      { status: 500 }
    );
  }
}

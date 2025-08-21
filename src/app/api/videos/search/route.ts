import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const VIMEO_ACCESS_TOKEN = process.env.VIMEO_ACCESS_TOKEN;

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get search parameters
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('per_page') || '20');
    const sort = searchParams.get('sort') || 'relevant';
    const tags = searchParams.get('tags') || ''; // Comma-separated tags

    if (!VIMEO_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: 'Vimeo API not configured' },
        { status: 500 }
      );
    }

    // Build parameters for Vimeo API
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    params.append('page', page.toString());
    params.append('per_page', perPage.toString());
    params.append('direction', 'desc');
    
    // Search videos in user's Vimeo account
    const vimeoUrl = `https://api.vimeo.com/me/videos?${params.toString()}`;

    const response = await fetch(vimeoUrl, {
      headers: {
        'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    });

    if (!response.ok) {
      throw new Error(`Vimeo API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Filter by tags if specified
    let filteredVideos = data.data;
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim().toLowerCase());
      filteredVideos = data.data.filter((video: any) => {
        if (!video.tags || !Array.isArray(video.tags)) return false;
        const videoTags = video.tags.map((t: any) => (t.name || t.tag || '').toLowerCase());
        return tagList.some(tag => videoTags.includes(tag));
      });
    }

    // Transform Vimeo response to our format
    const videos = filteredVideos.map((video: any) => ({
      id: video.uri.split('/').pop(),
      title: video.name,
      description: video.description,
      duration: video.duration,
      thumbnail: video.pictures?.sizes?.[2]?.link || '',
      link: video.link,
      embed: video.embed?.html || '',
      createdAt: video.created_time,
      modifiedAt: video.modified_time,
      privacy: video.privacy?.view,
      stats: {
        plays: video.stats?.plays || 0,
        likes: video.stats?.likes || 0,
        comments: video.stats?.comments || 0
      },
      tags: video.tags?.map((tag: any) => tag.name) || []
    }));

    return NextResponse.json({
      success: true,
      videos,
      pagination: {
        total: data.total,
        page: data.page,
        per_page: data.per_page,
        total_pages: Math.ceil(data.total / data.per_page)
      }
    });

  } catch (error: any) {
    console.error('Video search error:', error);
    return NextResponse.json(
      { error: 'Failed to search videos', details: error.message },
      { status: 500 }
    );
  }
}

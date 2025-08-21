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

    if (!VIMEO_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: 'Vimeo API not configured' },
        { status: 500 }
      );
    }

    // Fetch all videos to collect unique tags
    // We'll fetch multiple pages to get a comprehensive tag list
    const allTags = new Map<string, number>(); // tag -> count
    let page = 1;
    let hasMore = true;
    const perPage = 100; // Max allowed by Vimeo

    while (hasMore && page <= 10) { // Limit to 10 pages (1000 videos) for performance
      const vimeoUrl = `https://api.vimeo.com/me/videos?page=${page}&per_page=${perPage}&fields=tags`;
      
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
      
      // Process tags from videos
      data.data.forEach((video: any) => {
        if (video.tags && Array.isArray(video.tags)) {
          video.tags.forEach((tag: any) => {
            const tagName = tag.name || tag.tag;
            if (tagName) {
              allTags.set(tagName, (allTags.get(tagName) || 0) + 1);
            }
          });
        }
      });

      // Check if there are more pages
      hasMore = data.paging?.next !== null;
      page++;
    }

    // Convert to array and sort by count (most used first)
    const sortedTags = Array.from(allTags.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      tags: sortedTags,
      totalTags: sortedTags.length
    });

  } catch (error: any) {
    console.error('Tags fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tags', details: error.message },
      { status: 500 }
    );
  }
}

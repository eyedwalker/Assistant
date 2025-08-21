import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const VIMEO_ACCESS_TOKEN = process.env.VIMEO_ACCESS_TOKEN;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const videoId = params.id;

    if (!VIMEO_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: 'Vimeo API not configured' },
        { status: 500 }
      );
    }

    // Get video details from Vimeo
    const response = await fetch(`https://api.vimeo.com/videos/${videoId}`, {
      headers: {
        'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Video not found' }, { status: 404 });
      }
      throw new Error(`Vimeo API error: ${response.status}`);
    }

    const video = await response.json();

    // Get text tracks (captions/transcripts) if available
    let textTracks = [];
    if (video.metadata?.connections?.texttracks) {
      const textTracksResponse = await fetch(
        `https://api.vimeo.com${video.metadata.connections.texttracks.uri}`,
        {
          headers: {
            'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
            'Accept': 'application/vnd.vimeo.*+json;version=3.4'
          }
        }
      );

      if (textTracksResponse.ok) {
        const textTracksData = await textTracksResponse.json();
        textTracks = textTracksData.data || [];
      }
    }

    // Transform response
    const videoData = {
      id: video.uri.split('/').pop(),
      title: video.name,
      description: video.description,
      duration: video.duration,
      width: video.width,
      height: video.height,
      thumbnail: video.pictures?.sizes?.[3]?.link || video.pictures?.sizes?.[2]?.link || '',
      link: video.link,
      embed: video.embed?.html || '',
      createdAt: video.created_time,
      modifiedAt: video.modified_time,
      privacy: video.privacy?.view,
      download: video.download || [],
      stats: {
        plays: video.stats?.plays || 0,
        likes: video.stats?.likes || 0,
        comments: video.stats?.comments || 0
      },
      tags: video.tags?.map((tag: any) => tag.name) || [],
      textTracks: textTracks.map((track: any) => ({
        uri: track.uri,
        active: track.active,
        type: track.type,
        language: track.language,
        link: track.link,
        name: track.name
      }))
    };

    return NextResponse.json({
      success: true,
      video: videoData
    });

  } catch (error: any) {
    console.error('Video fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video', details: error.message },
      { status: 500 }
    );
  }
}

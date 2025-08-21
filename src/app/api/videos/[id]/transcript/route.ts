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

    // Get video text tracks (captions/transcripts)
    const textTracksResponse = await fetch(
      `https://api.vimeo.com/videos/${videoId}/texttracks`,
      {
        headers: {
          'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
          'Accept': 'application/vnd.vimeo.*+json;version=3.4'
        }
      }
    );

    if (!textTracksResponse.ok) {
      if (textTracksResponse.status === 404) {
        return NextResponse.json({ error: 'Video not found' }, { status: 404 });
      }
      throw new Error(`Vimeo API error: ${textTracksResponse.status}`);
    }

    const textTracksData = await textTracksResponse.json();
    const textTracks = textTracksData.data || [];

    // Find the first active text track or the first available one
    const activeTrack = textTracks.find((track: any) => track.active) || textTracks[0];

    if (!activeTrack) {
      return NextResponse.json({
        success: true,
        transcript: null,
        message: 'No transcript available for this video'
      });
    }

    // Fetch the actual transcript content
    const transcriptResponse = await fetch(activeTrack.link);
    
    if (!transcriptResponse.ok) {
      throw new Error('Failed to fetch transcript content');
    }

    const transcriptContent = await transcriptResponse.text();

    // Parse VTT format if needed
    let parsedTranscript = '';
    if (transcriptContent.includes('WEBVTT')) {
      // Remove VTT headers and timestamps
      const lines = transcriptContent.split('\n');
      let isText = false;
      
      for (const line of lines) {
        if (line.trim() === '') {
          isText = false;
        } else if (line.includes('-->')) {
          isText = true;
        } else if (isText && !line.startsWith('WEBVTT') && !line.match(/^\d+$/)) {
          parsedTranscript += line + ' ';
        }
      }
    } else {
      parsedTranscript = transcriptContent;
    }

    return NextResponse.json({
      success: true,
      transcript: {
        text: parsedTranscript.trim(),
        language: activeTrack.language,
        type: activeTrack.type,
        format: 'vtt',
        raw: transcriptContent
      },
      availableTracks: textTracks.map((track: any) => ({
        language: track.language,
        type: track.type,
        name: track.name,
        active: track.active
      }))
    });

  } catch (error: any) {
    console.error('Transcript fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transcript', details: error.message },
      { status: 500 }
    );
  }
}

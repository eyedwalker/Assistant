/**
 * API Route: Test Single Video Download (Lambda-style)
 * 
 * POST /api/videos/test-single-download
 * Tests downloading a single Vimeo video to S3 (similar to your Lambda function)
 */

import { NextRequest, NextResponse } from 'next/server';
import { VimeoAccessor } from '@/lib/accessors/VimeoAccessor';
import { S3Accessor } from '@/lib/accessors/S3Accessor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      vimeo_video_id,
      vimeo_access_token,
      s3_bucket,
      s3_region = 'us-west-2',
      quality = 'highest'
    } = body;

    // Validate required parameters
    if (!vimeo_video_id || !vimeo_access_token || !s3_bucket) {
      return NextResponse.json({
        error: 'Missing required parameters: vimeo_video_id, vimeo_access_token, s3_bucket'
      }, { status: 400 });
    }

    console.log(`🎬 Testing single video download: ${vimeo_video_id}`);

    // Initialize accessors
    const vimeoAccessor = new VimeoAccessor(vimeo_access_token);
    const s3Accessor = new S3Accessor(s3_bucket, s3_region);

    // Get video details and download links
    console.log(`📡 Fetching video details from Vimeo...`);
    const video = await vimeoAccessor.getVideo(vimeo_video_id);
    const downloadLinks = await vimeoAccessor.getVideoDownloadLinks(vimeo_video_id);

    if (!downloadLinks || downloadLinks.length === 0) {
      return NextResponse.json({
        error: 'No download links available for this video'
      }, { status: 400 });
    }

    // Select the best quality download link
    const videoLinks = downloadLinks.filter(link => link.type === 'video/mp4');
    let bestQuality;

    switch (quality) {
      case 'highest':
        bestQuality = videoLinks.reduce((best, current) => 
          (current.width || 0) > (best.width || 0) ? current : best
        );
        break;
      case 'lowest':
        bestQuality = videoLinks.reduce((best, current) => 
          (current.width || Infinity) < (best.width || Infinity) ? current : best
        );
        break;
      default:
        bestQuality = videoLinks[0];
    }

    if (!bestQuality) {
      return NextResponse.json({
        error: 'No suitable video quality found'
      }, { status: 400 });
    }

    console.log(`🔗 Selected quality: ${bestQuality.quality} (${(bestQuality.size / 1024 / 1024).toFixed(1)} MB)`);

    // Download video from Vimeo
    console.log(`📥 Downloading video content...`);
    const videoResponse = await fetch(bestQuality.link, {
      headers: {
        'Authorization': `Bearer ${vimeo_access_token}`
      }
    });

    if (!videoResponse.ok) {
      return NextResponse.json({
        error: `Failed to download video: ${videoResponse.status} ${videoResponse.statusText}`
      }, { status: 500 });
    }

    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

    // Upload to S3
    const s3Key = `vimeo-videos/${vimeo_video_id}.mp4`;
    console.log(`☁️  Uploading to S3: ${s3Key}`);
    
    const uploadResult = await s3Accessor.uploadFile(s3Key, videoBuffer, 'video/mp4');

    if (!uploadResult.success) {
      return NextResponse.json({
        error: `S3 upload failed: ${uploadResult.error}`
      }, { status: 500 });
    }

    console.log(`✅ Successfully uploaded video to S3`);

    // Return success response (Lambda-style format)
    return NextResponse.json({
      statusCode: 200,
      body: {
        s3_location: `s3://${s3_bucket}/${s3Key}`,
        video_id: vimeo_video_id,
        s3_url: uploadResult.url,
        video_details: {
          name: video.name,
          duration: video.duration,
          size_bytes: bestQuality.size,
          quality: bestQuality.quality,
          width: bestQuality.width,
          height: bestQuality.height
        }
      }
    });

  } catch (error) {
    console.error('Single video download error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Test Single Video Download API',
    description: 'Downloads a single Vimeo video to S3 (Lambda function style)',
    endpoint: '/api/videos/test-single-download',
    method: 'POST',
    parameters: {
      required: [
        'vimeo_video_id - The Vimeo video ID',
        'vimeo_access_token - Your Vimeo API access token',
        's3_bucket - Target S3 bucket name'
      ],
      optional: [
        's3_region - AWS region (default: us-west-2)',
        'quality - highest|lowest (default: highest)'
      ]
    },
    example: {
      vimeo_video_id: '123456789',
      vimeo_access_token: 'your_vimeo_access_token',
      s3_bucket: 'your-s3-bucket',
      s3_region: 'us-west-2',
      quality: 'highest'
    }
  });
}

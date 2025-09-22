/**
 * API Route: Reset Video Processing Status
 * 
 * POST /api/videos/reset-processing
 * Clears video processing status to allow reprocessing with enhanced system
 */

import { NextRequest, NextResponse } from 'next/server';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      resetMode = 'upgrade-to-v3',  // 'all', 'upgrade-to-v3', 'missing-s3'
      dryRun = false  // Set to true to see what would be reset without doing it
    } = body;

    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI!,
      process.env.MONGODB_DB_NAME!
    );
    await mongoAccessor.connect();

    let resetQuery: any = { contentType: 'video' };

    // Determine what to reset based on mode
    switch (resetMode) {
      case 'all':
        // Reset all video processing data
        resetQuery = { contentType: 'video' };
        break;

      case 'upgrade-to-v3':
        // Reset videos that don't have v3.0 analysis or S3 storage
        resetQuery = {
          contentType: 'video',
          $or: [
            { analysisVersion: { $ne: '3.0' } },
            { s3Key: { $exists: false } },
            { optimizedForAI: { $ne: true } }
          ]
        };
        break;

      case 'missing-s3':
        // Reset only videos missing S3 storage
        resetQuery = {
          contentType: 'video',
          s3Key: { $exists: false }
        };
        break;

      default:
        throw new Error(`Invalid resetMode: ${resetMode}`);
    }

    // Find videos that match reset criteria
    const videosToReset = await mongoAccessor.find('documents', resetQuery);
    
    console.log(`📊 Found ${videosToReset.length} videos matching reset criteria (${resetMode})`);

    if (dryRun) {
      // Just show what would be reset without doing it
      const sampleVideos = videosToReset.slice(0, 10).map((v: any) => ({
        vimeoId: v.vimeoId,
        title: v.title,
        analysisVersion: v.analysisVersion,
        hasS3Key: !!v.s3Key,
        optimizedForAI: v.optimizedForAI
      }));

      await mongoAccessor.disconnect();

      return NextResponse.json({
        success: true,
        dryRun: true,
        message: `Would reset ${videosToReset.length} videos`,
        resetMode,
        sample: sampleVideos,
        totalCount: videosToReset.length,
        note: 'Set dryRun: false to actually perform the reset'
      });
    }

    // Perform the actual reset
    let resetCount = 0;
    const batchSize = 100;

    for (let i = 0; i < videosToReset.length; i += batchSize) {
      const batch = videosToReset.slice(i, i + batchSize);
      
      for (const video of batch) {
        // Reset processing markers to trigger reprocessing
        const resetData: any = {
          optimizedForAI: false,
          analysisVersion: '1.0',  // Downgrade to force reprocessing
          processingStatus: 'pending',
          reprocessedAt: new Date(),
          needsUpgrade: true,
          upgradeReason: `Reset for ${resetMode} - enhanced processing v3.0`
        };

        // Remove S3 references if resetting S3 storage
        if (resetMode === 'all' || resetMode === 'missing-s3') {
          resetData.s3Key = undefined;
          resetData.s3Url = undefined;
        }

        await mongoAccessor.update('documents', video._id.toString(), resetData);
        resetCount++;
      }

      console.log(`🔄 Reset batch ${Math.floor(i / batchSize) + 1}: ${batch.length} videos`);
    }

    await mongoAccessor.disconnect();

    console.log(`✅ Successfully reset ${resetCount} videos for reprocessing`);

    return NextResponse.json({
      success: true,
      message: `Successfully reset ${resetCount} videos for enhanced processing`,
      resetMode,
      videosReset: resetCount,
      nextSteps: [
        'Videos are now marked for reprocessing',
        'Run vimeo-bulk-process to reprocess with enhanced analysis',
        'New processing will include S3 storage and v3.0 analysis'
      ]
    });

  } catch (error) {
    console.error('Reset processing error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Reset Video Processing Status',
    description: 'Clears video processing status to allow reprocessing with enhanced system',
    endpoint: '/api/videos/reset-processing',
    method: 'POST',
    parameters: {
      resetMode: {
        description: 'What type of reset to perform',
        options: [
          'upgrade-to-v3 (default) - Reset videos that need v3.0 analysis or S3 storage',
          'missing-s3 - Reset only videos missing S3 storage', 
          'all - Reset all video processing data'
        ]
      },
      dryRun: {
        description: 'Set to true to preview what would be reset without doing it',
        default: false
      }
    },
    examples: [
      {
        resetMode: 'upgrade-to-v3',
        dryRun: true
      },
      {
        resetMode: 'missing-s3', 
        dryRun: false
      }
    ]
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { VideoProcessor } from '@/lib/services/VideoProcessor';
import { RAGManager } from '@/lib/managers/RAGManager';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('video') as File;
    const title = formData.get('title') as string || 'Untitled Video';
    const category = formData.get('category') as string || 'training';
    const accessLevel = formData.get('accessLevel') as string || 'PUBLIC';
    const tenantId = formData.get('tenantId') as string || 'demo-tenant';

    if (!file) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['video/mp4', 'video/webm', 'video/mov', 'video/avi'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Supported: MP4, WebM, MOV, AVI' 
      }, { status: 400 });
    }

    // Create upload directory
    const uploadDir = path.join(process.cwd(), 'temp', 'video-processing');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Save file temporarily
    const timestamp = Date.now();
    const fileExtension = path.extname(file.name);
    const filename = `video_${timestamp}${fileExtension}`;
    const filepath = path.join(uploadDir, filename);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    console.log(`📹 Video uploaded: ${filename} (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);

    // Initialize video processor
    const videoProcessor = new VideoProcessor();
    const ragManager = new RAGManager();

    // Process video (extract audio, transcribe, analyze)
    console.log('🔄 Starting video processing...');
    const processingResult = await videoProcessor.processVideo({
      filepath,
      filename,
      title,
      category,
      accessLevel,
      tenantId
    });

    // Add processed content to RAG system
    console.log('📚 Adding content to RAG system...');
    await ragManager.addDocument(processingResult.transcript, {
      title,
      source: `video:${filename}`,
      contentType: 'video',
      accessLevel,
      tenantId,
      duration: processingResult.duration,
      keyTopics: processingResult.keyTopics,
      videoFile: filename,
      timestamps: processingResult.timestamps
    });

    // Clean up temporary file
    await videoProcessor.cleanup(filepath);

    return NextResponse.json({
      success: true,
      message: 'Video processed and added to AI knowledge base',
      videoId: timestamp.toString(),
      processing: {
        filename,
        duration: processingResult.duration,
        transcriptLength: processingResult.transcript.length,
        keyTopics: processingResult.keyTopics,
        timestampCount: processingResult.timestamps?.length || 0
      },
      ragIntegration: {
        vectorStoreType: ragManager.getStoreType(),
        contentAdded: true
      }
    });

  } catch (error: any) {
    console.error('❌ Video upload/processing error:', error);
    return NextResponse.json({
      error: 'Failed to process video',
      details: error.message
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/upload-video',
    method: 'POST',
    description: 'Upload and process videos for AI training via RAG',
    formData: {
      video: 'Video file (MP4, WebM, MOV, AVI)',
      title: 'Video title (optional)',
      category: 'Category: training, documentation, reference (optional)',
      accessLevel: 'Access level: PUBLIC, ACCOUNT, COMPANY, OFFICE (optional)',
      tenantId: 'Tenant ID (optional, defaults to demo-tenant)'
    },
    processing: [
      'Extract audio from video',
      'Transcribe speech to text',
      'Extract key topics and timestamps',
      'Add to RAG knowledge base',
      'Enable AI to reference video content'
    ]
  });
}

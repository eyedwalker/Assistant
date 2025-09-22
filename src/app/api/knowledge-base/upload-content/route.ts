/**
 * API endpoint to upload content to production Knowledge Base
 * Handles bulk upload of eyecare training materials with security
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { ProductionKnowledgeBaseAccessor } from '@/lib/accessors/ProductionKnowledgeBaseAccessor';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (!session && !isDevelopment) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const kbAccessor = new ProductionKnowledgeBaseAccessor();
    
    // Upload all eyecare training content
    console.log('🚀 Starting bulk upload to production Knowledge Base...');
    const result = await kbAccessor.uploadEyecareContent();

    if (result.success) {
      // Trigger knowledge base status check
      const status = await kbAccessor.getKnowledgeBaseStatus();
      
      return NextResponse.json({
        success: true,
        message: `Successfully uploaded ${result.uploaded} content files to Knowledge Base`,
        uploaded: result.uploaded,
        errors: result.errors,
        knowledgeBaseStatus: status,
        knowledgeBaseId: 'L3AVNMAT2F',
        region: 'us-west-2'
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Failed to upload content to Knowledge Base',
        uploaded: result.uploaded,
        errors: result.errors
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Knowledge Base upload failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error during Knowledge Base upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (!session && !isDevelopment) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const kbAccessor = new ProductionKnowledgeBaseAccessor();
    const status = await kbAccessor.getKnowledgeBaseStatus();

    return NextResponse.json({
      success: true,
      knowledgeBase: {
        id: 'L3AVNMAT2F',
        name: 'knowledge-base-encompass',
        region: 'us-west-2',
        status: status.healthy ? 'ACTIVE' : 'ERROR',
        contentCount: status.contentCount,
        lastSync: status.lastSync
      },
      configuration: {
        s3Bucket: 'encompass-knowledgebase',
        dataSourceId: 'Z8C0GPKNPO',
        embeddingsModel: 'amazon.titan-embed-text-v1',
        chatModel: 'claude-3-5-sonnet'
      }
    });

  } catch (error) {
    console.error('❌ Knowledge Base status check failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get Knowledge Base status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

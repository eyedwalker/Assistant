/**
 * Test URL Processing Endpoint
 * Simple test to verify URL processing pipeline
 */

import { NextRequest, NextResponse } from 'next/server';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing URL processing pipeline...');
    
    // Initialize MongoDB accessor
    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI || 'mongodb://localhost:27017',
      process.env.MONGODB_DB_NAME || 'ai-assistant-platform'
    );
    
    await mongoAccessor.connect();
    console.log('✅ MongoDB connected');
    
    // Test 1: Check if we can write to processing_jobs collection
    const testJob = {
      jobId: `test_${Date.now()}`,
      status: 'completed',
      progress: 100,
      userId: 'demo-user',
      tenantId: 'demo-tenant',
      type: 'url-processing',
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: new Date()
    };
    
    console.log('🔧 Creating test job:', testJob);
    const jobId = await mongoAccessor.create('processing_jobs', testJob);
    console.log('✅ Test job created with ID:', jobId);
    
    // Test 2: Verify we can read it back
    const retrievedJobs = await mongoAccessor.find('processing_jobs', {
      userId: 'demo-user'
    });
    console.log('🔍 Retrieved jobs:', retrievedJobs.length);
    
    // Test 3: Check all collections
    const collections = ['processing_jobs', 'contents', 'processing_logs', 'documents'];
    const collectionStats = {};
    
    for (const collection of collections) {
      try {
        const count = await mongoAccessor.count(collection, {});
        collectionStats[collection] = count;
        console.log(`📊 Collection ${collection}: ${count} documents`);
      } catch (error) {
        collectionStats[collection] = `Error: ${error.message}`;
        console.error(`❌ Error checking ${collection}:`, error);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'URL processing pipeline test completed',
      results: {
        mongoConnected: true,
        testJobCreated: jobId,
        retrievedJobsCount: retrievedJobs.length,
        collectionStats,
        testJob: testJob
      }
    });
    
  } catch (error) {
    console.error('❌ URL processing test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;
    
    if (!url) {
      return NextResponse.json({
        success: false,
        error: 'URL is required'
      }, { status: 400 });
    }
    
    console.log('🧪 Testing URL processing for:', url);
    
    // Make a request to our own URL processing endpoint
    const response = await fetch(`${request.nextUrl.origin}/api/documents/process-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        userId: 'demo-user',
        tenantId: 'demo-tenant'
      })
    });
    
    const result = await response.json();
    console.log('📋 URL processing response:', result);
    
    return NextResponse.json({
      success: true,
      message: 'URL processing test completed',
      urlProcessingResponse: result,
      statusCode: response.status
    });
    
  } catch (error) {
    console.error('❌ URL processing test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

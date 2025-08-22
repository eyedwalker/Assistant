import { NextRequest, NextResponse } from 'next/server';
import { OpenSearchAccessor } from '@/lib/accessors/OpenSearchAccessor';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Initializing OpenSearch for RAG...');

    if (!process.env.OPENSEARCH_ENDPOINT) {
      return NextResponse.json({ 
        error: 'OpenSearch not configured',
        message: 'OPENSEARCH_ENDPOINT environment variable is required',
        setup: 'Run ./wait-for-opensearch.sh to configure when domain is ready'
      }, { status: 400 });
    }

    // Initialize OpenSearch accessor
    const openSearchAccessor = new OpenSearchAccessor();
    
    // Create index with vector mappings
    await openSearchAccessor.initializeIndex();
    
    // Test connection
    const indexName = process.env.OPENSEARCH_INDEX_NAME || 'ai-assistant-rag';
    console.log(`✅ OpenSearch index ${indexName} initialized successfully`);

    return NextResponse.json({
      success: true,
      message: 'OpenSearch initialized successfully',
      endpoint: process.env.OPENSEARCH_ENDPOINT,
      indexName,
      vectorDimension: 384,
      ready: true
    });

  } catch (error: any) {
    console.error('❌ OpenSearch initialization failed:', error);
    
    let errorType = 'unknown';
    let troubleshooting = [];
    
    if (error.message?.includes('Connection')) {
      errorType = 'connection';
      troubleshooting = [
        'Check if OpenSearch domain is active and accessible',
        'Verify OPENSEARCH_ENDPOINT is correct',
        'Ensure AWS credentials have OpenSearch permissions'
      ];
    } else if (error.message?.includes('Authentication')) {
      errorType = 'authentication';
      troubleshooting = [
        'Verify AWS credentials are configured',
        'Check IAM permissions for OpenSearch access',
        'Ensure correct AWS region is set'
      ];
    }

    return NextResponse.json({
      error: 'Failed to initialize OpenSearch',
      type: errorType,
      details: error.message,
      troubleshooting,
      endpoint: process.env.OPENSEARCH_ENDPOINT
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/opensearch/init',
    method: 'POST',
    description: 'Initialize OpenSearch index for RAG vector storage',
    prerequisites: [
      'OPENSEARCH_ENDPOINT environment variable',
      'AWS credentials with OpenSearch access',
      'Active OpenSearch domain'
    ],
    creates: [
      'Vector index with kNN mappings',
      'Optimized settings for semantic search',
      '384-dimension vector field for embeddings'
    ]
  });
}

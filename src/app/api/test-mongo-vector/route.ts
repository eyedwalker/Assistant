/**
 * Test MongoDB Atlas Vector Search Setup
 * This endpoint helps validate that MongoDB Atlas Vector Search is properly configured
 */

import { NextRequest, NextResponse } from 'next/server';
import { MongoVectorAccessor } from '@/lib/accessors/MongoVectorAccessor';
import { EmbeddingService } from '@/lib/services/embedding-service';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing MongoDB Atlas Vector Search setup...');

    const mongoVector = new MongoVectorAccessor();
    const embeddingService = new EmbeddingService();

    // Step 1: Test MongoDB connection
    console.log('1️⃣ Testing MongoDB connection...');
    const isHealthy = await mongoVector.healthCheck();
    if (!isHealthy) {
      return NextResponse.json({
        success: false,
        error: 'MongoDB connection failed',
        step: 'connection'
      }, { status: 500 });
    }
    console.log('✅ MongoDB connection successful');

    // Step 2: Test embedding generation
    console.log('2️⃣ Testing Claude-compatible embedding generation...');
    const testText = "This is a test document about eyecare and vision health.";
    const embedding = await embeddingService.generateEmbedding(testText);
    console.log(`✅ Generated embedding with ${embedding.embedding.length} dimensions`);

    // Step 3: Initialize vector search index
    console.log('3️⃣ Initializing MongoDB Atlas Vector Search index...');
    try {
      await mongoVector.initializeIndex();
      console.log('✅ Vector search index initialized');
    } catch (indexError) {
      console.error('❌ Vector search index initialization failed:', indexError);
      return NextResponse.json({
        success: false,
        error: 'Vector search index initialization failed',
        details: indexError instanceof Error ? indexError.message : String(indexError),
        step: 'index_initialization',
        instructions: {
          message: 'You need to create a Vector Search index in MongoDB Atlas',
          steps: [
            '1. Go to your MongoDB Atlas cluster',
            '2. Click on "Search" tab',
            '3. Click "Create Search Index"',
            '4. Choose "Vector Search"',
            '5. Use these settings:',
            '   - Index Name: vector_index',
            '   - Database: ai-assistant (or your DB name)',
            '   - Collection: vectors',
            '   - Vector Field: vector',
            '   - Dimensions: 384',
            '   - Similarity: cosine'
          ]
        }
      }, { status: 500 });
    }

    // Step 4: Test vector storage
    console.log('4️⃣ Testing vector document storage...');
    const testVectorDoc = {
      id: `test_${Date.now()}`,
      vector: embedding.embedding,
      metadata: {
        userId: 'test-user',
        tenantId: 'test-tenant',
        title: 'Test Document',
        source: 'test',
        accessLevel: 'PUBLIC',
        contentType: 'text',
        createdAt: new Date().toISOString(),
        textChunk: testText,
        chunkIndex: 0,
        totalChunks: 1,
        documentId: 'test-doc'
      }
    };

    await mongoVector.storeVectors([testVectorDoc]);
    console.log('✅ Test vector document stored successfully');

    // Step 5: Test vector search
    console.log('5️⃣ Testing vector similarity search...');
    const searchResults = await mongoVector.searchVectors(
      embedding.embedding,
      {
        topK: 3,
        filter: {
          userId: 'test-user',
          tenantId: 'test-tenant',
          accessLevel: ['PUBLIC']
        }
      }
    );

    console.log(`✅ Vector search returned ${searchResults.length} results`);

    // Step 6: Get index statistics
    console.log('6️⃣ Getting index statistics...');
    const stats = await mongoVector.getIndexStats();

    // Clean up test data
    console.log('🧹 Cleaning up test data...');
    await mongoVector.deleteVectors({ userId: 'test-user' });

    return NextResponse.json({
      success: true,
      message: 'MongoDB Atlas Vector Search is working perfectly!',
      results: {
        connection: 'healthy',
        embedding: {
          dimensions: embedding.embedding.length,
          tokenCount: embedding.tokenCount
        },
        vectorSearch: {
          resultsFound: searchResults.length,
          sampleResult: searchResults[0] || null
        },
        indexStats: stats
      },
      nextSteps: [
        'Your MongoDB Atlas Vector Search is ready!',
        'You can now process documents and they will be stored with embeddings',
        'The AI chat will use vector search to find relevant content',
        'Test with real documents through the main application'
      ]
    });

  } catch (error) {
    console.error('❌ MongoDB Atlas Vector Search test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'MongoDB Atlas Vector Search test failed',
      details: error instanceof Error ? error.message : String(error),
      troubleshooting: {
        commonIssues: [
          'MongoDB Atlas Vector Search not enabled on your cluster',
          'Vector Search index not created or misconfigured',
          'Incorrect environment variables (MONGODB_URI, MONGODB_DB_NAME)',
          'Network connectivity issues to MongoDB Atlas'
        ],
        checkList: [
          'Verify MONGODB_URI is correct in your .env file',
          'Ensure your MongoDB Atlas cluster supports Vector Search',
          'Create the vector search index as described above',
          'Check that your IP is whitelisted in MongoDB Atlas'
        ]
      }
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (action === 'cleanup') {
      console.log('🧹 Cleaning up all test data...');
      const mongoVector = new MongoVectorAccessor();
      await mongoVector.deleteVectors({ userId: 'test-user' });
      
      return NextResponse.json({
        success: true,
        message: 'Test data cleaned up successfully'
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Unknown action'
    }, { status: 400 });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Cleanup failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

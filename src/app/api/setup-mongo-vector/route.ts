/**
 * Setup MongoDB Collections for Vector Search
 * This endpoint creates the necessary collections and prepares for Vector Search
 */

import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Setting up MongoDB collections for Vector Search...');

    if (!process.env.MONGODB_URI) {
      return NextResponse.json({
        success: false,
        error: 'MONGODB_URI environment variable not set'
      }, { status: 500 });
    }

    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const dbName = process.env.MONGODB_DB_NAME || 'ai-assistant-platform';
    const db = client.db(dbName);

    // Create vectors collection if it doesn't exist
    console.log('📁 Creating vectors collection...');
    const collections = await db.listCollections().toArray();
    const vectorsExists = collections.some(col => col.name === 'vectors');

    if (!vectorsExists) {
      await db.createCollection('vectors');
      console.log('✅ Created vectors collection');
    } else {
      console.log('✅ Vectors collection already exists');
    }

    // Insert a sample document to ensure collection is ready
    const vectorsCollection = db.collection('vectors');
    const sampleDoc = {
      id: 'setup_test',
      vector: new Array(384).fill(0.1), // Sample 384-dimension vector
      metadata: {
        userId: 'setup-test',
        tenantId: 'setup-test',
        title: 'Setup Test Document',
        source: 'setup',
        accessLevel: 'PUBLIC',
        contentType: 'text',
        createdAt: new Date().toISOString(),
        textChunk: 'This is a setup test document for MongoDB Atlas Vector Search.',
        chunkIndex: 0,
        totalChunks: 1,
        documentId: 'setup-test'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await vectorsCollection.replaceOne(
      { id: 'setup_test' },
      sampleDoc,
      { upsert: true }
    );

    console.log('✅ Sample vector document inserted');

    // Get collection stats
    const stats = await vectorsCollection.stats();
    
    await client.close();

    return NextResponse.json({
      success: true,
      message: 'MongoDB collections set up successfully!',
      database: dbName,
      collection: 'vectors',
      stats: {
        documentCount: stats.count,
        size: stats.size
      },
      nextSteps: {
        title: 'Now create the Vector Search Index in MongoDB Atlas',
        instructions: [
          '1. Go to your MongoDB Atlas dashboard',
          '2. Navigate to your cluster',
          '3. Click on the "Search" tab',
          '4. Click "Create Search Index"',
          '5. Choose "Vector Search" (not "Search Index")',
          '6. Configure the index with these EXACT settings:',
          '',
          '📋 Vector Search Index Configuration:',
          `   • Database Name: ${dbName}`,
          '   • Collection Name: vectors',
          '   • Index Name: vector_index',
          '   • Vector Field Path: vector',
          '   • Vector Dimensions: 384',
          '   • Vector Similarity: cosine',
          '',
          '7. Add these filter fields for metadata filtering:',
          '   • metadata.userId (as filter)',
          '   • metadata.tenantId (as filter)', 
          '   • metadata.accessLevel (as filter)',
          '   • metadata.contentType (as filter)',
          '',
          '8. Click "Create Search Index"',
          '9. Wait for the index to build (this can take a few minutes)',
          '10. Test again with: GET /api/test-mongo-vector'
        ]
      }
    });

  } catch (error) {
    console.error('❌ MongoDB setup failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'MongoDB setup failed',
      details: error instanceof Error ? error.message : String(error),
      troubleshooting: [
        'Check your MONGODB_URI environment variable',
        'Ensure your MongoDB Atlas cluster is running',
        'Verify network access (IP whitelist) in MongoDB Atlas',
        'Check that your database user has write permissions'
      ]
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Use POST to set up MongoDB collections for Vector Search',
    endpoint: 'POST /api/setup-mongo-vector'
  });
}

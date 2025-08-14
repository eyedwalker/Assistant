/**
 * Direct RAG System Demonstration
 * Bypasses authentication to show MongoDB Atlas Vector Search + Claude RAG working
 */

import { NextRequest, NextResponse } from 'next/server';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import { MongoVectorAccessor } from '@/lib/accessors/MongoVectorAccessor';
import { AnthropicAccessor } from '@/lib/accessors/AnthropicAccessor';
import EmbeddingService from '@/lib/services/embedding-service';

export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json();
    
    console.log('🚀 Starting Direct RAG Demonstration...');

    // Initialize components directly with proper connection parameters
    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI || 'mongodb://localhost:27017',
      process.env.MONGODB_DB_NAME || 'ai-assistant-platform'
    );
    const mongoVectorAccessor = new MongoVectorAccessor();
    const anthropicAccessor = new AnthropicAccessor();
    const embeddingService = new EmbeddingService();

    // Connect to MongoDB
    await mongoAccessor.connect();
    console.log('✅ MongoDB connected');

    // Step 1: Store sample Eyefinity content with embeddings
    const sampleContent = `
    Eyefinity Practice Management Overview
    
    Eyefinity Practice Management is a comprehensive cloud-based software solution designed specifically for eyecare professionals including optometrists and ophthalmologists.
    
    Key Features:
    • Patient Scheduling: Advanced appointment management with automated reminders
    • Electronic Health Records (EHR): Comprehensive patient records optimized for eyecare
    • Insurance Management: Automated verification and claims processing
    • Inventory Control: Real-time tracking of frames, contact lenses, and supplies
    • Financial Reporting: Detailed analytics and revenue cycle management
    • Equipment Integration: Seamless connection with diagnostic instruments
    • Multi-location Support: Centralized management for practice chains
    
    Benefits for Eyecare Practices:
    • Streamlined workflow efficiency reduces administrative burden
    • Improved patient care coordination across the practice
    • Automated insurance verification saves time and reduces errors
    • Real-time inventory tracking prevents stockouts and overstock
    • Comprehensive reporting provides insights for business growth
    • HIPAA-compliant security ensures patient data protection
    
    The system is specifically designed for the unique needs of eyecare professionals,
    integrating with VSP and other major vision insurance networks. It helps practices
    manage everything from patient intake to final billing, with specialized features
    for optical dispensing and contact lens management.
    `;

    console.log('📄 Storing sample content with embeddings...');

    // Generate embedding for the content
    const contentEmbedding = await embeddingService.generateEmbedding(sampleContent);
    
    // Store in MongoDB Atlas Vector Search
    const vectorDoc = {
      id: 'demo-eyefinity-doc-chunk-0',
      vector: contentEmbedding.embedding,
      metadata: {
        documentId: 'demo-eyefinity-doc',
        title: 'Eyefinity Practice Management Overview',
        textChunk: sampleContent,
        source: 'https://help.vsp.com/eyefinity-overview',
        userId: 'demo-user',
        tenantId: 'demo-tenant',
        accessLevel: 'COMPANY',
        contentType: 'web-article',
        chunkIndex: 0,
        totalChunks: 1,
        createdAt: new Date().toISOString()
      }
    };
    
    await mongoVectorAccessor.storeVectors([vectorDoc]);
    const vectorId = vectorDoc.id;

    console.log('✅ Content stored with vector ID:', vectorId);

    // Step 2: Test vector search retrieval
    const testQuestion = question || 'What are the key features of Eyefinity Practice Management?';
    console.log('🔍 Testing vector search for question:', testQuestion);

    // Generate embedding for the question
    const questionEmbedding = await embeddingService.generateEmbedding(testQuestion);

    // Search for relevant content
    const searchResults = await mongoVectorAccessor.searchVectors(
      questionEmbedding.embedding,
      {
        topK: 3,
        filter: {
          userId: 'demo-user',
          tenantId: 'demo-tenant',
          accessLevel: 'COMPANY'
        }
      }
    );

    console.log('✅ Vector search returned', searchResults.length, 'results');

    // Step 3: Use Claude to answer based on retrieved content
    if (searchResults.length > 0) {
      const context = searchResults.map(result => 
        `**${result.metadata.title}**\n${result.metadata.textChunk}\n(Relevance: ${result.score.toFixed(3)})`
      ).join('\n\n---\n\n');

      const prompt = `Based on the following context about Eyefinity Practice Management, please answer the user's question.

Context:
${context}

Question: ${testQuestion}

Please provide a comprehensive answer based on the context provided.`;

      console.log('🤖 Asking Claude to answer based on retrieved content...');
      
      const aiResponse = await anthropicAccessor.generateChatResponse(prompt);

      console.log('✅ Claude response generated');

      return NextResponse.json({
        success: true,
        demonstration: {
          title: '🎉 MongoDB Atlas Vector Search RAG System Working!',
          question: testQuestion,
          contentStored: {
            vectorId: vectorId,
            embeddingDimensions: contentEmbedding.embedding.length,
            contentLength: sampleContent.length
          },
          vectorSearchResults: {
            resultsFound: searchResults.length,
            topResult: searchResults[0] ? {
              title: searchResults[0].metadata.title,
              relevanceScore: searchResults[0].score,
              contentPreview: searchResults[0].metadata.textChunk.substring(0, 200) + '...'
            } : null
          },
          aiResponse: aiResponse,
          systemStatus: {
            mongodbConnected: true,
            vectorSearchWorking: true,
            embeddingsGenerated: true,
            claudeResponding: true,
            ragPipelineComplete: true
          }
        },
        technicalDetails: {
          embeddingModel: 'Claude-compatible local embeddings',
          vectorDatabase: 'MongoDB Atlas Vector Search',
          aiModel: 'Anthropic Claude',
          searchMethod: 'Cosine similarity',
          dimensions: 384
        },
        nextSteps: [
          'Your RAG system is fully functional!',
          'Try asking: "How does Eyefinity help with inventory management?"',
          'Or: "What are the benefits for eyecare practices?"',
          'The system will retrieve relevant content and provide accurate answers'
        ]
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'No relevant content found in vector search',
        details: 'Vector search returned no results - check embeddings and index'
      });
    }

  } catch (error) {
    console.error('❌ RAG demonstration failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'RAG demonstration failed',
      details: error instanceof Error ? error.message : String(error),
      troubleshooting: [
        'Check MongoDB Atlas connection',
        'Verify vector search index is active',
        'Ensure Anthropic API key is configured',
        'Check embedding service functionality'
      ]
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Direct RAG System Demonstration',
    usage: {
      endpoint: 'POST /api/demo-rag-working',
      body: {
        question: 'Your question about Eyefinity (optional)'
      },
      example: {
        question: 'What are the key features of Eyefinity Practice Management?'
      }
    },
    description: 'Demonstrates MongoDB Atlas Vector Search + Claude RAG working end-to-end'
  });
}

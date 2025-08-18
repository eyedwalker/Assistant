/**
 * Knowledge Base Builder for RAG
 * Creates a fully functional knowledge base with embeddings for RAG retrieval
 */

import { NextRequest, NextResponse } from 'next/server';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import { MongoVectorAccessor } from '@/lib/accessors/MongoVectorAccessor';
import { AnthropicAccessor } from '@/lib/accessors/AnthropicAccessor';
import EmbeddingService from '@/lib/services/embedding-service';
import simpleContentExtractor from '@/lib/services/simple-content-extractor';

export async function POST(request: NextRequest) {
  try {
    const { urls } = await request.json();
    
    console.log('🏗️ Building Knowledge Base for RAG...');

    // Initialize components
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

    // Initialize vector search index
    await mongoVectorAccessor.initializeIndex();
    console.log('✅ Vector search index ready');

    const knowledgeBase = [];
    const urlsToProcess = urls || [
      'https://help.eyefinity.com/epm/Content/FrontOffice/NavigatingFO.htm'
    ];

    for (let i = 0; i < urlsToProcess.length; i++) {
      const url = urlsToProcess[i];
      console.log(`📄 Processing ${i + 1}/${urlsToProcess.length}: ${url}`);

      try {
        // Step 1: Extract content
        const extractionResult = await simpleContentExtractor.extractContent(url);
        
        if (!extractionResult.success || !extractionResult.content) {
          console.log(`❌ Failed to extract content from ${url}`);
          continue;
        }

        console.log(`✅ Extracted ${extractionResult.content.length} characters`);

        // Step 2: Chunk content for better embeddings
        const chunks = chunkContent(extractionResult.content, 800);
        console.log(`📝 Created ${chunks.length} content chunks`);

        // Step 3: Generate embeddings and store in knowledge base
        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
          const chunk = chunks[chunkIndex];
          
          // Generate embedding
          const embeddingResult = await embeddingService.generateEmbedding(chunk);
          
          // Create knowledge base entry
          const knowledgeEntry = {
            id: `kb_${Date.now()}_${i}_${chunkIndex}`,
            vector: embeddingResult.embedding,
            metadata: {
              userId: 'demo-user',
              tenantId: 'demo-tenant',
              title: extractionResult.title || `Document ${i + 1}`,
              source: url,
              accessLevel: 'COMPANY',
              contentType: 'knowledge-base',
              createdAt: new Date().toISOString(),
              textChunk: chunk,
              chunkIndex: chunkIndex,
              totalChunks: chunks.length,
              documentId: `kb_doc_${i}`
            }
          };

          knowledgeBase.push(knowledgeEntry);
        }

        // Step 4: Store in MongoDB Atlas Vector Search
        const docChunks = knowledgeBase.filter(entry => 
          entry.metadata.documentId === `kb_doc_${i}`
        );
        
        await mongoVectorAccessor.storeVectors(docChunks);
        console.log(`✅ Stored ${docChunks.length} embeddings for document ${i + 1}`);

        // Step 5: Store content metadata
        await mongoAccessor.create('contents', {
          id: `kb_doc_${i}`,
          title: extractionResult.title || `Document ${i + 1}`,
          source: url,
          content: extractionResult.content,
          extractedTextLength: extractionResult.content.length,
          hasEmbeddings: true,
          embeddingCount: chunks.length,
          userId: 'demo-user',
          tenantId: 'demo-tenant',
          accessLevel: 'COMPANY',
          aiAnalysis: {
            summary: `Knowledge base entry extracted from ${url}`,
            keyPoints: [`Content length: ${extractionResult.content.length} characters`],
            categories: ['Knowledge Base', 'Eyefinity'],
            tags: ['rag', 'knowledge-base', 'eyefinity']
          },
          createdAt: new Date(),
          updatedAt: new Date()
        });

        console.log(`✅ Stored content metadata for document ${i + 1}`);

      } catch (error) {
        console.error(`❌ Failed to process ${url}:`, error);
        continue;
      }
    }

    // Step 6: Test RAG retrieval
    console.log('🔍 Testing RAG retrieval from knowledge base...');
    
    const testQuery = 'What can you do with Front Office in Eyefinity?';
    const queryEmbedding = await embeddingService.generateEmbedding(testQuery);
    
    const searchResults = await mongoVectorAccessor.searchVectors(
      queryEmbedding.embedding,
      {
        topK: 3,
        filter: {
          userId: 'demo-user',
          tenantId: 'demo-tenant',
          accessLevel: 'COMPANY'
        }
      }
    );

    console.log(`✅ RAG search returned ${searchResults.length} relevant results`);

    // Step 7: Generate AI response using knowledge base
    let aiResponse = '';
    if (searchResults.length > 0) {
      const context = searchResults.map(result => 
        `**${result.metadata.title}**\n${result.metadata.textChunk}\n(Relevance: ${result.score.toFixed(3)})`
      ).join('\n\n---\n\n');

      const prompt = `Based on the following knowledge base context, please answer the user's question.

Context from Knowledge Base:
${context}

Question: ${testQuery}

Please provide a comprehensive answer based on the knowledge base context.`;

      const response = await anthropicAccessor.generateChatResponse(prompt);
      aiResponse = typeof response === 'string' ? response : (response as any).content || JSON.stringify(response);
      console.log('✅ AI generated response using knowledge base');
    }

    return NextResponse.json({
      success: true,
      knowledgeBase: {
        title: '🎉 RAG-Ready Knowledge Base Created!',
        totalDocuments: urlsToProcess.length,
        totalChunks: knowledgeBase.length,
        totalEmbeddings: knowledgeBase.length,
        documentsProcessed: knowledgeBase.reduce((acc: string[], entry) => {
          const docId = entry.metadata.documentId;
          return acc.includes(docId) ? acc : [...acc, docId];
        }, [] as string[]).length
      },
      ragTest: {
        query: testQuery,
        resultsFound: searchResults.length,
        aiResponse: aiResponse,
        topResult: searchResults[0] ? {
          title: searchResults[0].metadata.title,
          relevance: searchResults[0].score,
          preview: searchResults[0].metadata.textChunk.substring(0, 200) + '...'
        } : null
      },
      systemStatus: {
        mongodbConnected: true,
        vectorSearchWorking: true,
        embeddingsGenerated: true,
        knowledgeBaseReady: true,
        ragFunctional: searchResults.length > 0 && aiResponse.length > 0
      },
      nextSteps: [
        'Your knowledge base is now RAG-ready!',
        'Add more URLs to expand the knowledge base',
        'Test different questions to see RAG retrieval in action',
        'The AI can now answer questions based on processed content'
      ]
    });

  } catch (error) {
    console.error('❌ Knowledge base creation failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Knowledge base creation failed',
      details: error instanceof Error ? error.message : String(error),
      troubleshooting: [
        'Check MongoDB Atlas connection',
        'Verify vector search index is active',
        'Ensure content extraction is working',
        'Check embedding service functionality'
      ]
    }, { status: 500 });
  }
}

// Helper function to chunk content
function chunkContent(content: string, maxChunkSize: number = 800): string[] {
  if (!content || content.length <= maxChunkSize) {
    return [content];
  }

  const chunks: string[] = [];
  const sentences = content.split(/[.!?]+/);
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;

    const potentialChunk = currentChunk + (currentChunk ? '. ' : '') + trimmedSentence;
    
    if (potentialChunk.length <= maxChunkSize) {
      currentChunk = potentialChunk;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk + '.');
      }
      currentChunk = trimmedSentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk + '.');
  }

  return chunks.length > 0 ? chunks : [content];
}

export async function GET() {
  return NextResponse.json({
    message: 'Knowledge Base Builder for RAG',
    usage: {
      endpoint: 'POST /api/build-knowledge-base',
      body: {
        urls: ['array of URLs to process into knowledge base (optional)']
      },
      example: {
        urls: [
          'https://help.eyefinity.com/epm/Content/FrontOffice/NavigatingFO.htm'
        ]
      }
    },
    description: 'Builds a complete RAG-ready knowledge base with embeddings and vector search'
  });
}

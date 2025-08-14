/**
 * Pinecone Vector Database Accessor
 * Handles vector storage and retrieval for RAG functionality
 */

import { Pinecone } from '@pinecone-database/pinecone';

export interface VectorDocument {
  id: string;
  values: number[];
  metadata: {
    userId: string;
    tenantId: string;
    title: string;
    source: string;
    accessLevel: string;
    contentType: string;
    createdAt: string;
    textChunk: string;
    chunkIndex: number;
    totalChunks: number;
  };
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: VectorDocument['metadata'];
}

export interface VectorSearchOptions {
  topK?: number;
  filter?: Record<string, any>;
  includeMetadata?: boolean;
}

export class PineconeAccessor {
  private client: Pinecone;
  private indexName: string;

  constructor() {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY environment variable is required');
    }

    this.client = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    this.indexName = process.env.PINECONE_INDEX_NAME || 'ai-assistant-rag';
  }

  /**
   * Initialize Pinecone index if it doesn't exist
   */
  async initializeIndex(): Promise<void> {
    try {
      const indexList = await this.client.listIndexes();
      const indexExists = indexList.indexes?.some(index => index.name === this.indexName);

      if (!indexExists) {
        console.log(`🔧 Creating Pinecone index: ${this.indexName}`);
        await this.client.createIndex({
          name: this.indexName,
          dimension: 1536, // OpenAI text-embedding-ada-002 dimension
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        });

        // Wait for index to be ready
        console.log('⏳ Waiting for index to be ready...');
        await this.waitForIndexReady();
      }

      console.log(`✅ Pinecone index ${this.indexName} is ready`);
    } catch (error) {
      console.error('❌ Failed to initialize Pinecone index:', error);
      throw error;
    }
  }

  /**
   * Wait for index to be ready
   */
  private async waitForIndexReady(maxAttempts: number = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const index = this.client.index(this.indexName);
        const stats = await index.describeIndexStats();
        if (stats) {
          return;
        }
      } catch (error) {
        // Index not ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error('Index failed to become ready within timeout');
  }

  /**
   * Store vector documents in Pinecone
   */
  async storeVectors(documents: VectorDocument[]): Promise<void> {
    try {
      const index = this.client.index(this.indexName);
      
      // Batch upsert documents
      const batchSize = 100;
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        await index.upsert(batch);
      }

      console.log(`✅ Stored ${documents.length} vectors in Pinecone`);
    } catch (error) {
      console.error('❌ Failed to store vectors:', error);
      throw error;
    }
  }

  /**
   * Search for similar vectors
   */
  async searchVectors(
    queryVector: number[],
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    try {
      const index = this.client.index(this.indexName);
      
      const searchRequest = {
        vector: queryVector,
        topK: options.topK || 5,
        includeMetadata: options.includeMetadata !== false,
        filter: options.filter
      };

      const results = await index.query(searchRequest);
      
      return results.matches?.map(match => ({
        id: match.id,
        score: match.score || 0,
        metadata: match.metadata as VectorDocument['metadata']
      })) || [];

    } catch (error) {
      console.error('❌ Failed to search vectors:', error);
      throw error;
    }
  }

  /**
   * Delete vectors by filter
   */
  async deleteVectors(filter: Record<string, any>): Promise<void> {
    try {
      const index = this.client.index(this.indexName);
      await index.deleteMany(filter);
      console.log('✅ Deleted vectors with filter:', filter);
    } catch (error) {
      console.error('❌ Failed to delete vectors:', error);
      throw error;
    }
  }

  /**
   * Delete all vectors for a specific document
   */
  async deleteDocumentVectors(documentId: string): Promise<void> {
    await this.deleteVectors({ documentId });
  }

  /**
   * Delete all vectors for a specific user/tenant
   */
  async deleteUserVectors(userId: string, tenantId: string): Promise<void> {
    await this.deleteVectors({ userId, tenantId });
  }

  /**
   * Get index statistics
   */
  async getIndexStats(): Promise<any> {
    try {
      const index = this.client.index(this.indexName);
      return await index.describeIndexStats();
    } catch (error) {
      console.error('❌ Failed to get index stats:', error);
      throw error;
    }
  }
}

export default PineconeAccessor;

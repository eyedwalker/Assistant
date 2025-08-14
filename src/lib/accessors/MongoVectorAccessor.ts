/**
 * MongoDB Atlas Vector Search Accessor
 * Handles vector storage and retrieval using MongoDB's native vector search capabilities
 */

import { MongoClient, Db, Collection } from 'mongodb';

export interface VectorDocument {
  _id?: string;
  id: string;
  vector: number[];
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
    documentId: string;
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

export class MongoVectorAccessor {
  private client: MongoClient;
  private db: Db;
  private collection: Collection<VectorDocument>;
  private indexName: string;

  constructor() {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    this.client = new MongoClient(process.env.MONGODB_URI);
    this.db = this.client.db(process.env.MONGODB_DB_NAME || 'ai-assistant-platform');
    this.collection = this.db.collection('vectors');
    this.indexName = process.env.MONGODB_VECTOR_INDEX_NAME || 'vector_index';
  }

  /**
   * Connect to MongoDB - FIXED: Explicit connection required
   */
  async connect(): Promise<void> {
    try {
      console.log('🔧 Connecting to MongoDB for vector search...');
      await this.client.connect();
      console.log('✅ MongoDB Vector Search client connected');
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  /**
   * Initialize MongoDB Atlas Vector Search index
   */
  async initializeIndex(): Promise<void> {
    try {
      // Check if vector search index exists
      const indexes = await this.collection.listSearchIndexes().toArray();
      const vectorIndexExists = indexes.some(index => index.name === this.indexName);

      if (!vectorIndexExists) {
        console.log(`🔧 Creating MongoDB Atlas Vector Search index: ${this.indexName}`);
        
        // Create vector search index
        await this.collection.createSearchIndex({
          name: this.indexName,
          definition: {
            fields: [
              {
                type: 'vector',
                path: 'vector',
                numDimensions: 384, // Claude-compatible embedding dimension
                similarity: 'cosine'
              },
              {
                type: 'filter',
                path: 'metadata.userId'
              },
              {
                type: 'filter',
                path: 'metadata.tenantId'
              },
              {
                type: 'filter',
                path: 'metadata.accessLevel'
              },
              {
                type: 'filter',
                path: 'metadata.contentType'
              }
            ]
          }
        });

        console.log(`✅ MongoDB Atlas Vector Search index ${this.indexName} created successfully`);
        
        // Wait for index to be ready (Atlas Vector Search takes time to build)
        console.log('⏳ Waiting for vector search index to be ready...');
        await this.waitForIndexReady();
      } else {
        console.log(`✅ MongoDB Atlas Vector Search index ${this.indexName} already exists`);
      }
    } catch (error) {
      console.error('❌ Failed to initialize MongoDB Vector Search index:', error);
      throw error;
    }
  }

  /**
   * Wait for vector search index to be ready
   */
  private async waitForIndexReady(maxAttempts: number = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const indexes = await this.collection.listSearchIndexes().toArray();
        const vectorIndex = indexes.find((index: any) => index.name === this.indexName);
        
        if (vectorIndex && (vectorIndex as any).status === 'READY') {
          console.log('✅ Vector search index is ready');
          return;
        }
        
        console.log(`⏳ Index status: ${(vectorIndex as any)?.status || 'UNKNOWN'}, waiting...`);
      } catch (error) {
        console.log('⏳ Checking index status...');
      }
      
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
    }
    
    console.warn('⚠️ Vector search index may not be fully ready, but proceeding...');
  }

  /**
   * Store vector documents in MongoDB
   */
  async storeVectors(documents: VectorDocument[]): Promise<void> {
    try {
      // Prepare documents for insertion
      const docsToInsert = documents.map(doc => ({
        ...doc,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      // Use bulk write for efficiency
      const bulkOps = docsToInsert.map(doc => ({
        replaceOne: {
          filter: { id: doc.id },
          replacement: doc,
          upsert: true
        }
      }));

      const result = await this.collection.bulkWrite(bulkOps);
      console.log(`✅ Stored ${documents.length} vectors in MongoDB (${result.upsertedCount} new, ${result.modifiedCount} updated)`);
    } catch (error) {
      console.error('❌ Failed to store vectors:', error);
      throw error;
    }
  }

  /**
   * Search for similar vectors using MongoDB Atlas Vector Search
   */
  async searchVectors(
    queryVector: number[],
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    try {
      const pipeline: any[] = [
        {
          $vectorSearch: {
            index: this.indexName,
            path: 'vector',
            queryVector: queryVector,
            numCandidates: (options.topK || 5) * 10, // Search more candidates for better results
            limit: options.topK || 5
          }
        }
      ];

      // Add filters if provided
      if (options.filter && Object.keys(options.filter).length > 0) {
        const matchConditions: any = {};
        
        for (const [key, value] of Object.entries(options.filter)) {
          if (Array.isArray(value)) {
            matchConditions[`metadata.${key}`] = { $in: value };
          } else {
            matchConditions[`metadata.${key}`] = value;
          }
        }
        
        if (Object.keys(matchConditions).length > 0) {
          pipeline.push({ $match: matchConditions });
        }
      }

      // Add score and metadata projection
      pipeline.push({
        $project: {
          id: 1,
          metadata: 1,
          score: { $meta: 'vectorSearchScore' }
        }
      });

      const results = await this.collection.aggregate(pipeline).toArray();
      
      return results.map((result: any) => ({
        id: result.id,
        score: result.score || 0,
        metadata: result.metadata
      }));
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
      const deleteFilter: any = {};
      
      for (const [key, value] of Object.entries(filter)) {
        if (Array.isArray(value)) {
          deleteFilter[`metadata.${key}`] = { $in: value };
        } else {
          deleteFilter[`metadata.${key}`] = value;
        }
      }

      const result = await this.collection.deleteMany(deleteFilter);
      console.log(`✅ Deleted ${result.deletedCount} vectors with filter:`, filter);
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
   * Get collection statistics
   */
  async getIndexStats(): Promise<any> {
    try {
      const stats = await this.collection.stats();
      const indexes = await this.collection.listSearchIndexes().toArray();
      
      return {
        collectionStats: stats,
        vectorIndexes: indexes.filter(index => index.name === this.indexName)
      };
    } catch (error) {
      console.error('❌ Failed to get index stats:', error);
      throw error;
    }
  }

  /**
   * Health check for MongoDB connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.db.admin().ping();
      return true;
    } catch (error) {
      console.error('❌ MongoDB health check failed:', error);
      return false;
    }
  }

  /**
   * Close MongoDB connection
   */
  async close(): Promise<void> {
    await this.client.close();
  }
}

export default MongoVectorAccessor;

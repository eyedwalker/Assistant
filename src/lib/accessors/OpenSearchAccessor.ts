/**
 * AWS OpenSearch Vector Database Accessor
 * Handles vector storage and retrieval for RAG functionality using AWS OpenSearch Service
 */

import { Client } from '@opensearch-project/opensearch';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';

export interface VectorDocument {
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

export class OpenSearchAccessor {
  private client: Client;
  private indexName: string;

  constructor() {
    if (!process.env.OPENSEARCH_ENDPOINT) {
      throw new Error('OPENSEARCH_ENDPOINT environment variable is required');
    }

    this.indexName = process.env.OPENSEARCH_INDEX_NAME || 'ai-assistant-rag';

    // Initialize OpenSearch client with AWS authentication
    this.client = new Client({
      ...AwsSigv4Signer({
        region: process.env.AWS_REGION || 'us-east-1',
        service: 'es',
        getCredentials: () => {
          const credentialsProvider = defaultProvider();
          return credentialsProvider();
        },
      }),
      node: process.env.OPENSEARCH_ENDPOINT,
    });
  }

  /**
   * Initialize OpenSearch index with vector mapping if it doesn't exist
   */
  async initializeIndex(): Promise<void> {
    try {
      // Check if index exists
      const indexExists = await this.client.indices.exists({
        index: this.indexName
      });

      if (!indexExists.body) {
        console.log(`🔧 Creating OpenSearch index: ${this.indexName}`);
        
        // Create index with vector field mapping
        await this.client.indices.create({
          index: this.indexName,
          body: {
            settings: {
              index: {
                knn: true,
                'knn.algo_param.ef_search': 100
              }
            },
            mappings: {
              properties: {
                vector: {
                  type: 'knn_vector',
                  dimension: 384, // Claude-compatible embedding dimension
                  method: {
                    name: 'hnsw',
                    space_type: 'cosinesimil',
                    engine: 'nmslib',
                    parameters: {
                      ef_construction: 128,
                      m: 24
                    }
                  }
                },
                metadata: {
                  type: 'object',
                  properties: {
                    userId: { type: 'keyword' },
                    tenantId: { type: 'keyword' },
                    title: { type: 'text' },
                    source: { type: 'keyword' },
                    accessLevel: { type: 'keyword' },
                    contentType: { type: 'keyword' },
                    createdAt: { type: 'date' },
                    textChunk: { type: 'text' },
                    chunkIndex: { type: 'integer' },
                    totalChunks: { type: 'integer' }
                  }
                }
              }
            }
          }
        });

        console.log(`✅ OpenSearch index ${this.indexName} created successfully`);
      } else {
        console.log(`✅ OpenSearch index ${this.indexName} already exists`);
      }
    } catch (error) {
      console.error('❌ Failed to initialize OpenSearch index:', error);
      throw error;
    }
  }

  /**
   * Store vector documents in OpenSearch
   */
  async storeVectors(documents: VectorDocument[]): Promise<void> {
    try {
      // Prepare bulk operations
      const body = [];
      
      for (const doc of documents) {
        // Index operation
        body.push({
          index: {
            _index: this.indexName,
            _id: doc.id
          }
        });
        
        // Document data
        body.push({
          vector: doc.vector,
          metadata: doc.metadata
        });
      }

      // Execute bulk operation
      const response = await this.client.bulk({
        refresh: true,
        body: body
      });

      if (response.body.errors) {
        console.error('❌ Some documents failed to index:', response.body.items);
        throw new Error('Bulk indexing had errors');
      }

      console.log(`✅ Stored ${documents.length} vectors in OpenSearch`);
    } catch (error) {
      console.error('❌ Failed to store vectors:', error);
      throw error;
    }
  }

  /**
   * Search for similar vectors using k-NN
   */
  async searchVectors(
    queryVector: number[],
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    try {
      const searchBody: any = {
        size: options.topK || 5,
        query: {
          bool: {
            must: [
              {
                knn: {
                  vector: {
                    vector: queryVector,
                    k: options.topK || 5
                  }
                }
              }
            ]
          }
        }
      };

      // Add filters if provided
      if (options.filter) {
        const filterClauses = [];
        
        for (const [key, value] of Object.entries(options.filter)) {
          if (Array.isArray(value)) {
            filterClauses.push({
              terms: { [`metadata.${key}`]: value }
            });
          } else {
            filterClauses.push({
              term: { [`metadata.${key}`]: value }
            });
          }
        }
        
        if (filterClauses.length > 0) {
          searchBody.query.bool.filter = filterClauses;
        }
      }

      const response = await this.client.search({
        index: this.indexName,
        body: searchBody
      });

      const results: VectorSearchResult[] = response.body.hits.hits.map((hit: any) => ({
        id: hit._id,
        score: hit._score,
        metadata: hit._source.metadata
      }));

      return results;
    } catch (error) {
      console.error('❌ Failed to search vectors:', error);
      throw error;
    }
  }

  /**
   * Delete vectors by query
   */
  async deleteVectors(filter: Record<string, any>): Promise<void> {
    try {
      const deleteQuery: any = {
        query: {
          bool: {
            must: []
          }
        }
      };

      // Build delete query from filter
      for (const [key, value] of Object.entries(filter)) {
        if (Array.isArray(value)) {
          deleteQuery.query.bool.must.push({
            terms: { [`metadata.${key}`]: value }
          });
        } else {
          deleteQuery.query.bool.must.push({
            term: { [`metadata.${key}`]: value }
          });
        }
      }

      await this.client.deleteByQuery({
        index: this.indexName,
        body: deleteQuery,
        refresh: true
      });

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
      const response = await this.client.indices.stats({
        index: this.indexName
      });
      return response.body;
    } catch (error) {
      console.error('❌ Failed to get index stats:', error);
      throw error;
    }
  }

  /**
   * Health check for OpenSearch connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.cluster.health();
      return response.body.status !== 'red';
    } catch (error) {
      console.error('❌ OpenSearch health check failed:', error);
      return false;
    }
  }
}

export default OpenSearchAccessor;

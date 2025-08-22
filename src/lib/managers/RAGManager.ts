// RAG Manager that supports both OpenSearch and Local Vector Store
import { OpenSearchAccessor } from '@/lib/accessors/OpenSearchAccessor';
import { LocalVectorStore } from '@/lib/accessors/LocalVectorStore';
import { VectorSearchResult } from '@/types';

export class RAGManager {
  private openSearchAccessor?: OpenSearchAccessor;
  private localVectorStore?: LocalVectorStore;
  private useLocalStore: boolean;
  private isInitialized: boolean = false;

  constructor() {
    this.useLocalStore = !process.env.OPENSEARCH_ENDPOINT;
    
    if (this.useLocalStore) {
      console.log('🔍 RAGManager: Using Local Vector Store (no OpenSearch endpoint configured)');
      this.localVectorStore = new LocalVectorStore();
      this.isInitialized = true;
    } else {
      console.log('🔍 RAGManager: Configuring OpenSearch');
      try {
        this.openSearchAccessor = new OpenSearchAccessor();
      } catch (error) {
        console.log('⚠️ OpenSearch unavailable, falling back to Local Vector Store');
        this.useLocalStore = true;
        this.localVectorStore = new LocalVectorStore();
        this.isInitialized = true;
      }
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (this.openSearchAccessor && !this.useLocalStore) {
      try {
        await this.openSearchAccessor.initializeIndex();
        this.isInitialized = true;
        console.log('✅ RAGManager: OpenSearch initialized');
      } catch (error) {
        console.log('⚠️ OpenSearch initialization failed, falling back to Local Vector Store');
        this.useLocalStore = true;
        this.localVectorStore = new LocalVectorStore();
        this.isInitialized = true;
      }
    }
  }

  async searchRelevantContent(query: string, tenantId: string, accessLevel: string = 'PUBLIC'): Promise<VectorSearchResult[]> {
    try {
      await this.initialize();

      if (this.useLocalStore && this.localVectorStore) {
        const results = await this.localVectorStore.search(query, 5);
        console.log(`🔍 Local Vector Store found ${results.length} relevant documents for query: "${query}"`);
        return results;
      } else if (this.openSearchAccessor && this.isInitialized) {
        try {
          const results = await this.openSearchAccessor.searchContent(query, tenantId, accessLevel);
          console.log(`🔍 OpenSearch found ${results.length} relevant documents for query: "${query}"`);
          return results;
        } catch (error) {
          console.log('⚠️ OpenSearch search failed, falling back to Local Vector Store');
          if (!this.localVectorStore) {
            this.localVectorStore = new LocalVectorStore();
          }
          this.useLocalStore = true;
          const results = await this.localVectorStore.search(query, 5);
          console.log(`🔍 Local Vector Store (fallback) found ${results.length} relevant documents`);
          return results;
        }
      } else {
        console.log('🔍 No vector store available, returning empty results');
        return [];
      }
    } catch (error) {
      console.error('❌ Error searching for relevant content:', error);
      // Final fallback to Local Vector Store
      if (!this.localVectorStore) {
        this.localVectorStore = new LocalVectorStore();
      }
      this.useLocalStore = true;
      return await this.localVectorStore.search(query, 5);
    }
  }

  async addDocument(content: string, metadata: any): Promise<void> {
    try {
      if (this.useLocalStore && this.localVectorStore) {
        await this.localVectorStore.addDocument({
          id: Date.now().toString(),
          content,
          metadata
        });
        console.log('✅ Document added to Local Vector Store');
      } else if (this.openSearchAccessor) {
        await this.openSearchAccessor.indexDocument({
          content,
          metadata,
          tenantId: metadata.tenantId || 'default'
        });
        console.log('✅ Document added to OpenSearch');
      }
    } catch (error) {
      console.error('❌ Error adding document:', error);
    }
  }

  formatRAGContext(searchResults: VectorSearchResult[]): string {
    if (searchResults.length === 0) {
      return '';
    }

    const contextParts = searchResults.map((result, index) => {
      return `[Source ${index + 1}: ${result.metadata.title}]
${result.content}
Relevance: ${Math.round(result.score * 100)}%`;
    });

    return `Based on the following relevant information from your knowledge base:

${contextParts.join('\n\n')}

Please provide a comprehensive answer using this context.`;
  }

  getStoreType(): string {
    return this.useLocalStore ? 'Local Vector Store' : 'OpenSearch';
  }
}

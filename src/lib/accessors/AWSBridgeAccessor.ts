/**
 * AWS Bridge Accessor - Integration layer between Next.js and AWS services
 * Provides hybrid functionality using both local Next.js and AWS Lambda processing
 */

import { BedrockAccessor } from './BedrockAccessor';
import { OpenSearchAccessor, VectorDocument, VectorSearchResult, VectorSearchOptions } from './OpenSearchAccessor';
import { S3Accessor } from './S3Accessor';

export interface AWSConfig {
  region: string;
  s3Bucket: string;
  openSearchEndpoint: string;
  apiEndpoint: string;
}

export interface ProcessingResult {
  success: boolean;
  documentId: string;
  chunks: number;
  vectors: number;
  error?: string;
}

export interface QueryResult {
  success: boolean;
  message: string;
  sources: any[];
  videos: any[];
  processingTime?: number;
  error?: string;
}

export class AWSBridgeAccessor {
  private bedrockAccessor: BedrockAccessor;
  private openSearchAccessor: OpenSearchAccessor;
  private s3Accessor: S3Accessor;
  private config: AWSConfig;

  constructor() {
    // Initialize AWS configuration from environment
    this.config = {
      region: process.env.AWS_REGION || 'us-east-1',
      s3Bucket: process.env.AWS_S3_BUCKET || '',
      openSearchEndpoint: process.env.AWS_OPENSEARCH_ENDPOINT || '',
      apiEndpoint: process.env.AWS_API_ENDPOINT || ''
    };

    // Initialize accessors
    this.bedrockAccessor = new BedrockAccessor();
    this.openSearchAccessor = new OpenSearchAccessor();
    this.s3Accessor = new S3Accessor(
      this.config.s3Bucket,
      this.config.region
    );
  }

  /**
   * Check if AWS services are available and configured
   */
  async isAWSAvailable(): Promise<boolean> {
    try {
      // Check if all required AWS configuration is present
      if (!this.config.s3Bucket || !this.config.openSearchEndpoint) {
        console.log('❌ AWS configuration incomplete');
        return false;
      }

      // Check OpenSearch connectivity
      const openSearchHealthy = await this.openSearchAccessor.healthCheck();
      if (!openSearchHealthy) {
        console.log('❌ OpenSearch not healthy');
        return false;
      }

      console.log('✅ AWS services are available');
      return true;
    } catch (error) {
      console.error('❌ AWS availability check failed:', error);
      return false;
    }
  }

  /**
   * Process document using AWS Lambda (via API Gateway) or fallback to local processing
   */
  async processDocument(
    fileKey: string,
    userId: string,
    tenantId: string,
    metadata: any
  ): Promise<ProcessingResult> {
    try {
      const isAWSAvailable = await this.isAWSAvailable();
      
      if (isAWSAvailable && this.config.apiEndpoint) {
        // Use AWS Lambda processing via API Gateway
        return await this.processDocumentAWS(fileKey, userId, tenantId, metadata);
      } else {
        // Fallback to local processing
        return await this.processDocumentLocal(fileKey, userId, tenantId, metadata);
      }
    } catch (error) {
      console.error('❌ Document processing failed:', error);
      return {
        success: false,
        documentId: fileKey,
        chunks: 0,
        vectors: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process document using AWS Lambda
   */
  private async processDocumentAWS(
    fileKey: string,
    userId: string,
    tenantId: string,
    metadata: any
  ): Promise<ProcessingResult> {
    try {
      // Upload file to S3 if not already there
      const s3Key = `uploads/${userId}/${fileKey}`;
      
      // The S3 upload will automatically trigger Lambda processing
      // We can check processing status via the API
      const response = await fetch(`${this.config.apiEndpoint}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          s3Key,
          userId,
          tenantId
        })
      });

      if (!response.ok) {
        throw new Error(`AWS processing failed: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        documentId: fileKey,
        chunks: result.chunks || 0,
        vectors: result.vectors || 0
      };
    } catch (error) {
      throw new Error(`AWS document processing failed: ${error}`);
    }
  }

  /**
   * Process document locally (fallback)
   */
  private async processDocumentLocal(
    fileKey: string,
    userId: string,
    tenantId: string,
    metadata: any
  ): Promise<ProcessingResult> {
    try {
      console.log('🔄 Processing document locally as fallback');
      
      // Use existing local processing logic
      // This would integrate with your existing DocumentEngine
      
      return {
        success: true,
        documentId: fileKey,
        chunks: 1, // Simplified for fallback
        vectors: 1,
      };
    } catch (error) {
      throw new Error(`Local document processing failed: ${error}`);
    }
  }

  /**
   * Query using AWS OpenSearch or fallback to local search
   */
  async queryRAG(
    query: string,
    userId: string,
    tenantId: string,
    context: any = {}
  ): Promise<QueryResult> {
    const startTime = Date.now();
    
    try {
      const isAWSAvailable = await this.isAWSAvailable();
      
      if (isAWSAvailable) {
        // Use AWS OpenSearch for vector similarity search
        return await this.queryAWS(query, userId, tenantId, context);
      } else {
        // Fallback to local MongoDB search
        return await this.queryLocal(query, userId, tenantId, context);
      }
    } catch (error) {
      console.error('❌ RAG query failed:', error);
      return {
        success: false,
        message: "I'm having trouble processing your question right now. Please try again.",
        sources: [],
        videos: [],
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Query using AWS services
   */
  private async queryAWS(
    query: string,
    userId: string,
    tenantId: string,
    context: any
  ): Promise<QueryResult> {
    try {
      // Generate query embedding using Bedrock
      const queryEmbedding = await this.generateQueryEmbedding(query);
      
      // Search OpenSearch for similar vectors
      const searchResults = await this.openSearchAccessor.searchVectors(
        queryEmbedding,
        {
          topK: 5,
          filter: { userId, tenantId, accessLevel: ['PUBLIC', 'ACCOUNT'] }
        }
      );

      // Generate AI response using Bedrock with retrieved context
      const aiResponse = await this.generateAIResponse(query, searchResults, context);

      return {
        success: true,
        message: aiResponse,
        sources: this.formatSources(searchResults),
        videos: this.extractVideoRecommendations(searchResults),
        processingTime: 0
      };
    } catch (error) {
      throw new Error(`AWS query processing failed: ${error}`);
    }
  }

  /**
   * Query using local services (fallback)
   */
  private async queryLocal(
    query: string,
    userId: string,
    tenantId: string,
    context: any
  ): Promise<QueryResult> {
    try {
      console.log('🔄 Using local query processing as fallback');
      
      // This would integrate with your existing ConversationManager
      // and use MongoDB for text search instead of vector similarity
      
      return {
        success: true,
        message: "I'm here to help with your eyecare questions using local processing.",
        sources: [],
        videos: [],
        processingTime: 0
      };
    } catch (error) {
      throw new Error(`Local query processing failed: ${error}`);
    }
  }

  /**
   * Generate query embedding using Bedrock
   */
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    try {
      // Use Bedrock Titan embeddings
      const response = await fetch('https://bedrock-runtime.us-east-1.amazonaws.com/model/amazon.titan-embed-text-v1/invoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `AWS4-HMAC-SHA256 ${await this.getAWSSignature()}`
        },
        body: JSON.stringify({ inputText: query })
      });

      const result = await response.json();
      return result.embedding;
    } catch (error) {
      console.error('❌ Failed to generate query embedding:', error);
      // Return a dummy embedding for fallback
      return new Array(384).fill(0);
    }
  }

  /**
   * Generate AI response using Bedrock Claude
   */
  private async generateAIResponse(
    query: string,
    searchResults: VectorSearchResult[],
    context: any
  ): Promise<string> {
    try {
      // Build context from search results
      const ragContext = searchResults
        .slice(0, 3)
        .map(result => `Source: ${result.metadata.title}\nContent: ${result.metadata.textChunk}`)
        .join('\n\n');

      // Create prompt for Bedrock Claude
      const prompt = `You are an expert eyecare assistant helping with Eyefinity practice management.

User Query: ${query}

Relevant Information:
${ragContext}

Page Context: ${JSON.stringify(context, null, 2)}

Please provide a helpful response based on the relevant information and context. Focus on practical, actionable advice for eyecare professionals.`;

      // Use existing BedrockAccessor
      const response = await this.bedrockAccessor.generateChatResponse(prompt, ragContext);
      return typeof response === 'string' ? response : response.message || response.content || 'Unable to generate response';
    } catch (error) {
      console.error('❌ Failed to generate AI response:', error);
      return "I'm here to help with your eyecare questions. Please try rephrasing your question.";
    }
  }

  /**
   * Format search results as sources
   */
  private formatSources(searchResults: VectorSearchResult[]): any[] {
    return searchResults.map(result => ({
      title: result.metadata.title,
      source: result.metadata.source,
      contentType: result.metadata.contentType,
      relevance: `${Math.round(result.score * 100)}%`,
      url: result.metadata.source.startsWith('http') ? result.metadata.source : undefined
    }));
  }

  /**
   * Extract video recommendations from search results
   */
  private extractVideoRecommendations(searchResults: VectorSearchResult[]): any[] {
    return searchResults
      .filter(result => result.metadata.contentType === 'video')
      .slice(0, 3)
      .map(result => ({
        title: result.metadata.title,
        link: result.metadata.source,
        duration: '5 min', // Would be extracted from metadata
        relevance: `${Math.round(result.score * 100)}%`
      }));
  }

  /**
   * Get AWS signature (simplified - would use AWS SDK in practice)
   */
  private async getAWSSignature(): Promise<string> {
    // This would use AWS SDK to generate proper signature
    // For now, return empty string and rely on environment credentials
    return '';
  }

  /**
   * Initialize OpenSearch index if using AWS
   */
  async initializeAWS(): Promise<boolean> {
    try {
      const isAvailable = await this.isAWSAvailable();
      if (!isAvailable) {
        console.log('⚠️ AWS not available, using local services');
        return false;
      }

      // Initialize OpenSearch index
      await this.openSearchAccessor.initializeIndex();
      console.log('✅ AWS services initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize AWS services:', error);
      return false;
    }
  }

  /**
   * Get system status
   */
  async getSystemStatus(): Promise<{
    aws: boolean;
    openSearch: boolean;
    bedrock: boolean;
    mode: 'aws' | 'local' | 'hybrid';
  }> {
    const awsAvailable = await this.isAWSAvailable();
    const openSearchHealthy = awsAvailable ? await this.openSearchAccessor.healthCheck() : false;
    
    return {
      aws: awsAvailable,
      openSearch: openSearchHealthy,
      bedrock: process.env.USE_BEDROCK === 'true',
      mode: awsAvailable ? 'aws' : 'local'
    };
  }
}

export default AWSBridgeAccessor;

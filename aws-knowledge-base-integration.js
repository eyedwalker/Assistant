// AWS Knowledge Base Integration for Video-to-AI Training
// Replace current OpenSearch implementation with Knowledge Base

const { BedrockAgentRuntimeClient, RetrieveAndGenerateCommand } = require('@aws-sdk/client-bedrock-agent-runtime');

class AWSKnowledgeBaseAccessor {
  constructor() {
    this.client = new BedrockAgentRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.knowledgeBaseId = process.env.AWS_KNOWLEDGE_BASE_ID; // Set this after creation
    this.modelArn = `arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20240620-v1:0`;
  }

  /**
   * Query Knowledge Base with RAG (Retrieve and Generate)
   */
  async queryWithRAG(query, sessionId = null) {
    try {
      const input = {
        input: {
          text: query
        },
        retrieveAndGenerateConfiguration: {
          type: 'KNOWLEDGE_BASE',
          knowledgeBaseConfiguration: {
            knowledgeBaseId: this.knowledgeBaseId,
            modelArn: this.modelArn,
            retrievalConfiguration: {
              vectorSearchConfiguration: {
                numberOfResults: 5,
                overrideSearchType: 'SEMANTIC' // or 'HYBRID'
              }
            }
          }
        }
      };

      // Add session for conversational context
      if (sessionId) {
        input.sessionId = sessionId;
      }

      const command = new RetrieveAndGenerateCommand(input);
      const response = await this.client.send(command);

      return {
        success: true,
        answer: response.output.text,
        sources: response.citations || [],
        sessionId: response.sessionId,
        metadata: {
          knowledgeBaseId: this.knowledgeBaseId,
          model: 'claude-3-5-sonnet',
          retrievedDocuments: response.citations?.length || 0
        }
      };

    } catch (error) {
      console.error('❌ Knowledge Base query failed:', error);
      return {
        success: false,
        error: error.message,
        fallback: 'Local Vector Store'
      };
    }
  }

  /**
   * Add new video knowledge to S3 (triggers auto-sync)
   */
  async addVideoKnowledge(videoData) {
    const s3Key = `videos/${videoData.videoId}/knowledge.txt`;
    
    // Format video knowledge for optimal RAG retrieval
    const knowledgeContent = this.formatVideoKnowledge(videoData);
    
    try {
      // Upload to S3 (Knowledge Base will auto-sync)
      const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
      const s3Client = new S3Client({ region: process.env.AWS_REGION });
      
      await s3Client.send(new PutObjectCommand({
        Bucket: process.env.AWS_S3_KNOWLEDGE_BUCKET,
        Key: s3Key,
        Body: knowledgeContent,
        ContentType: 'text/plain',
        Metadata: {
          videoId: videoData.videoId,
          title: videoData.title,
          category: videoData.category,
          uploadedAt: new Date().toISOString()
        }
      }));

      console.log(`✅ Video knowledge uploaded: ${s3Key}`);
      
      // Trigger Knowledge Base sync (optional - auto-sync is default)
      await this.syncKnowledgeBase();
      
      return { success: true, s3Key };
      
    } catch (error) {
      console.error('❌ Failed to add video knowledge:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Format video data for optimal Knowledge Base retrieval
   */
  formatVideoKnowledge(videoData) {
    const sections = [];

    // Title and metadata
    sections.push(`Video Title: ${videoData.title || videoData.name}`);
    
    if (videoData.description) {
      sections.push(`Description: ${videoData.description}`);
    }

    // AI-generated content
    if (videoData.aiSummary) {
      sections.push(`Summary: ${videoData.aiSummary}`);
    }

    if (videoData.keyInsights && videoData.keyInsights.length > 0) {
      sections.push(`Key Learning Points:\n${videoData.keyInsights.map(insight => `- ${insight}`).join('\n')}`);
    }

    if (videoData.topics && videoData.topics.length > 0) {
      sections.push(`Topics Covered: ${videoData.topics.join(', ')}`);
    }

    // Full transcript for detailed queries
    if (videoData.transcript) {
      sections.push(`Full Transcript:\n${videoData.transcript}`);
    }

    // Metadata for filtering
    const metadata = [];
    if (videoData.vspProduct) metadata.push(`VSP Product: ${videoData.vspProduct}`);
    if (videoData.category) metadata.push(`Category: ${videoData.category}`);
    if (videoData.duration) metadata.push(`Duration: ${Math.floor(videoData.duration / 60)} minutes`);
    if (videoData.confidence) metadata.push(`Processing Confidence: ${Math.round(videoData.confidence * 100)}%`);
    
    if (metadata.length > 0) {
      sections.push(metadata.join('\n'));
    }

    return sections.join('\n\n');
  }

  /**
   * Manually trigger Knowledge Base sync
   */
  async syncKnowledgeBase() {
    try {
      const { BedrockAgentClient, StartIngestionJobCommand } = require('@aws-sdk/client-bedrock-agent');
      const agentClient = new BedrockAgentClient({ region: process.env.AWS_REGION });

      const command = new StartIngestionJobCommand({
        knowledgeBaseId: this.knowledgeBaseId,
        dataSourceId: process.env.AWS_KNOWLEDGE_BASE_DATA_SOURCE_ID
      });

      const response = await agentClient.send(command);
      console.log(`✅ Knowledge Base sync initiated: ${response.ingestionJob.ingestionJobId}`);
      
      return { success: true, jobId: response.ingestionJob.ingestionJobId };
      
    } catch (error) {
      console.error('❌ Knowledge Base sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Health check for Knowledge Base
   */
  async healthCheck() {
    try {
      const testResponse = await this.queryWithRAG("What topics are covered in our training videos?");
      return {
        healthy: testResponse.success,
        knowledgeBaseId: this.knowledgeBaseId,
        model: 'claude-3-5-sonnet',
        lastResponse: testResponse.success ? 'OK' : testResponse.error
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }
}

module.exports = { AWSKnowledgeBaseAccessor };

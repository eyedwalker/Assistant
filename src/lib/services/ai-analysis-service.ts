import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { 
  AIAnalysis, 
  ContentType, 
  QualityRating, 
  VectorEmbedding,
  DocumentMetadata 
} from '@/types';

interface AnalysisOptions {
  enableKeywordExtraction?: boolean;
  enableSentimentAnalysis?: boolean;
  enableTopicModeling?: boolean;
  enablePHIDetection?: boolean;
  chunkSize?: number;
  overlapSize?: number;
}

class AIAnalysisService {
  private anthropic: Anthropic;
  private openai?: OpenAI;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable not set');
    }

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // OpenAI is optional for embeddings
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  /**
   * Analyze document content using Claude
   */
  async analyzeContent(
    content: string, 
    title?: string, 
    url?: string,
    options: AnalysisOptions = {}
  ): Promise<AIAnalysis> {
    try {
      const prompt = this.buildAnalysisPrompt(content, title, url, options);
      
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const analysisText = response.content[0].type === 'text' 
        ? response.content[0].text 
        : '';

      return this.parseAnalysisResponse(analysisText, content);
    } catch (error) {
      console.error('AI analysis failed:', error);
      
      // Return basic analysis as fallback
      return this.generateBasicAnalysis(content, title);
    }
  }

  /**
   * Build comprehensive analysis prompt
   */
  private buildAnalysisPrompt(
    content: string, 
    title?: string, 
    url?: string,
    options: AnalysisOptions = {}
  ): string {
    const truncatedContent = content.length > 8000 
      ? content.substring(0, 8000) + '...' 
      : content;

    return `
Please analyze the following document content and provide a comprehensive analysis in JSON format.

Document Title: ${title || 'Unknown'}
Document URL: ${url || 'Unknown'}
Content Length: ${content.length} characters

CONTENT:
${truncatedContent}

Please provide your analysis in the following JSON structure:
{
  "summary": "A concise 2-3 sentence summary of the main content",
  "keywords": ["array", "of", "key", "terms", "and", "concepts"],
  "categories": ["primary", "category", "classifications"],
  "contentType": "documentation|training|reference|policy",
  "quality": "excellent|good|fair|poor",
  "topics": ["main", "topics", "covered"],
  "sentiment": "positive|neutral|negative",
  "readabilityScore": 0-100,
  "technicalComplexity": "low|medium|high",
  "confidenceScore": 0-100,
  "wordCount": ${content.split(' ').length},
  "entityCount": 0,
  ${options.enablePHIDetection ? '"phiDetected": false,' : ''}
  "eyecareRelevance": 0-100,
  "trainingValue": 0-100
}

Focus on:
1. Eyecare and optometry relevance
2. Training and educational value
3. Technical accuracy and completeness
4. Practical applicability for eyecare professionals
${options.enablePHIDetection ? '5. Detection of any PHI/PII (patient health information)' : ''}

Respond ONLY with valid JSON, no additional text.`;
  }

  /**
   * Parse Claude's analysis response
   */
  private parseAnalysisResponse(analysisText: string, originalContent: string): AIAnalysis {
    try {
      // Extract JSON from response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        summary: parsed.summary || 'No summary available',
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        categories: Array.isArray(parsed.categories) ? parsed.categories : [],
        contentType: this.validateContentType(parsed.contentType),
        quality: this.validateQuality(parsed.quality),
        wordCount: parsed.wordCount || originalContent.split(' ').length,
        entityCount: parsed.entityCount || 0,
        topics: Array.isArray(parsed.topics) ? parsed.topics : [],
        sentiment: parsed.sentiment || 'neutral',
        readabilityScore: Math.min(100, Math.max(0, parsed.readabilityScore || 50)),
        technicalComplexity: parsed.technicalComplexity || 'medium',
        confidenceScore: Math.min(100, Math.max(0, parsed.confidenceScore || 75))
      };
    } catch (error) {
      console.error('Failed to parse analysis response:', error);
      return this.generateBasicAnalysis(originalContent);
    }
  }

  /**
   * Generate basic analysis as fallback
   */
  private generateBasicAnalysis(content: string, title?: string): AIAnalysis {
    const words = content.split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;
    
    // Basic keyword extraction
    const wordFreq: Record<string, number> = {};
    words.forEach(word => {
      const cleaned = word.toLowerCase().replace(/[^\w]/g, '');
      if (cleaned.length > 3) {
        wordFreq[cleaned] = (wordFreq[cleaned] || 0) + 1;
      }
    });
    
    const keywords = Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);

    return {
      summary: title 
        ? `Document titled "${title}" contains ${wordCount} words of content.`
        : `Document contains ${wordCount} words of content.`,
      keywords,
      categories: ['general'],
      contentType: ContentType.DOCUMENTATION,
      quality: wordCount > 500 ? QualityRating.GOOD : QualityRating.FAIR,
      wordCount,
      entityCount: 0,
      topics: keywords.slice(0, 5),
      sentiment: 'neutral',
      readabilityScore: 50,
      technicalComplexity: 'medium',
      confidenceScore: 60
    };
  }

  /**
   * Generate vector embeddings for content chunks
   */
  async generateEmbeddings(
    content: string, 
    documentId: string,
    chunkSize: number = 1000,
    overlapSize: number = 200
  ): Promise<VectorEmbedding[]> {
    try {
      const chunks = this.chunkContent(content, chunkSize, overlapSize);
      const embeddings: VectorEmbedding[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        try {
          let embedding: number[];
          
          if (this.openai) {
            // Use OpenAI embeddings if available
            const response = await this.openai.embeddings.create({
              model: 'text-embedding-3-small',
              input: chunk.text,
            });
            embedding = response.data[0].embedding;
          } else {
            // Fallback to simple hash-based embedding
            embedding = this.generateSimpleEmbedding(chunk.text);
          }

          embeddings.push({
            id: crypto.randomUUID(),
            documentId,
            chunkText: chunk.text,
            embedding,
            chunkIndex: i,
            metadata: {
              startPosition: chunk.startPosition,
              endPosition: chunk.endPosition,
              importance: this.calculateChunkImportance(chunk.text)
            }
          });
        } catch (error) {
          console.error(`Failed to generate embedding for chunk ${i}:`, error);
        }
      }

      return embeddings;
    } catch (error) {
      console.error('Failed to generate embeddings:', error);
      return [];
    }
  }

  /**
   * Chunk content into overlapping segments
   */
  private chunkContent(
    content: string, 
    chunkSize: number, 
    overlapSize: number
  ): Array<{ text: string; startPosition: number; endPosition: number }> {
    const chunks = [];
    const words = content.split(/\s+/);
    
    for (let i = 0; i < words.length; i += chunkSize - overlapSize) {
      const chunkWords = words.slice(i, i + chunkSize);
      const text = chunkWords.join(' ');
      
      chunks.push({
        text,
        startPosition: i,
        endPosition: Math.min(i + chunkSize, words.length)
      });
      
      if (i + chunkSize >= words.length) break;
    }
    
    return chunks;
  }

  /**
   * Calculate importance score for a chunk
   */
  private calculateChunkImportance(text: string): number {
    const importantTerms = [
      'eyecare', 'optometry', 'vision', 'eye', 'patient', 'treatment',
      'diagnosis', 'prescription', 'lens', 'frame', 'contact', 'exam',
      'important', 'critical', 'warning', 'note', 'procedure', 'protocol'
    ];
    
    const lowerText = text.toLowerCase();
    let score = 0;
    
    importantTerms.forEach(term => {
      const matches = (lowerText.match(new RegExp(term, 'g')) || []).length;
      score += matches;
    });
    
    // Normalize to 0-1 range
    return Math.min(1, score / 10);
  }

  /**
   * Generate simple embedding as fallback
   */
  private generateSimpleEmbedding(text: string): number[] {
    const embedding = new Array(384).fill(0); // Standard embedding size
    const words = text.toLowerCase().split(/\s+/);
    
    words.forEach((word, index) => {
      const hash = this.simpleHash(word);
      const position = Math.abs(hash) % embedding.length;
      embedding[position] += 1 / (index + 1); // Weight by position
    });
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
  }

  /**
   * Simple hash function for fallback embedding
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  /**
   * Detect PHI/PII in content
   */
  async detectPHI(content: string): Promise<{
    detected: boolean;
    confidence: number;
    findings: string[];
  }> {
    try {
      const prompt = `
Analyze the following text for any Protected Health Information (PHI) or Personally Identifiable Information (PII).

Look for:
- Patient names
- Social Security Numbers
- Phone numbers
- Email addresses
- Addresses
- Medical record numbers
- Insurance information
- Birth dates
- Any other sensitive personal information

TEXT:
${content.substring(0, 2000)}

Respond with JSON only:
{
  "detected": boolean,
  "confidence": 0-100,
  "findings": ["list of detected PHI types"]
}`;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }]
      });

      const responseText = response.content[0].type === 'text' 
        ? response.content[0].text 
        : '';

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          detected: parsed.detected || false,
          confidence: parsed.confidence || 0,
          findings: parsed.findings || []
        };
      }
    } catch (error) {
      console.error('PHI detection failed:', error);
    }

    return { detected: false, confidence: 0, findings: [] };
  }

  /**
   * Validate content type
   */
  private validateContentType(type: string): ContentType {
    const validTypes = Object.values(ContentType);
    return validTypes.includes(type as ContentType) 
      ? type as ContentType 
      : ContentType.DOCUMENTATION;
  }

  /**
   * Validate quality rating
   */
  private validateQuality(quality: string): QualityRating {
    const validQualities = Object.values(QualityRating);
    return validQualities.includes(quality as QualityRating)
      ? quality as QualityRating
      : QualityRating.FAIR;
  }

  /**
   * Batch analyze multiple documents
   */
  async batchAnalyze(
    documents: Array<{ content: string; title?: string; url?: string }>,
    options: AnalysisOptions = {}
  ): Promise<AIAnalysis[]> {
    const results: AIAnalysis[] = [];
    
    // Process in batches to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      
      const batchPromises = batch.map(doc => 
        this.analyzeContent(doc.content, doc.title, doc.url, options)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error('Batch analysis failed:', result.reason);
          results.push(this.generateBasicAnalysis('', 'Failed Analysis'));
        }
      });
      
      // Rate limiting delay
      if (i + batchSize < documents.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  /**
   * Health check for AI services
   */
  async healthCheck(): Promise<{
    anthropic: boolean;
    openai: boolean;
    status: 'healthy' | 'degraded' | 'down';
  }> {
    const results: {
      anthropic: boolean;
      openai: boolean;
      status: 'healthy' | 'degraded' | 'down';
    } = {
      anthropic: false,
      openai: false,
      status: 'down'
    };

    try {
      // Test Anthropic
      await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hello' }]
      });
      results.anthropic = true;
    } catch (error) {
      console.error('Anthropic health check failed:', error);
    }

    try {
      // Test OpenAI if configured
      if (this.openai) {
        await this.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: 'test',
        });
        results.openai = true;
      } else {
        results.openai = true; // Not configured, so consider it "healthy"
      }
    } catch (error) {
      console.error('OpenAI health check failed:', error);
    }

    if (results.anthropic && results.openai) {
      results.status = 'healthy';
    } else if (results.anthropic) {
      results.status = 'degraded';
    }

    return results;
  }
}

// Export singleton instance
export const aiAnalysisService = new AIAnalysisService();
export default aiAnalysisService;

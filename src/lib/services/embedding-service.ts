/**
 * Embedding Service
 * Generates embeddings for text content using Anthropic Claude
 */

import Anthropic from '@anthropic-ai/sdk';

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

export interface TextChunk {
  text: string;
  index: number;
  metadata?: Record<string, any>;
}

export class EmbeddingService {
  private anthropicClient?: Anthropic;

  constructor() {
    // Initialize Anthropic client if API key is available
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropicClient = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
  }

  /**
   * Generate embedding for a single text using Claude-compatible approach
   * Since Anthropic doesn't provide embeddings, we use a simple TF-IDF-like approach
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    try {
      // Clean and normalize text
      const cleanText = text.replace(/\n/g, ' ').trim().toLowerCase();
      
      // Generate a simple vector representation using character n-grams and word features
      const embedding = this.generateSimpleEmbedding(cleanText);
      const tokenCount = cleanText.split(/\s+/).length;

      return {
        embedding,
        tokenCount
      };
    } catch (error) {
      console.error('❌ Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Generate simple embedding using TF-IDF-like approach
   */
  private generateSimpleEmbedding(text: string): number[] {
    const dimension = 384; // Smaller dimension for efficiency
    const embedding = new Array(dimension).fill(0);
    
    // Extract features: words, bigrams, character n-grams
    const words = text.split(/\s+/).filter(w => w.length > 2);
    const bigrams = [];
    const trigrams = [];
    
    // Generate bigrams and trigrams
    for (let i = 0; i < words.length - 1; i++) {
      bigrams.push(words[i] + ' ' + words[i + 1]);
      if (i < words.length - 2) {
        trigrams.push(words[i] + ' ' + words[i + 1] + ' ' + words[i + 2]);
      }
    }
    
    // Hash features into embedding dimensions
    const allFeatures = [...words, ...bigrams, ...trigrams];
    
    for (const feature of allFeatures) {
      const hash = this.simpleHash(feature);
      const index = Math.abs(hash) % dimension;
      embedding[index] += 1.0 / Math.sqrt(allFeatures.length);
    }
    
    // Normalize the embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }
    
    return embedding;
  }

  /**
   * Simple hash function for feature mapping
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
   * Generate embeddings for multiple texts in batch
   */
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    try {
      // Process all texts using our simple embedding approach
      const results: EmbeddingResult[] = [];

      for (const text of texts) {
        const result = await this.generateEmbedding(text);
        results.push(result);
      }

      return results;
    } catch (error) {
      console.error('❌ Failed to generate embeddings:', error);
      throw error;
    }
  }

  /**
   * Chunk text into smaller pieces for embedding
   */
  chunkText(text: string, maxChunkSize: number = 1000, overlap: number = 100): TextChunk[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const chunks: TextChunk[] = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    let chunkIndex = 0;

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;

      const potentialChunk = currentChunk + (currentChunk ? '. ' : '') + trimmedSentence;

      if (potentialChunk.length <= maxChunkSize) {
        currentChunk = potentialChunk;
      } else {
        // Save current chunk if it has content
        if (currentChunk.trim()) {
          chunks.push({
            text: currentChunk.trim() + '.',
            index: chunkIndex++
          });
        }

        // Start new chunk with current sentence
        currentChunk = trimmedSentence;
      }
    }

    // Add the last chunk
    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim() + (currentChunk.endsWith('.') ? '' : '.'),
        index: chunkIndex
      });
    }

    // If no chunks were created, create one from the original text
    if (chunks.length === 0 && text.trim()) {
      chunks.push({
        text: text.trim(),
        index: 0
      });
    }

    return chunks;
  }

  /**
   * Generate embeddings for chunked content
   */
  async generateContentEmbeddings(
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<Array<{ chunk: TextChunk; embedding: EmbeddingResult }>> {
    const chunks = this.chunkText(content);
    
    if (chunks.length === 0) {
      console.warn('⚠️ No chunks generated from content');
      return [];
    }

    console.log(`📝 Generated ${chunks.length} chunks from content`);

    const texts = chunks.map(chunk => chunk.text);
    const embeddings = await this.generateEmbeddings(texts);

    return chunks.map((chunk, index) => ({
      chunk: {
        ...chunk,
        metadata
      },
      embedding: embeddings[index]
    }));
  }

  /**
   * Generate embedding for search query
   */
  async generateQueryEmbedding(query: string): Promise<number[]> {
    const result = await this.generateEmbedding(query);
    return result.embedding;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  calculateSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

export default EmbeddingService;

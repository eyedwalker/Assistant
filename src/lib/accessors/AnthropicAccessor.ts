/**
 * AnthropicAccessor - VBD Accessor Layer
 * 
 * Handles all Anthropic Claude API operations - stable, technology-specific
 * Provides clean interface for AI services with no business logic
 */

import Anthropic from '@anthropic-ai/sdk';

export interface AIAnalysisResult {
  summary: string;
  keywords: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  phiDetected: boolean;
  confidence: number;
  categories: string[];
}

export interface ChatResponse {
  message: string;
  confidence: number;
  sources?: string[];
  followUpQuestions?: string[];
}

export interface ContentAnalysisOptions {
  includeKeywords?: boolean;
  includeSentiment?: boolean;
  detectPHI?: boolean;
  maxKeywords?: number;
  language?: string;
}

export class AnthropicAccessor {
  private client: Anthropic;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    
    if (!key) {
      console.error('❌ ANTHROPIC_API_KEY not found in environment variables');
      throw new Error('Anthropic API key is required');
    }
    
    console.log('✅ AnthropicAccessor initialized with API key:', key.substring(0, 10) + '...');
    
    this.client = new Anthropic({
      apiKey: key
    });
  }

  /**
   * Analyze content for insights, keywords, and PHI detection
   */
  async analyzeContent(content: string, options: ContentAnalysisOptions = {}): Promise<AIAnalysisResult> {
    try {
      const prompt = this.buildAnalysisPrompt(content, options);
      
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const analysisText = response.content[0].type === 'text' ? response.content[0].text : '';
      return this.parseAnalysisResponse(analysisText);
    } catch (error) {
      console.error('Failed to analyze content:', error);
      return {
        summary: 'Analysis failed',
        keywords: [],
        sentiment: 'neutral',
        phiDetected: false,
        confidence: 0,
        categories: []
      };
    }
  }

  /**
   * Generate chat response for conversational AI
   */
  async generateChatResponse(
    message: string, 
    context: string = '', 
    conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = []
  ): Promise<ChatResponse> {
    try {
      const systemPrompt = this.buildChatSystemPrompt(context);
      
      // Build messages array with proper conversation history
      const messages = [
        ...conversationHistory,
        { role: 'user' as const, content: message }
      ];

      console.log('🤖 Generating chat response with:', {
        model: 'claude-3-5-sonnet-20241022',
        messageCount: messages.length,
        systemPromptLength: systemPrompt.length
      });

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 3000,
        system: systemPrompt, // Use system parameter instead of adding as user message
        messages: messages
      });

      const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
      
      return {
        message: responseText,
        confidence: 0.85, // Could be enhanced with actual confidence scoring
        followUpQuestions: this.extractFollowUpQuestions(responseText)
      };
    } catch (error) {
      console.error('❌ Failed to generate chat response:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      return {
        message: 'I apologize, but I encountered an error processing your request. Please try again.',
        confidence: 0
      };
    }
  }

  /**
   * Summarize long content
   */
  async summarizeContent(content: string, maxLength: number = 500): Promise<string> {
    try {
      const prompt = `Please provide a concise summary of the following content in approximately ${maxLength} characters or less. Focus on the key points and main ideas:

${content}

Summary:`;

      const response = await this.client.messages.create({
        model: 'claude-3-haiku-20240307', // Use faster model for summaries
        max_tokens: Math.ceil(maxLength / 3), // Rough token estimation
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      return response.content[0].type === 'text' ? response.content[0].text : 'Summary unavailable';
    } catch (error) {
      console.error('Failed to summarize content:', error);
      return 'Summary unavailable due to processing error';
    }
  }

  /**
   * Extract key information from medical/eyecare content
   */
  async extractMedicalInsights(content: string): Promise<{
    conditions: string[];
    treatments: string[];
    medications: string[];
    procedures: string[];
    recommendations: string[];
  }> {
    try {
      const prompt = `Analyze the following eyecare/medical content and extract key information. Return the results in JSON format with the following structure:
{
  "conditions": ["list of medical conditions mentioned"],
  "treatments": ["list of treatments mentioned"],
  "medications": ["list of medications mentioned"],
  "procedures": ["list of procedures mentioned"],
  "recommendations": ["list of recommendations or best practices"]
}

Content to analyze:
${content}`;

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const responseText = response.content[0].type === 'text' ? response.content[0].text : '{}';
      
      try {
        return JSON.parse(responseText);
      } catch {
        // Fallback if JSON parsing fails
        return {
          conditions: [],
          treatments: [],
          medications: [],
          procedures: [],
          recommendations: []
        };
      }
    } catch (error) {
      console.error('Failed to extract medical insights:', error);
      return {
        conditions: [],
        treatments: [],
        medications: [],
        procedures: [],
        recommendations: []
      };
    }
  }

  /**
   * Detect PHI (Protected Health Information) in content
   */
  async detectPHI(content: string): Promise<{
    hasPhI: boolean;
    phiTypes: string[];
    confidence: number;
    redactedContent?: string;
  }> {
    try {
      const prompt = `Analyze the following content for Protected Health Information (PHI). Look for:
- Patient names
- Medical record numbers
- Social security numbers
- Phone numbers
- Email addresses
- Addresses
- Dates of birth
- Account numbers

Return results in JSON format:
{
  "hasPHI": boolean,
  "phiTypes": ["list of PHI types found"],
  "confidence": number between 0 and 1,
  "redactedContent": "content with PHI replaced with [REDACTED]"
}

Content:
${content}`;

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const responseText = response.content[0].type === 'text' ? response.content[0].text : '{}';
      
      try {
        return JSON.parse(responseText);
      } catch {
        return {
          hasPhI: false,
          phiTypes: [],
          confidence: 0
        };
      }
    } catch (error) {
      console.error('Failed to detect PHI:', error);
      return {
        hasPhI: false,
        phiTypes: [],
        confidence: 0
      };
    }
  }

  /**
   * Generate embeddings for semantic search (placeholder - would use actual embedding service)
   */
  async generateEmbeddings(text: string): Promise<number[]> {
    // Note: Anthropic doesn't provide embeddings directly
    // This would typically use OpenAI's embedding API or similar
    // For now, return a placeholder
    console.warn('Embeddings not implemented - would use dedicated embedding service');
    return new Array(1536).fill(0).map(() => Math.random());
  }

  /**
   * Build analysis prompt based on options
   */
  private buildAnalysisPrompt(content: string, options: ContentAnalysisOptions): string {
    let prompt = `Analyze the following content and provide insights in JSON format:\n\n`;
    
    prompt += `{
  "summary": "Brief summary of the content",`;
    
    if (options.includeKeywords !== false) {
      prompt += `
  "keywords": ["array of ${options.maxKeywords || 10} most relevant keywords"],`;
    }
    
    if (options.includeSentiment !== false) {
      prompt += `
  "sentiment": "positive, negative, or neutral",`;
    }
    
    if (options.detectPHI !== false) {
      prompt += `
  "phiDetected": boolean indicating if PHI is present,`;
    }
    
    prompt += `
  "confidence": number between 0 and 1,
  "categories": ["relevant categories for this content"]
}

Content to analyze:
${content}`;

    return prompt;
  }

  /**
   * Build system prompt for chat responses
   */
  private buildChatSystemPrompt(context: string): string {
    return `You are an AI assistant specialized in eyecare and optometry, designed to help eyecare professionals with their daily tasks. You have access to relevant documents and information to provide accurate, helpful responses.

FORMATTING REQUIREMENTS:
- Use clear markdown formatting with headers (##), bullet points (-), and bold text (**bold**)
- Structure responses with logical sections and subsections
- Use numbered lists for step-by-step procedures
- CRITICAL: Add blank lines between ALL sections, subsections, and list items for proper spacing
- Add double line breaks (\n\n) between major sections
- Use single line breaks (\n) between list items within the same section
- Format complex information in tables when appropriate
- Use code blocks for technical configurations or settings

CONTENT GUIDELINES:
- Provide accurate, evidence-based information
- Be concise but thorough with clear structure
- Always prioritize patient safety
- Suggest consulting with colleagues or specialists when appropriate
- Never provide specific medical diagnoses or treatment recommendations without proper context
- Reference specific documentation sections when available

RESPONSE STRUCTURE:
- Start with a brief overview if the question is complex
- Use clear section headers (## Section Name) with blank lines before and after
- Provide actionable steps with numbered lists, each item on a new line
- Include relevant examples when helpful, separated by blank lines
- End with follow-up suggestions or next steps
- EXAMPLE SPACING:
  ## Section Header
  
  Content paragraph with explanation.
  
  ### Subsection
  
  - List item 1
  - List item 2
  - List item 3
  
  ## Next Section
  
  More content here.

${context ? `\nRELEVANT CONTEXT:\n${context}` : ''}

Please provide helpful, professional, and well-formatted responses to user questions using proper markdown structure.`;
  }

  /**
   * Parse analysis response from Claude
   */
  private parseAnalysisResponse(response: string): AIAnalysisResult {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || 'No summary available',
          keywords: parsed.keywords || [],
          sentiment: parsed.sentiment || 'neutral',
          phiDetected: parsed.phiDetected || false,
          confidence: parsed.confidence || 0.5,
          categories: parsed.categories || []
        };
      }
    } catch (error) {
      console.error('Failed to parse analysis response:', error);
    }

    // Fallback parsing
    return {
      summary: response.substring(0, 200) + '...',
      keywords: [],
      sentiment: 'neutral',
      phiDetected: false,
      confidence: 0.3,
      categories: []
    };
  }

  /**
   * Extract follow-up questions from response
   */
  private extractFollowUpQuestions(response: string): string[] {
    const questions: string[] = [];
    
    // Look for questions in the response
    const questionPattern = /(?:Would you like|Do you want|Are you interested|Should I|Can I help).*?\?/gi;
    const matches = response.match(questionPattern);
    
    if (matches) {
      questions.push(...matches.slice(0, 3)); // Limit to 3 questions
    }
    
    return questions;
  }

  /**
   * Analyze image content (for video frame analysis)
   */
  async analyzeImage(imageData: string, prompt: string = "Analyze this image and describe what you see."): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imageData
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }]
      });

      return response.content[0].type === 'text' ? response.content[0].text : 'Unable to analyze image';
    } catch (error) {
      console.error('Failed to analyze image:', error);
      return 'Image analysis failed';
    }
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{
          role: 'user',
          content: 'Hello'
        }]
      });
      
      return response.content.length > 0;
    } catch (error) {
      console.error('Anthropic API connection test failed:', error);
      return false;
    }
  }
}

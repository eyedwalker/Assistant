import { 
  BedrockRuntimeClient, 
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
  type InvokeModelCommandInput
} from '@aws-sdk/client-bedrock-runtime';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { ChatResponse } from '@/types';
import axios from 'axios';

export interface BedrockConfig {
  modelId?: string;
  guardrailId?: string;
  maxTokens?: number;
  temperature?: number;
  region?: string;
  useApiKey?: boolean;
  apiKey?: string;
  // Callback function to get a fresh token when the current one expires
  tokenRefreshCallback?: () => Promise<string>;
}

export class BedrockAccessor {
  private client: BedrockRuntimeClient;
  private modelId: string;
  private guardrailId?: string;
  private maxTokens: number;
  private temperature: number;
  private useApiKey: boolean;
  private apiKey?: string;
  private baseUrl: string;
  private awsAuthHeaders: Record<string, string> = {};
  private tokenExpiry?: Date;
  private tokenRefreshCallback?: () => Promise<string>;

  constructor(config?: BedrockConfig) {
    // Initialize token refresh callback if provided
    this.tokenRefreshCallback = config?.tokenRefreshCallback;
    
    // Configure HTTP handler to use HTTP/1.1 to avoid HTTP2 protocol errors
    const httpHandler = new NodeHttpHandler({
      connectionTimeout: 60000,
      socketTimeout: 60000,
      httpAgent: {
        maxSockets: 50,
        keepAlive: true,
      },
      httpsAgent: {
        maxSockets: 50,
        keepAlive: true,
        rejectUnauthorized: true,
      },
    });

    // Get the region from config, environment, or default to us-east-1
    const region = config?.region || 
      process.env.AWS_BEDROCK_REGION || 
      process.env.AWS_REGION || 
      'us-east-1';

    // Initialize other settings from config or defaults
    this.modelId = config?.modelId || process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20240620-v1:0';
    this.guardrailId = config?.guardrailId;
    this.maxTokens = config?.maxTokens || 4096;
    this.temperature = config?.temperature || 0.7;
    
    // DISABLE API key mode - Force AWS SDK mode for production use
    // API key mode is experimental and not recommended by AWS
    this.useApiKey = false;
    this.apiKey = undefined;
    
    console.log(`🔧 BedrockAccessor initialized:`);
    console.log(`  - useApiKey: ${this.useApiKey}`);
    console.log(`  - apiKey: ${this.apiKey ? 'SET' : 'UNDEFINED'}`);
    console.log(`  - modelId: ${this.modelId}`);
    console.log(`  - region: ${region}`);
    
    // Set the base URL for direct API calls
    this.baseUrl = `https://bedrock-runtime.${region}.amazonaws.com`;
    
    // Setup AWS SDK client (recommended approach)
    // Force HTTP/1.1 protocol to fix AWS SDK compatibility issues (from successful integration)
    const httpHandler1 = new NodeHttpHandler({
      connectionTimeout: 60000,
      socketTimeout: 60000,
      httpAgent: { 
        maxSockets: 50, 
        keepAlive: true
      },
      httpsAgent: { 
        maxSockets: 50, 
        keepAlive: true, 
        rejectUnauthorized: true
      }
    });

    this.client = new BedrockRuntimeClient({
      region,
      requestHandler: httpHandler1,
      maxAttempts: 3,
      // Use environment credentials or SSO credentials - avoid API key mode
      credentials: process.env.AWS_ACCESS_KEY_ID ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        sessionToken: process.env.AWS_SESSION_TOKEN,
      } : undefined, // Let SDK auto-discover credentials (SSO, etc.)
    });
    
    // Parse API key if available (experimental)
    if (this.useApiKey && this.apiKey) {
      console.warn('⚠️  API key authentication is experimental. AWS SDK credentials are recommended.');
      this.parseApiKey();
    } else {
      console.log('✅ Using AWS SDK with IAM credentials (recommended)');
    }
  }

  /**
   * Checks if the current token has expired
   */
  private isTokenExpired(): boolean {
    if (!this.tokenExpiry) {
      // If we couldn't calculate expiry, assume it's not expired
      return false;
    }
    
    // Consider the token expired 5 minutes before actual expiration
    // to avoid edge cases with server time differences
    const safetyBuffer = 5 * 60 * 1000; // 5 minutes in milliseconds
    const effectiveExpiry = new Date(this.tokenExpiry.getTime() - safetyBuffer);
    const now = new Date();
    
    const isExpired = now >= effectiveExpiry;
    if (isExpired) {
      console.log(`Token expired at ${this.tokenExpiry.toISOString()} (with safety buffer: ${effectiveExpiry.toISOString()})`);
    }
    
    return isExpired;
  }
  
  /**
   * Extract URL parameters from a string
   */
  private extractUrlParams(url: string): Record<string, string> {
    const params: Record<string, string> = {};
    const urlParts = url.split('?');
    if (urlParts.length > 1) {
      const query = urlParts[1];
      const pairs = query.split('&');
      for (const pair of pairs) {
        const [key, value] = pair.split('=');
        params[key] = value;
      }
    }
    return params;
  }
  
  /**
   * Parse the API key to extract AWS SigV4 components if it's a pre-signed URL
   */
  private parseApiKey(): void {
    if (!this.apiKey) return;
    
    try {
      // Check if the API key is Base64 encoded
      if (this.apiKey.match(/^[A-Za-z0-9+/=]+$/) && this.apiKey.length % 4 === 0) {
        // Try to decode as Base64
        try {
          const decodedToken = Buffer.from(this.apiKey, 'base64').toString('utf-8');
          
          if (decodedToken && decodedToken.includes('Action=CallWithBearerToken')) {
            console.log('API key appears to be a pre-signed URL with AWS auth components');
            const params = this.extractUrlParams(decodedToken);
            
            // Extract AWS auth components
            this.awsAuthHeaders = {
              'X-Amz-Algorithm': params['X-Amz-Algorithm'],
              'X-Amz-Credential': params['X-Amz-Credential'],
              'X-Amz-Date': params['X-Amz-Date'],
              'X-Amz-Expires': params['X-Amz-Expires'],
              'X-Amz-Security-Token': params['X-Amz-Security-Token'],
              'X-Amz-Signature': params['X-Amz-Signature'],
              'X-Amz-SignedHeaders': params['X-Amz-SignedHeaders']
            };
            
            // Calculate token expiry time
            if (params['X-Amz-Date'] && params['X-Amz-Expires']) {
              try {
                // Parse the AWS date format YYYYMMDDTHHMMSSZ
                const dateStr = params['X-Amz-Date'];
                const year = parseInt(dateStr.substring(0, 4));
                const month = parseInt(dateStr.substring(4, 6)) - 1; // JS months are 0-indexed
                const day = parseInt(dateStr.substring(6, 8));
                const hour = parseInt(dateStr.substring(9, 11));
                const minute = parseInt(dateStr.substring(11, 13));
                const second = parseInt(dateStr.substring(13, 15));
                
                const baseDate = new Date(Date.UTC(year, month, day, hour, minute, second));
                const expiresSeconds = parseInt(params['X-Amz-Expires']);
                
                this.tokenExpiry = new Date(baseDate.getTime() + expiresSeconds * 1000);
                const nowPlusFive = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
                
                if (this.tokenExpiry < nowPlusFive) {
                  console.warn(`Token expires soon: ${this.tokenExpiry.toISOString()}`);
                } else {
                  console.log(`Token valid until: ${this.tokenExpiry.toISOString()}`);
                }
              } catch (error) {
                console.error('Error calculating token expiry:', error instanceof Error ? error.message : String(error));
              }
            }
            
            console.log('Extracted AWS auth components from token:', Object.keys(this.awsAuthHeaders).join(', '));
          } else {
            console.log('API key does not appear to be a pre-signed URL, using as-is');
          }
        } catch (e) {
          console.log('Failed to decode API key as Base64, using as-is');
        }
      } else {
        console.log('API key does not appear to be Base64 encoded, using as-is');
      }
    } catch (error) {
      console.error('Error parsing API key:', error instanceof Error ? error.message : String(error));
    }
  }

  // Check if streaming is supported (only with AWS SDK credentials)
  private streamingSupported(): boolean {
    return !this.useApiKey || !this.apiKey;
  }

  async generateChatResponse(
    message: string,
    context: string = '',
    userId?: string,
    tenantId?: string
  ): Promise<ChatResponse> {
    try {
      // Prepare the request body
      const requestBody = {
        anthropic_version: 'bedrock-2023-05-31',
        messages: [
          {
            role: 'user',
            content: context ? 
              `Based on the following knowledge base content, provide a specific and detailed answer:

${context}

User Question: ${message}

Instructions:
- Use ONLY the information provided in the context above
- Reference specific details from the documents
- If the context contains appointment-related information, provide specific steps and instructions
- Be detailed and helpful, not generic
- If information is not in the context, say "Based on the available information..."` 
              : message
          }
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        system: 'You are an AI assistant for eyecare professionals specializing in Eyefinity systems. Always use the provided context to give specific, actionable answers. Never give generic responses when context is available.'
      };

      let responseBody;

      console.log(`🚀 generateChatResponse: useApiKey=${this.useApiKey}, apiKey=${this.apiKey ? 'SET' : 'UNDEFINED'}`);
      
      // Use direct API key approach ONLY if explicitly enabled
      if (this.useApiKey === true && this.apiKey) {
        console.log('🔑 Using API key authentication path');
      } else {
        console.log('🔐 Using AWS SDK authentication path');
      }
      
      if (this.useApiKey === true && this.apiKey) {
        // Make direct API call to Bedrock using axios
        console.log(`Using API key authentication with model: ${this.modelId}`);
        
        // Set up headers based on available auth components
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        
        try {
          // Check if token has expired and refresh if needed
          if (this.isTokenExpired() && this.tokenRefreshCallback) {
            console.log('Token expired. Attempting to refresh...');
            const freshToken = await this.tokenRefreshCallback();
            if (freshToken) {
              this.apiKey = freshToken;
              this.parseApiKey(); // Re-parse the new token
              console.log('Successfully refreshed token');
            }
          }

          // Use AWS auth components if available
          if (Object.keys(this.awsAuthHeaders).length > 0) {
            // Check if token is still valid after refresh attempt
            if (this.isTokenExpired()) {
              console.warn('AWS auth token is expired. Request may fail.');
            }
            
            console.log('Using AWS Signature v4 auth components');
            
            // Format the Authorization header using AWS Signature v4 format
            if (this.awsAuthHeaders['X-Amz-Algorithm'] && 
                this.awsAuthHeaders['X-Amz-Credential'] && 
                this.awsAuthHeaders['X-Amz-Signature'] && 
                this.awsAuthHeaders['X-Amz-SignedHeaders']) {
                  
              const authHeader = `${this.awsAuthHeaders['X-Amz-Algorithm']} ` +
                `Credential=${this.awsAuthHeaders['X-Amz-Credential']}, ` +
                `SignedHeaders=${this.awsAuthHeaders['X-Amz-SignedHeaders']}, ` +
                `Signature=${this.awsAuthHeaders['X-Amz-Signature']}`;
              
              headers['Authorization'] = authHeader;
              console.log('Generated AWS Signature v4 Authorization header');
            }
            
            // Also include the individual X-Amz-* headers
            Object.assign(headers, this.awsAuthHeaders);
          } else if (this.apiKey) {
            // Fall back to using the API key as Authorization header
            console.log('Using Authorization header with API key');
            headers.Authorization = this.apiKey;
          }
        } catch (error) {
          console.error('Error setting auth headers:', error instanceof Error ? error.message : String(error));
          // Continue with request attempt even if header setup fails
        }
        
        console.log(`Request headers: ${Object.keys(headers).join(', ')}`);
        
        const response = await axios.post(
          `${this.baseUrl}/model/${this.modelId}/invoke`,
          requestBody,
          {
            headers,
            timeout: 60000, // 60 second timeout
          }
        );
        
        responseBody = response.data;
      } else {
        // Use AWS SDK approach
        const command = new InvokeModelCommand({
          modelId: this.modelId,
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify(requestBody),
          ...(this.guardrailId && {
            guardrailIdentifier: this.guardrailId,
            guardrailVersion: 'DRAFT'
          }),
        });

        const response = await this.client.send(command);
        responseBody = JSON.parse(new TextDecoder().decode(response.body));
      }
      
      // Extract the message content
      const messageContent = responseBody.content?.[0]?.text || '';
      
      // Log usage if available
      if (responseBody.usage) {
        console.log('Bedrock usage:', {
          inputTokens: responseBody.usage.input_tokens,
          outputTokens: responseBody.usage.output_tokens,
          totalTokens: responseBody.usage.total_tokens,
          userId,
          tenantId
        });
      }

      return {
        message: messageContent,
        confidence: 0.95,
        sources: [],
        metadata: {
          model: this.modelId,
          tokens: responseBody.usage?.total_tokens,
          guardrailApplied: !!this.guardrailId
        }
      };
    } catch (error: any) {
      console.error('Bedrock API error:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        code: error.Code || error.code,
        statusCode: error.$metadata?.httpStatusCode,
        requestId: error.$metadata?.requestId,
        fault: error.$fault,
        service: error.$service
      });
      
      // Handle specific Bedrock errors
      if (error instanceof Error) {
        if (error.message.includes('guardrail')) {
          throw new Error('Content blocked by guardrail policy');
        }
        if (error.message.includes('throttle')) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        if (error.message.includes('unauthorized') || error.name === 'UnrecognizedClientException') {
          throw new Error('Invalid AWS credentials or permissions');
        }
        if (error.message.includes('ValidationException') || error.name === 'ValidationException') {
          throw new Error(`Model validation error: ${error.message}`);
        }
        if (error.name === 'ResourceNotFoundException') {
          throw new Error(`Model not found or not enabled in region: ${this.modelId}`);
        }
      }
      
      throw error;
    }
  }

  async generateStreamingResponse(
    message: string,
    context: string = '',
    onChunk: (chunk: string) => void,
    userId?: string,
    tenantId?: string
  ): Promise<void> {
    // API key authentication doesn't support streaming yet
    if (!this.streamingSupported()) {
      throw new Error('Streaming is not supported with API key authentication');
    }
    
    try {
      const requestBody = {
        anthropic_version: 'bedrock-2023-05-31',
        messages: [
          {
            role: 'user',
            content: context ? `Context:\n${context}\n\nQuestion: ${message}` : message
          }
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        system: 'You are an AI assistant for eyecare professionals.'
      };

      const command = new InvokeModelWithResponseStreamCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody),
        ...(this.guardrailId && {
          guardrailIdentifier: this.guardrailId,
          guardrailVersion: 'DRAFT'
        })
      });

      const response = await this.client.send(command);
      
      if (response.body) {
        for await (const chunk of response.body) {
          if (chunk.chunk) {
            const chunkData = JSON.parse(new TextDecoder().decode(chunk.chunk.bytes));
            if (chunkData.delta?.text) {
              onChunk(chunkData.delta.text);
            }
          }
        }
      }
    } catch (error) {
      console.error('Bedrock streaming error:', error);
      throw new Error('Failed to stream response from Bedrock');
    }
  }

  async analyzeImage(
    imageBase64: string,
    prompt: string = 'What is in this image?'
  ): Promise<string> {
    // API key authentication doesn't fully support image analysis yet
    if (this.useApiKey && this.apiKey) {
      throw new Error('Image analysis with API key authentication is not fully implemented');
    }
    
    try {
      const requestBody = {
        anthropic_version: 'bedrock-2023-05-31',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: imageBase64
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.5
      };

      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody)
      });

      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      return responseBody.content?.[0]?.text || 'Unable to analyze image';
    } catch (error) {
      console.error('Bedrock image analysis error:', error);
      throw new Error('Failed to analyze image with Bedrock');
    }
  }

  // Check if PHI was detected and blocked
  async checkGuardrailIntervention(response: any): Promise<boolean> {
    return response.guardrailIntervention || false;
  }

  // Get available models
  async listAvailableModels(): Promise<string[]> {
    return [
      'anthropic.claude-3-opus-20240229-v1:0',
      'anthropic.claude-3-sonnet-20240229-v1:0',
      'anthropic.claude-3-haiku-20240307-v1:0',
      'anthropic.claude-instant-v1',
      'amazon.titan-text-express-v1',
      'ai21.j2-ultra-v1',
      'ai21.j2-mid-v1',
      'meta.llama2-13b-chat-v1',
      'meta.llama2-70b-chat-v1'
    ];
  }
}

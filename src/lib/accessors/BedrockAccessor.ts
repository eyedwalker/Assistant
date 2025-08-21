import { 
  BedrockRuntimeClient, 
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
  type InvokeModelCommandInput
} from '@aws-sdk/client-bedrock-runtime';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { ChatResponse } from '@/types';

export interface BedrockConfig {
  region?: string;
  modelId?: string;
  guardrailId?: string;
  maxTokens?: number;
  temperature?: number;
}

export class BedrockAccessor {
  private client: BedrockRuntimeClient;
  private modelId: string;
  private guardrailId?: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config?: BedrockConfig) {
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
        rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0',
      },
    });

    this.client = new BedrockRuntimeClient({
      region: config?.region || process.env.AWS_BEDROCK_REGION || 'us-east-1',
      credentials: process.env.AWS_ACCESS_KEY_ID ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        sessionToken: process.env.AWS_SESSION_TOKEN, // Required for SSO credentials
      } : undefined,
      requestHandler: httpHandler,
      maxAttempts: 3,
      retryMode: 'adaptive',
    });

    this.modelId = config?.modelId || process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0';
    this.guardrailId = config?.guardrailId || process.env.BEDROCK_GUARDRAIL_ID;
    this.maxTokens = config?.maxTokens || 4000;
    this.temperature = config?.temperature || 0.7;
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

      // Build the command
      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody),
        ...(this.guardrailId && {
          guardrailIdentifier: this.guardrailId,
          guardrailVersion: 'DRAFT'
        }),
        // Trace is currently disabled due to type incompatibility
        // TODO: Enable trace when AWS SDK types are updated
      });

      // Invoke the model
      const response = await this.client.send(command);
      
      // Parse the response
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
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
    try {
      // Claude 3 models support vision
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
    // Common Bedrock model IDs
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

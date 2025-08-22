// Standalone BedrockAccessor for testing - bypasses Next.js caching
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { NodeHttpHandler } = require('@smithy/node-http-handler');

class BedrockAccessor {
  constructor(config = {}) {
    // Force AWS SDK mode - NO API KEY MODE
    this.useApiKey = false;
    this.apiKey = undefined;
    
    // Configuration from environment
    this.region = process.env.AWS_BEDROCK_REGION || 'us-east-1';
    this.modelId = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20240620-v1:0';
    
    console.log('🚀 BedrockAccessor Constructor:');
    console.log(`  - Mode: AWS SDK (NOT API KEY)`);
    console.log(`  - Region: ${this.region}`);
    console.log(`  - Model: ${this.modelId}`);
    console.log(`  - AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'NOT SET'}`);
    console.log(`  - AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET'}`);
    console.log(`  - AWS_SESSION_TOKEN: ${process.env.AWS_SESSION_TOKEN ? 'SET' : 'NOT SET'}`);
    
    // Create HTTP/1.1 handler (fixes AWS SDK compatibility)
    const httpHandler = new NodeHttpHandler({
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
    
    // Initialize AWS SDK client with explicit credentials
    this.client = new BedrockRuntimeClient({
      region: this.region,
      requestHandler: httpHandler,
      maxAttempts: 3,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN
      }
    });
    
    console.log('✅ BedrockAccessor initialized with AWS SDK');
  }
  
  async generateChatResponse(messages, options = {}) {
    console.log('\n📤 Generating chat response...');
    console.log(`  - Using AWS SDK mode (useApiKey=${this.useApiKey})`);
    console.log(`  - API Key: ${this.apiKey ? 'SET (ERROR!)' : 'NOT SET (correct)'}`);
    
    // Prepare request body for Claude
    const requestBody = {
      anthropic_version: 'bedrock-2023-05-31',
      messages: messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.7
    };
    
    try {
      console.log('  - Sending request to AWS Bedrock...');
      
      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody)
      });
      
      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      console.log('✅ Response received from AWS Bedrock');
      
      return {
        message: responseBody.content[0].text,
        confidence: 1.0,
        usage: responseBody.usage
      };
    } catch (error) {
      console.error('❌ Error calling AWS Bedrock:', error);
      console.error('  - Error name:', error.name);
      console.error('  - Error message:', error.message);
      if (error.$metadata) {
        console.error('  - HTTP status:', error.$metadata.httpStatusCode);
        console.error('  - Request ID:', error.$metadata.requestId);
      }
      throw error;
    }
  }
}

// Test function
async function testBedrock() {
  console.log('========================================');
  console.log('AWS Bedrock Standalone Test');
  console.log('========================================\n');
  
  // Set up environment variables
  process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || 'ASIAR45CBJVBDRNSYMWS';
  process.env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || 'XHjFnkI4en7oWn1czxfUEEf0F39PmQ+CmOjAsQYX';
  process.env.AWS_SESSION_TOKEN = process.env.AWS_SESSION_TOKEN || 'IQoJb3JpZ2luX2VjEKX//////////wEaCXVzLXdlc3QtMiJGMEQCICceStbuvP+pb82fiMZSZgo6OZhxorWPs/yr5mwwCLVmAiBuozs7wcYWAKm3sduvtIB/JFG/X+pXXYtp0xpgoiDlOCqRAwju//////////8BEAAaDDEzMDc5OTQ1NTU1NCIMvkY3QEnvf+RKgKPVKuUCg0wnp6V94yC5dANC4xvceMpWGjvZiCmZABHf/Je25S/Dr9kf24uwYmMHgSr5oY2kby7PDLhxWqPahByTBMIWlCBKGhC1GxZEj1oT0SwSOwfhY1w/YSw3doUDLO0sayRDMRtrqZ+sXiaqftYM8uaQqelLNP2RE2SawtKQT7h2emLRuqR/fCFoujoUwOXVHCd3YO4mbv4NmGoTqd4e2vCTjLhzXH7ddNDqHebqUF22QzoZ6jEk8e3uyNC+/TwXjp8EkmbGbsQ0vYJYc/q6YNb7vFno/LT729Eta/FNENr04dmGTjIyZg3uSKjGfaKdCUFsGwZlfVuHXxvwA5id+9/XBGSAwnSpZwVBq2GHDR5ck6BTgwft7kxjmezUeDq25xNs4mQtcOEsUrRaLhGvmLC05nuCj0P4eTVe96b54A6LZvdiYaw94LogkhfAjrqogKPxUrQEZwpNW9rj5O9DrzEQeuyy8kj4MPmhnMUGOqcBMI34gYqq2JtN0PsRJsbWuv3+QADcQjkRxs+T6XeDnFRfOQF4HPdwVKDbJQP2z7h5+/biyGOPVIInj0/q7OdOpCX7msCa+OYNFSPwinInizPfkIQLIHvUkimGVqypAPZT2W7mQAtl1hpNV2Zcq5APEw1a/MeWH2JUSPzVwGR1e0tC2Em1nt+Mgk0Pn6+FH6eFQKy5wK9BAylMrKPncqHQRVtHpceMths=';
  process.env.AWS_BEDROCK_REGION = 'us-east-1';
  process.env.BEDROCK_MODEL_ID = 'anthropic.claude-3-5-sonnet-20240620-v1:0';
  
  console.log('Environment variables set:');
  console.log(`  - AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID.substring(0, 10)}...`);
  console.log(`  - AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY.substring(0, 10)}...`);
  console.log(`  - AWS_SESSION_TOKEN: ${process.env.AWS_SESSION_TOKEN.substring(0, 50)}...`);
  console.log(`  - AWS_BEDROCK_REGION: ${process.env.AWS_BEDROCK_REGION}`);
  console.log(`  - BEDROCK_MODEL_ID: ${process.env.BEDROCK_MODEL_ID}`);
  console.log('');
  
  try {
    // Create BedrockAccessor instance
    const bedrock = new BedrockAccessor();
    
    // Test message
    const messages = [
      {
        role: 'user',
        content: 'Hello, this is a test message. Please respond with a simple greeting.'
      }
    ];
    
    console.log('\n📨 Sending test message to Bedrock...');
    const response = await bedrock.generateChatResponse(messages);
    
    console.log('\n✅ SUCCESS! Response from Bedrock:');
    console.log('========================================');
    console.log(response.message);
    console.log('========================================');
    console.log('\nUsage:', response.usage);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testBedrock().then(() => {
  console.log('\n✅ Test completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});

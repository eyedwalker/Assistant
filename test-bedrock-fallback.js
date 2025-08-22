/**
 * Test script for AWS Bedrock fallback functionality
 * Uses MongoDB for content and AWS Bedrock for AI processing
 */

// Import required modules
require('dotenv').config();
const { MongoClient } = require('mongodb');
const process = require('process');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { setTimeout } = require('timers/promises');

// Set NODE_TLS_REJECT_UNAUTHORIZED to 0 for testing
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Use existing environment credentials - don't override them
console.log('🔍 Starting AWS Bedrock fallback test with environment credentials...');

// Check if we have AWS credentials
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error('❌ AWS credentials are not set');
  console.error('🛑 Cannot proceed without AWS credentials');
  process.exit(1);
}

// Configuration
const config = {
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-assistant',
    collection: 'documents'
  },
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0'
  },
  test: {
    userId: 'test-user-bedrock',
    query: 'What are the key features of the AI Assistant platform?'
  }
};

// Check MongoDB configuration
if (!config.mongodb.uri) {
  console.error('❌ MONGODB_URI environment variable is not set');
  console.log('🔧 Using default connection string: mongodb://localhost:27017/ai-assistant');
}

// Check AWS configuration
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error('❌ AWS credentials are not set');
  console.log('🛑 Cannot proceed without AWS credentials');
  process.exit(1);
}

// Initialize clients
const bedrockClient = new BedrockRuntimeClient({ 
  region: config.aws.region,
  // Force HTTP/1.1 to avoid HTTP/2 stream cancellation errors
  requestHandler: {
    httpOptions: {
      alpnProtocol: 'http/1.1'
    }
  }
});

// Test MongoDB connection with Bedrock fallback
async function testBedrockFallback() {
  let mongoClient;
  
  try {
    console.log('🔄 Connecting to MongoDB...');
    mongoClient = new MongoClient(config.mongodb.uri);
    await mongoClient.connect();
    
    const db = mongoClient.db();
    const collection = db.collection(config.mongodb.collection);
    
    // Create test user if not exists
    const usersCollection = db.collection('users');
    const existingUser = await usersCollection.findOne({ userId: config.test.userId });
    
    if (!existingUser) {
      console.log('👤 Creating test user...');
      await usersCollection.insertOne({
        userId: config.test.userId,
        name: 'Test Bedrock User',
        email: 'test-bedrock@example.com',
        role: 'user',
        accessLevel: 'PUBLIC',
        createdAt: new Date()
      });
    }
    
    // Perform document search
    console.log('🔎 Performing document search...');
    const documents = await collection.find({}).limit(3).toArray();
    
    // Format documents for context
    const context = documents.map(doc => ({
      title: doc.title || 'Untitled Document',
      content: doc.content || doc.extractedText || 'No content available',
      source: doc.source || doc.url || 'unknown'
    }));
    
    console.log(`📄 Found ${context.length} documents for context`);
    
    // Generate AI response with AWS Bedrock
    console.log('🤖 Generating AI response with AWS Bedrock...');
    
    const contextPrefix = context.length > 0 
      ? "Based on the following information:\n\n" + 
        context.map(item => `### ${item.title}\n${item.content.substring(0, 300)}...\n`).join('\n\n')
      : "Answer based on your general knowledge:";
    
    const prompt = `${contextPrefix}\n\nUser question: ${config.test.query}\n\nProvide a helpful response:`;
    
    // Format the request based on Claude model requirements
    const input = {
      modelId: config.aws.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1000,
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      })
    };
    
    const command = new InvokeModelCommand(input);
    const response = await bedrockClient.send(command);
    
    // Parse the response
    const responseBody = JSON.parse(Buffer.from(response.body).toString());
    const aiResponse = responseBody.content?.[0]?.text || 
                      responseBody.completion || 
                      'No response received';
    
    // Output results
    console.log('\n✅ TEST RESULTS\n==============');
    console.log(`📝 User query: ${config.test.query}`);
    console.log(`📚 Documents found: ${context.length}`);
    console.log(`\n🤖 AI RESPONSE:\n${aiResponse}\n`);
    console.log('✅ Bedrock fallback test completed successfully');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.Code) console.error('AWS Error Code:', error.Code);
    if (error.$metadata) console.error('AWS Metadata:', error.$metadata);
  } finally {
    if (mongoClient) {
      await mongoClient.close();
      console.log('📊 MongoDB connection closed');
    }
  }
}

// Run the test
testBedrockFallback().catch(error => {
  console.error('❌ Test failed:', error);
});

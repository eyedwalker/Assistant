/**
 * Test script for local fallback functionality in hybrid AWS/local setup
 * This script demonstrates MongoDB + Anthropic fallback when AWS services are unavailable
 */

// Import required modules
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');
const Anthropic = require('@anthropic-ai/sdk');

// Load environment variables
dotenv.config();
console.log('🔍 Starting local fallback test...');

// Configuration
const config = {
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-assistant',
    collection: 'documents'
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-3-sonnet-20240229-v1'
  },
  test: {
    userId: 'test-user-local',
    query: 'What are the key features of the AI Assistant platform?'
  }
};

// Check MongoDB configuration
if (!config.mongodb.uri) {
  console.error('❌ MONGODB_URI environment variable is not set');
  console.log('🔧 Using default connection string: mongodb://localhost:27017/ai-assistant');
}

// Check Anthropic configuration
if (!config.anthropic.apiKey) {
  console.error('❌ ANTHROPIC_API_KEY environment variable is not set');
  console.log('🛑 Cannot proceed without Anthropic API key');
  process.exit(1);
}

// Initialize clients
const anthropicClient = new Anthropic({
  apiKey: config.anthropic.apiKey,
});

// Test MongoDB connection and fallback
async function testMongoDBFallback() {
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
        name: 'Test Local User',
        email: 'test-local@example.com',
        role: 'user',
        accessLevel: 'PUBLIC',
        createdAt: new Date()
      });
    }
    
    // Perform vector search simulation
    console.log('🔎 Performing document search...');
    const documents = await collection.find({}).limit(3).toArray();
    
    // Format documents for context
    const context = documents.map(doc => ({
      title: doc.title || 'Untitled Document',
      content: doc.content || doc.extractedText || 'No content available',
      source: doc.source || doc.url || 'unknown'
    }));
    
    console.log(`📄 Found ${context.length} documents for context`);
    
    // Generate AI response with Anthropic
    console.log('🤖 Generating AI response...');
    
    const contextPrefix = context.length > 0 
      ? "Based on the following information:\n\n" + 
        context.map(item => `### ${item.title}\n${item.content.substring(0, 300)}...\n`).join('\n\n')
      : "Answer based on your general knowledge:";
    
    const prompt = `${contextPrefix}\n\nUser question: ${config.test.query}\n\nProvide a helpful response:`;
    
    const response = await anthropicClient.messages.create({
      model: config.anthropic.model,
      max_tokens: 1000,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    });
    
    // Output results
    console.log('\n✅ TEST RESULTS\n==============');
    console.log(`📝 User query: ${config.test.query}`);
    console.log(`📚 Documents found: ${context.length}`);
    console.log(`\n🤖 AI RESPONSE:\n${response.content[0].text}\n`);
    console.log('✅ Local fallback test completed successfully');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (mongoClient) {
      await mongoClient.close();
      console.log('📊 MongoDB connection closed');
    }
  }
}

// Run the test
testMongoDBFallback().catch(error => {
  console.error('❌ Test failed:', error);
});

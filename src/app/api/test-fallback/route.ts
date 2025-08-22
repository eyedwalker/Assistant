/**
 * Test API endpoint for MongoDB fallback when AWS is unavailable
 */

import { NextRequest, NextResponse } from 'next/server';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import { MongoVectorAccessor } from '@/lib/accessors/MongoVectorAccessor';
import { AnthropicAccessor } from '@/lib/accessors/AnthropicAccessor';
import { connectToDatabase } from '@/lib/services/mongodb-connection';
import { setTimeout } from 'timers/promises';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Testing MongoDB fallback...');
    
    // Parse request
    const body = await request.json();
    const { message, userId } = body;
    
    if (!message || !userId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: message and userId'
      }, { status: 400 });
    }
    
    // Check MongoDB connection string
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI environment variable not set');
      return NextResponse.json({
        success: false,
        error: 'MongoDB connection not configured',
        details: 'MONGODB_URI environment variable is not set',
        troubleshooting: [
          'Set MONGODB_URI in your .env file',
          'Format should be: mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority',
          'Ensure .env is properly loaded'
        ]
      }, { status: 500 });
    }
    
    // Connect to MongoDB
    let db;
    try {
      console.log('🔄 Connecting to MongoDB...');
      const connection = await connectToDatabase();
      db = connection.db;
      
      if (!db) {
        throw new Error('Database connection returned undefined');
      }
      
      console.log('✅ Connected to MongoDB');
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error);
      return NextResponse.json({
        success: false,
        error: 'MongoDB connection failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        troubleshooting: [
          'Check MONGODB_URI format in your .env file',
          'Ensure MongoDB Atlas (or your MongoDB server) is accessible from your network',
          'Check if MongoDB user has correct permissions',
          'Verify IP whitelist in MongoDB Atlas'
        ]
      }, { status: 500 });
    }
    
    // Initialize accessors
    const mongoAccessor = new MongoDBAccessor();
    const vectorAccessor = new MongoVectorAccessor();
    const anthropicAccessor = new AnthropicAccessor();
    
    // Initialize MongoDB vector search
    try {
      await vectorAccessor.connect();
      console.log('✅ Connected to MongoDB Vector Search');
    } catch (error) {
      console.error('❌ Vector search connection failed:', error);
      return NextResponse.json({
        success: false,
        error: 'Vector search connection failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
    
    // Find or create test user
    let user;
    try {
      // Initialize MongoDB accessor
      await mongoAccessor.connect();
      
      const users = await mongoAccessor.find('users', { userId });
      if (users && users.length > 0) {
        user = users[0];
      } else {
        // Create test user if not found
        user = {
          userId,
          name: 'Test Fallback User',
          email: 'test@example.com',
          role: 'user',
          accessLevel: 'PUBLIC',
          createdAt: new Date()
        };
        await mongoAccessor.create('users', user);
      }
      console.log('✅ User found or created:', userId);
    } catch (error) {
      console.error('❌ User operation failed:', error);
      return NextResponse.json({
        success: false,
        error: 'User operation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        troubleshooting: [
          'Ensure MongoDB connection is working',
          'Check if mongoAccessor.connect() is properly initialized',
          'Verify the collection "users" exists in your database'
        ]
      }, { status: 500 });
    }
    
    // Perform vector search for relevant content
    let relevantContent = [];
    try {
      // Perform vector search using MongoDB
      const vectorQuery = message;
      const searchResults = await vectorAccessor.search(vectorQuery, { limit: 5 });
      
      if (searchResults && searchResults.length > 0) {
        relevantContent = searchResults.map(result => ({
          title: result.title || 'Untitled Document',
          content: result.content,
          similarity: result.score,
          source: result.source || 'unknown'
        }));
      }
      console.log(`✅ Retrieved ${relevantContent.length} relevant content items`);
    } catch (error) {
      console.error('❌ Vector search failed:', error);
      // Continue without relevant content - not fatal
    }
    
    // Generate AI response using Anthropic
    try {
      // Build prompt with relevant content
      const contextPrefix = relevantContent.length > 0 
        ? "Based on the following information:\n\n" + 
          relevantContent.map(item => `### ${item.title}\n${item.content}\n`).join('\n\n')
        : "Answer based on your general knowledge:";
      
      const prompt = `${contextPrefix}\n\nUser question: ${message}\n\nProvide a helpful response:`;
      
      // Generate response
      // Check if Anthropic API key is configured
      if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json({
          success: false,
          error: 'Anthropic API key not configured',
          details: 'ANTHROPIC_API_KEY environment variable is not set',
          troubleshooting: [
            'Set ANTHROPIC_API_KEY in your .env file',
            'Obtain an API key from https://console.anthropic.com/'
          ]
        }, { status: 500 });
      }
      
      const response = await anthropicAccessor.generateChatResponse(prompt, '', 'claude');
      
      if (!response || !response.message) {
        throw new Error('Failed to generate AI response');
      }
      
      console.log('✅ Generated AI response successfully');
      
      return NextResponse.json({
        success: true,
        message: response.message,
        sources: relevantContent,
        mode: 'mongodb-fallback'
      });
      
    } catch (error) {
      console.error('❌ AI response generation failed:', error);
      return NextResponse.json({
        success: false,
        error: 'AI response generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('❌ Test fallback failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Test fallback failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

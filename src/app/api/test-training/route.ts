import { NextRequest, NextResponse } from 'next/server';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing MongoDB connection for training system...');
    
    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI || 'mongodb://localhost:27017',
      process.env.MONGODB_DB || 'ai-assistant'
    );
    
    console.log('✅ MongoDBAccessor created successfully');
    
    // Test connection
    await mongoAccessor.connect();
    console.log('✅ MongoDB connected successfully');
    
    // Test find operation
    const contents = await mongoAccessor.find('contents', {
      tenantId: 'demo-tenant'
    });
    
    console.log(`📚 Found ${contents.length} content documents`);
    
    await mongoAccessor.disconnect();
    console.log('✅ MongoDB disconnected successfully');
    
    return NextResponse.json({
      success: true,
      message: 'MongoDB connection test successful',
      contentCount: contents.length
    });
    
  } catch (error) {
    console.error('❌ MongoDB test failed:', error);
    return NextResponse.json({
      success: false,
      error: 'MongoDB test failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

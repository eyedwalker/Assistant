/**
 * System Status API - Shows AWS and local service availability
 */

import { NextRequest, NextResponse } from 'next/server';
import { AWSBridgeAccessor } from '@/lib/accessors/AWSBridgeAccessor';
import { MongoVectorAccessor } from '@/lib/accessors/MongoVectorAccessor';
import { connectToDatabase } from '@/lib/services/mongodb-connection';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking system status...');
    
    // Initialize AWS Bridge Accessor
    const awsBridge = new AWSBridgeAccessor();
    
    // Check AWS services
    const awsStatus = await awsBridge.getSystemStatus();
    
    // Check MongoDB connection
    let mongoStatus = false;
    try {
      const { db } = await connectToDatabase();
      mongoStatus = !!db;
    } catch (error) {
      console.error('MongoDB connection failed:', error);
    }
    
    // Check Vector Search (MongoDB fallback)
    let vectorSearchStatus = false;
    try {
      const vectorAccessor = new MongoVectorAccessor();
      await vectorAccessor.connect();
      vectorSearchStatus = true;
    } catch (error) {
      console.error('Vector search connection failed:', error);
    }
    
    // Environment configuration status
    const envConfig = {
      hasAwsCredentials: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
      hasAwsEndpoints: !!(process.env.AWS_S3_BUCKET && process.env.AWS_OPENSEARCH_ENDPOINT),
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      hasBedrockEnabled: process.env.USE_BEDROCK === 'true',
      hasMongoUri: !!process.env.MONGODB_URI
    };
    
    const systemStatus = {
      timestamp: new Date().toISOString(),
      mode: awsStatus.mode,
      services: {
        aws: {
          available: awsStatus.aws,
          openSearch: awsStatus.openSearch,
          bedrock: awsStatus.bedrock,
          s3: envConfig.hasAwsCredentials && envConfig.hasAwsEndpoints
        },
        local: {
          mongodb: mongoStatus,
          vectorSearch: vectorSearchStatus,
          anthropic: envConfig.hasAnthropicKey
        }
      },
      configuration: envConfig,
      recommendations: []
    };
    
    // Add recommendations based on status
    if (!awsStatus.aws && !mongoStatus) {
      systemStatus.recommendations.push('No database connection available. Check MongoDB URI or AWS credentials.');
    }
    
    if (!awsStatus.aws && mongoStatus) {
      systemStatus.recommendations.push('Using MongoDB fallback. Consider deploying AWS infrastructure for enhanced performance.');
    }
    
    if (awsStatus.aws && !awsStatus.openSearch) {
      systemStatus.recommendations.push('AWS available but OpenSearch unhealthy. Check OpenSearch domain status.');
    }
    
    if (!envConfig.hasAnthropicKey && !awsStatus.bedrock) {
      systemStatus.recommendations.push('No AI service available. Configure Anthropic API key or AWS Bedrock.');
    }
    
    console.log('✅ System status check complete');
    
    return NextResponse.json({
      success: true,
      status: systemStatus
    });
    
  } catch (error) {
    console.error('❌ System status check failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: {
        timestamp: new Date().toISOString(),
        mode: 'error',
        services: {
          aws: { available: false, openSearch: false, bedrock: false, s3: false },
          local: { mongodb: false, vectorSearch: false, anthropic: false }
        },
        configuration: {
          hasAwsCredentials: false,
          hasAwsEndpoints: false,
          hasAnthropicKey: false,
          hasBedrockEnabled: false,
          hasMongoUri: false
        },
        recommendations: ['System health check failed. Check logs for details.']
      }
    }, { status: 500 });
  }
}

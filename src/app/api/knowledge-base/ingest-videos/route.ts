/**
 * API Route: Trigger Knowledge Base Ingestion
 * 
 * POST /api/knowledge-base/ingest-videos
 * Triggers AWS Bedrock Knowledge Base to ingest newly processed videos
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  BedrockAgentClient, 
  StartIngestionJobCommand,
  GetIngestionJobCommand,
  ListIngestionJobsCommand
} from '@aws-sdk/client-bedrock-agent';

export async function POST(request: NextRequest) {
  try {
    const knowledgeBaseId = process.env.AWS_KNOWLEDGE_BASE_ID;
    const dataSourceId = process.env.AWS_KNOWLEDGE_BASE_DATA_SOURCE_ID;
    const region = process.env.AWS_REGION || 'us-west-2';

    if (!knowledgeBaseId || !dataSourceId) {
      return NextResponse.json({
        success: false,
        error: 'AWS_KNOWLEDGE_BASE_ID and AWS_KNOWLEDGE_BASE_DATA_SOURCE_ID must be configured'
      }, { status: 500 });
    }

    console.log(`🧠 Triggering Knowledge Base ingestion...`);
    console.log(`📊 Knowledge Base ID: ${knowledgeBaseId}`);
    console.log(`📁 Data Source ID: ${dataSourceId}`);

    // Initialize Bedrock Agent client
    const bedrockClient = new BedrockAgentClient({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN })
      }
    });

    // Start ingestion job
    const startCommand = new StartIngestionJobCommand({
      knowledgeBaseId,
      dataSourceId,
      description: `Video processing ingestion - ${new Date().toISOString()}`
    });

    const ingestionResult = await bedrockClient.send(startCommand);
    
    if (!ingestionResult.ingestionJob) {
      throw new Error('Failed to start ingestion job');
    }

    const jobId = ingestionResult.ingestionJob.ingestionJobId;
    console.log(`✅ Ingestion job started: ${jobId}`);

    return NextResponse.json({
      success: true,
      message: 'Knowledge Base ingestion started successfully',
      data: {
        jobId,
        knowledgeBaseId,
        dataSourceId,
        status: ingestionResult.ingestionJob.status,
        startedAt: ingestionResult.ingestionJob.startedAt,
        description: ingestionResult.ingestionJob.description
      },
      nextSteps: [
        'Ingestion job is now running',
        'Use GET /api/knowledge-base/ingest-videos/{jobId} to check status',
        'Videos will be available for queries after ingestion completes'
      ]
    });

  } catch (error) {
    console.error('Knowledge Base ingestion error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const knowledgeBaseId = process.env.AWS_KNOWLEDGE_BASE_ID;
    const dataSourceId = process.env.AWS_KNOWLEDGE_BASE_DATA_SOURCE_ID;
    const region = process.env.AWS_REGION || 'us-west-2';

    if (!knowledgeBaseId || !dataSourceId) {
      return NextResponse.json({
        success: false,
        error: 'AWS_KNOWLEDGE_BASE_ID and AWS_KNOWLEDGE_BASE_DATA_SOURCE_ID must be configured'
      }, { status: 500 });
    }

    // Get URL search params for job ID
    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');

    const bedrockClient = new BedrockAgentClient({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN })
      }
    });

    if (jobId) {
      // Get specific job status
      const getCommand = new GetIngestionJobCommand({
        knowledgeBaseId,
        dataSourceId,
        ingestionJobId: jobId
      });

      const jobResult = await bedrockClient.send(getCommand);
      
      return NextResponse.json({
        success: true,
        data: {
          jobId,
          status: jobResult.ingestionJob?.status,
          startedAt: jobResult.ingestionJob?.startedAt,
          updatedAt: jobResult.ingestionJob?.updatedAt,
          statistics: jobResult.ingestionJob?.statistics,
          failureReasons: jobResult.ingestionJob?.failureReasons
        }
      });
    } else {
      // List recent ingestion jobs
      const listCommand = new ListIngestionJobsCommand({
        knowledgeBaseId,
        dataSourceId,
        maxResults: 10
      });

      const listResult = await bedrockClient.send(listCommand);
      
      return NextResponse.json({
        success: true,
        message: 'Recent ingestion jobs',
        data: {
          jobs: listResult.ingestionJobSummaries?.map(job => ({
            jobId: job.ingestionJobId,
            status: job.status,
            startedAt: job.startedAt,
            updatedAt: job.updatedAt,
            description: job.description
          })) || []
        }
      });
    }

  } catch (error) {
    console.error('Knowledge Base status error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

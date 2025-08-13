import { NextRequest, NextResponse } from 'next/server';
import { DocumentManager } from '@/lib/managers/DocumentManager';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import { S3Accessor } from '@/lib/accessors/S3Accessor';
import { AnthropicAccessor } from '@/lib/accessors/AnthropicAccessor';
import { z } from 'zod';

// Initialize VBD components
const mongoAccessor = new MongoDBAccessor(
  process.env.MONGODB_URI!,
  process.env.MONGODB_DB_NAME || 'ai-assistant-platform'
);
const s3Accessor = new S3Accessor(
  process.env.AWS_S3_BUCKET_NAME || 'ai-assistant-platform-documents-dev',
  process.env.AWS_REGION || 'us-east-1'
);
const anthropicAccessor = new AnthropicAccessor();
const documentManager = new DocumentManager(mongoAccessor, s3Accessor, anthropicAccessor);

// Initialize MongoDB connection
let isConnected = false;
async function ensureConnection() {
  if (!isConnected) {
    await mongoAccessor.connect();
    isConnected = true;
  }
}

// Simplified request validation schema for demo
const processUrlSchema = z.object({
  url: z.string().url(),
  userId: z.string().optional(),
  tenantId: z.string().optional(),
  accessLevel: z.enum(['PUBLIC', 'ACCOUNT', 'COMPANY', 'OFFICE']).optional()
});

export async function POST(request: NextRequest) {
  try {
    await ensureConnection();
    
    // Parse and validate request body
    const body = await request.json();
    const validationResult = processUrlSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { url, userId, tenantId, accessLevel } = validationResult.data;

    // Use default values for demo purposes
    const documentRequest = {
      url,
      userId: userId || 'demo-user-001',
      tenantId: tenantId || 'demo-tenant-001',
      accessLevel: accessLevel || 'ACCOUNT' as const,
      metadata: {
        source: 'dashboard-url-processing',
        title: `Document from ${new URL(url).hostname}`,
        tags: ['url-processed', 'dashboard']
      }
    };

    // Process document using VBD DocumentManager
    const result = await documentManager.processDocument(documentRequest);

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      status: result.status,
      progress: result.progress,
      message: 'Document processing started successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('VBD Document processing error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to process document';
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
// Validate user access to the specified access level and ID
function validateUserAccess(
  user: any,
  accessLevel: AccessLevel,
  accessId: string
): boolean {
  // Admin users can access everything
  if (user.role === 'admin') {
    return true;
  }

  // Public access is allowed for everyone
  if (accessLevel === AccessLevel.PUBLIC) {
    return true;
  }

  // Check if user has access to this specific resource
  return user.accessLevel === accessLevel && user.accessId === accessId;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const accessLevel = searchParams.get('accessLevel') as AccessLevel;

    // Build filters
    const filters: any = {};
    if (status) {
      filters.status = status;
    }

    // Get documents with access control
    const { documents, total } = await mongoService.getDocuments(
      user.accessLevel,
      user.accessId,
      filters,
      page,
      limit
    );

    return NextResponse.json({
      success: true,
      data: documents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Get documents API error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

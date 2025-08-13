import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import documentProcessor from '@/lib/services/document-processor';
import { AccessLevel, ProcessingOptions } from '@/types';
import { z } from 'zod';

// Maximum file size (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Supported file types
const SUPPORTED_MIME_TYPES = [
  'text/plain',
  'text/html',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/markdown',
  'application/json'
];

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const optionsStr = formData.get('options') as string;

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No files provided' },
        { status: 400 }
      );
    }

    // Parse processing options
    let options: ProcessingOptions;
    try {
      options = JSON.parse(optionsStr || '{}');
      
      // Set defaults
      options = {
        enableJavaScript: false,
        crawlDepth: 1,
        enableScreenshots: false,
        enableAIAnalysis: true,
        enableContentMonitoring: false,
        accessLevel: options.accessLevel || session.user.accessLevel,
        accessId: options.accessId || session.user.accessId,
        ...options
      };
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid options format' },
        { status: 400 }
      );
    }

    // Validate access permissions
    if (!validateUserAccess(session.user, options.accessLevel, options.accessId)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Validate files
    const validationErrors: string[] = [];
    const processedFiles: Array<{ buffer: Buffer; originalName: string; mimetype: string }> = [];

    for (const file of files) {
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        validationErrors.push(`File ${file.name} exceeds maximum size of 50MB`);
        continue;
      }

      // Check file type
      if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
        validationErrors.push(`File ${file.name} has unsupported type: ${file.type}`);
        continue;
      }

      // Convert to buffer
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        processedFiles.push({
          buffer,
          originalName: file.name,
          mimetype: file.type
        });
      } catch (error) {
        validationErrors.push(`Failed to process file ${file.name}`);
      }
    }

    if (processedFiles.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No valid files to process',
          details: validationErrors
        },
        { status: 400 }
      );
    }

    // Process files
    const results = await documentProcessor.processFiles(
      processedFiles,
      options,
      session.user.id
    );

    // Return results
    return NextResponse.json({
      success: true,
      data: {
        results,
        totalProcessed: results.length,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length,
        validationErrors: validationErrors.length > 0 ? validationErrors : undefined
      },
      timestamp: new Date()
    });

  } catch (error) {
    console.error('File upload API error:', error);
    
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

// Get upload status and limits
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        maxFileSize: MAX_FILE_SIZE,
        maxFileSizeMB: Math.floor(MAX_FILE_SIZE / (1024 * 1024)),
        supportedTypes: SUPPORTED_MIME_TYPES,
        maxConcurrentUploads: 10,
        userLimits: {
          accessLevel: session.user.accessLevel,
          accessId: session.user.accessId,
          canUpload: true // Could be based on user permissions
        }
      }
    });

  } catch (error) {
    console.error('Get upload info API error:', error);
    
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

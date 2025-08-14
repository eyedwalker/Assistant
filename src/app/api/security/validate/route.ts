/**
 * Security Validation API - HIPAA Compliance Endpoint
 * 
 * Provides dedicated security validation for content uploads and processing
 * Ensures PII/PHI protection and healthcare data compliance
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SecurityManager } from '@/lib/managers/SecurityManager';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';

// Request validation schema
const securityValidationSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  contentType: z.enum(['document', 'video', 'web', 'image', 'audio', 'text']).optional().default('text'),
  userId: z.string().optional().default('demo-user'),
  tenantId: z.string().optional().default('demo-tenant'),
  accessLevel: z.enum(['PUBLIC', 'ACCOUNT', 'COMPANY', 'OFFICE']).optional().default('COMPANY'),
  source: z.enum(['upload', 'url', 'api', 'chat']).optional().default('api'),
  metadata: z.object({
    filename: z.string().optional(),
    url: z.string().optional(),
    size: z.number().optional(),
    mimeType: z.string().optional()
  }).optional(),
  options: z.object({
    blockOnViolation: z.boolean().optional().default(true),
    sanitizeContent: z.boolean().optional().default(false),
    riskThreshold: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('MEDIUM'),
    enablePHIDetection: z.boolean().optional().default(true),
    enablePIIDetection: z.boolean().optional().default(true)
  }).optional().default({})
});

// Initialize services
const mongoAccessor = new MongoDBAccessor();
const securityManager = new SecurityManager(mongoAccessor);

// Initialize MongoDB connection
mongoAccessor.connect().catch(console.error);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = securityValidationSchema.parse(body);
    
    const {
      content,
      contentType,
      userId,
      tenantId,
      accessLevel,
      source,
      metadata,
      options
    } = validatedData;

    console.log(`[SECURITY API] Validating content for user: ${userId}, type: ${contentType}, access: ${accessLevel}`);

    // Perform comprehensive security validation
    const securityResult = await securityManager.validateContent({
      content,
      contentType,
      userId,
      tenantId,
      accessLevel,
      source,
      metadata
    });

    // Return detailed security analysis
    return NextResponse.json({
      success: true,
      validation: {
        allowed: securityResult.allowed,
        complianceStatus: securityResult.complianceStatus,
        auditId: securityResult.auditId,
        blockReason: securityResult.blockReason,
        sanitizedContent: securityResult.sanitizedContent
      },
      scanResult: {
        isSecure: securityResult.scanResult.isSecure,
        riskLevel: securityResult.scanResult.riskLevel,
        violationCount: securityResult.scanResult.violations.length,
        violations: securityResult.scanResult.violations.map(v => ({
          type: v.type,
          category: v.category,
          description: v.description,
          severity: v.severity,
          confidence: v.confidence,
          location: {
            start: v.location.start,
            end: v.location.end,
            context: v.location.context.substring(0, 100) // Limit context for response size
          }
        }))
      },
      compliance: {
        hipaaCompliant: securityResult.complianceStatus === 'COMPLIANT',
        requiresReview: securityResult.complianceStatus === 'REQUIRES_REVIEW',
        accessLevelApproved: securityResult.allowed,
        auditTrail: securityResult.auditId
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Security validation error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request format',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Security validation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || 'demo-tenant';
    const userId = searchParams.get('userId');
    const days = parseInt(searchParams.get('days') || '30');
    const riskLevel = searchParams.get('riskLevel');

    console.log(`[SECURITY API] Getting audit logs for tenant: ${tenantId}`);

    // Get audit logs for compliance reporting
    const auditLogs = await mongoAccessor.findAuditLogs(tenantId, {
      userId: userId || undefined,
      riskLevel: riskLevel || undefined,
      startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    });

    // Get security statistics
    const securityStats = await mongoAccessor.getSecurityStats(tenantId, days);

    return NextResponse.json({
      success: true,
      auditLogs: auditLogs.map(log => ({
        id: log._id,
        timestamp: log.createdAt,
        userId: log.userId,
        action: log.action,
        result: log.result,
        riskLevel: log.riskLevel,
        violationCount: log.violationCount || 0,
        contentType: log.contentType,
        source: log.source,
        accessLevel: log.accessLevel
      })),
      statistics: {
        totalScans: securityStats.reduce((sum: number, stat: any) => sum + stat.count, 0),
        blockedContent: securityStats.filter((stat: any) => stat._id.result === 'BLOCKED').reduce((sum: number, stat: any) => sum + stat.count, 0),
        allowedContent: securityStats.filter((stat: any) => stat._id.result === 'ALLOWED').reduce((sum: number, stat: any) => sum + stat.count, 0),
        riskDistribution: securityStats.reduce((acc: any, stat: any) => {
          acc[stat._id.riskLevel] = (acc[stat._id.riskLevel] || 0) + stat.count;
          return acc;
        }, {}),
        averageViolations: securityStats.reduce((sum: number, stat: any) => sum + (stat.avgViolations || 0), 0) / Math.max(securityStats.length, 1)
      },
      compliance: {
        period: `${days} days`,
        hipaaCompliant: securityStats.filter((stat: any) => stat._id.result === 'BLOCKED' && stat._id.riskLevel === 'CRITICAL').length === 0,
        lastAudit: auditLogs.length > 0 ? auditLogs[0].createdAt : null
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Security audit retrieval error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve security audit data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

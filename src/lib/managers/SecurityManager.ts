/**
 * SecurityManager - VBD Manager Layer
 * 
 * Business rules orchestration for security scanning, HIPAA compliance, and audit logging
 * Coordinates between SecurityEngine and data accessors with healthcare-specific logic
 */

import { SecurityEngine, SecurityScanResult, SecurityConfig, SecurityViolation } from '../engines/SecurityEngine';
import { MongoDBAccessor } from '../accessors/MongoDBAccessor';

export interface SecurityRequest {
  content: string;
  contentType: 'document' | 'video' | 'audio' | 'web' | 'image' | 'text';
  userId: string;
  tenantId: string;
  accessLevel: 'PUBLIC' | 'ACCOUNT' | 'COMPANY' | 'OFFICE';
  source: 'upload' | 'url' | 'api' | 'chat';
  metadata?: {
    filename?: string;
    url?: string;
    size?: number;
    mimeType?: string;
  };
}

export interface SecurityResponse {
  allowed: boolean;
  scanResult: SecurityScanResult;
  sanitizedContent?: string;
  blockReason?: string;
  complianceStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'REQUIRES_REVIEW';
  auditId: string;
}

export interface ComplianceProfile {
  name: string;
  description: string;
  config: SecurityConfig;
  applicableAccessLevels: string[];
  requiredForHIPAA: boolean;
}

export class SecurityManager {
  private readonly securityEngine: SecurityEngine;
  private readonly mongoAccessor: MongoDBAccessor;
  private readonly complianceProfiles: Map<string, ComplianceProfile>;

  constructor(mongoAccessor: MongoDBAccessor) {
    this.securityEngine = new SecurityEngine();
    this.mongoAccessor = mongoAccessor;
    this.complianceProfiles = this.initializeComplianceProfiles();
  }

  /**
   * Business rule: Comprehensive security validation for content
   */
  async validateContent(request: SecurityRequest): Promise<SecurityResponse> {
    try {
      // Business rule: Select appropriate compliance profile
      const profile = this.selectComplianceProfile(request);
      
      // Business rule: Apply access level specific security rules
      const config = this.applyAccessLevelRules(profile.config, request.accessLevel);
      
      // Perform security scan using engine
      const scanResult = await this.securityEngine.scanContent(
        request.content,
        config,
        request.userId
      );

      // Business rule: Determine if content is allowed based on eyecare compliance
      const allowed = this.isContentAllowed(scanResult, profile, request);
      
      // Business rule: Generate compliance status
      const complianceStatus = this.determineComplianceStatus(scanResult, profile);
      
      // Business rule: Create audit record
      const auditId = await this.createAuditRecord(request, scanResult, allowed);
      
      // Business rule: Handle blocking and sanitization
      let sanitizedContent: string | undefined;
      let blockReason: string | undefined;
      
      if (!allowed) {
        blockReason = this.generateBlockReason(scanResult.violations);
        
        // Business rule: Attempt sanitization for non-critical violations
        if (config.sanitizeContent && !this.hasCriticalViolations(scanResult.violations)) {
          sanitizedContent = scanResult.sanitizedContent;
        }
      }

      // Business rule: Log security event for compliance tracking
      await this.logSecurityEvent(request, scanResult, allowed, auditId);

      return {
        allowed,
        scanResult,
        sanitizedContent,
        blockReason,
        complianceStatus,
        auditId
      };

    } catch (error) {
      // Business rule: Fail secure - block on any security system error
      const auditId = await this.createErrorAuditRecord(request, error);
      
      return {
        allowed: false,
        scanResult: {
          isSecure: false,
          violations: [],
          riskLevel: 'CRITICAL',
          blockedContent: true,
          auditLog: []
        },
        blockReason: 'Security system error - content blocked for safety',
        complianceStatus: 'NON_COMPLIANT',
        auditId
      };
    }
  }

  /**
   * Business rule: Validate file uploads with additional checks
   */
  async validateFileUpload(
    fileContent: Buffer,
    filename: string,
    mimeType: string,
    userId: string,
    tenantId: string,
    accessLevel: string
  ): Promise<SecurityResponse> {
    // Convert buffer to string for text-based analysis
    const content = this.extractTextFromBuffer(fileContent, mimeType);
    
    const request: SecurityRequest = {
      content,
      contentType: this.mapMimeTypeToContentType(mimeType),
      userId,
      tenantId,
      accessLevel: accessLevel as any,
      source: 'upload',
      metadata: {
        filename,
        size: fileContent.length,
        mimeType
      }
    };

    // Business rule: Additional file-specific security checks
    const fileSecurityCheck = await this.performFileSecurityChecks(fileContent, filename, mimeType);
    
    if (!fileSecurityCheck.safe) {
      const auditId = await this.createAuditRecord(request, {
        isSecure: false,
        violations: fileSecurityCheck.violations,
        riskLevel: 'HIGH',
        blockedContent: true,
        auditLog: []
      }, false);

      return {
        allowed: false,
        scanResult: {
          isSecure: false,
          violations: fileSecurityCheck.violations,
          riskLevel: 'HIGH',
          blockedContent: true,
          auditLog: []
        },
        blockReason: fileSecurityCheck.reason,
        complianceStatus: 'NON_COMPLIANT',
        auditId
      };
    }

    return await this.validateContent(request);
  }

  /**
   * Business rule: Select appropriate compliance profile based on access level and content type
   */
  private selectComplianceProfile(request: SecurityRequest): ComplianceProfile {
    // Business rule: OFFICE and COMPANY levels require HIPAA compliance
    if (['OFFICE', 'COMPANY'].includes(request.accessLevel)) {
      return this.complianceProfiles.get('HIPAA_STRICT')!;
    }
    
    // Business rule: ACCOUNT level requires PII protection
    if (request.accessLevel === 'ACCOUNT') {
      return this.complianceProfiles.get('PII_PROTECTED')!;
    }
    
    // Business rule: PUBLIC level has basic security
    return this.complianceProfiles.get('BASIC_SECURITY')!;
  }

  /**
   * Business rule: Apply access level specific security configurations
   */
  private applyAccessLevelRules(baseConfig: SecurityConfig, accessLevel: string): SecurityConfig {
    const config = { ...baseConfig };
    
    switch (accessLevel) {
      case 'OFFICE':
        // Strictest security for office-level access
        config.enablePHIDetection = true;
        config.enablePIIDetection = true;
        config.blockOnViolation = true;
        config.riskThreshold = 'LOW';
        config.auditLogging = true;
        break;
        
      case 'COMPANY':
        // High security for company-level access
        config.enablePHIDetection = true;
        config.enablePIIDetection = true;
        config.blockOnViolation = true;
        config.riskThreshold = 'MEDIUM';
        config.auditLogging = true;
        break;
        
      case 'ACCOUNT':
        // Medium security for account-level access
        config.enablePIIDetection = true;
        config.blockOnViolation = true;
        config.riskThreshold = 'HIGH';
        config.auditLogging = true;
        break;
        
      case 'PUBLIC':
        // Basic security for public access
        config.enablePIIDetection = false;
        config.enablePHIDetection = false;
        config.blockOnViolation = false;
        config.riskThreshold = 'CRITICAL';
        config.auditLogging = false;
        break;
    }
    
    return config;
  }

  /**
   * Business rule: Determine if content is allowed based on compliance requirements
   */
  private isContentAllowed(
    scanResult: SecurityScanResult,
    profile: ComplianceProfile,
    request: SecurityRequest
  ): boolean {
    // Business rule: Always block critical violations for healthcare
    if (scanResult.riskLevel === 'CRITICAL') {
      return false;
    }
    
    // Business rule: Block PHI violations for HIPAA compliance
    const hasPhiViolations = scanResult.violations.some(v => v.type === 'PHI');
    if (hasPhiViolations && profile.requiredForHIPAA) {
      return false;
    }
    
    // Business rule: Apply profile-specific blocking rules
    return !scanResult.blockedContent;
  }

  /**
   * Business rule: Determine HIPAA compliance status
   */
  private determineComplianceStatus(
    scanResult: SecurityScanResult,
    profile: ComplianceProfile
  ): 'COMPLIANT' | 'NON_COMPLIANT' | 'REQUIRES_REVIEW' {
    if (scanResult.violations.length === 0) {
      return 'COMPLIANT';
    }
    
    const hasPhiViolations = scanResult.violations.some(v => v.type === 'PHI');
    const hasCriticalViolations = scanResult.violations.some(v => v.severity === 'CRITICAL');
    
    if (profile.requiredForHIPAA && (hasPhiViolations || hasCriticalViolations)) {
      return 'NON_COMPLIANT';
    }
    
    if (scanResult.riskLevel === 'HIGH' || scanResult.riskLevel === 'CRITICAL') {
      return 'REQUIRES_REVIEW';
    }
    
    return 'COMPLIANT';
  }

  /**
   * Create audit record for compliance tracking
   */
  private async createAuditRecord(
    request: SecurityRequest,
    scanResult: SecurityScanResult,
    allowed: boolean
  ): Promise<string> {
    const auditRecord = {
      timestamp: new Date(),
      userId: request.userId,
      tenantId: request.tenantId,
      action: 'SECURITY_SCAN',
      contentType: request.contentType,
      source: request.source,
      accessLevel: request.accessLevel,
      result: allowed ? 'ALLOWED' : 'BLOCKED',
      riskLevel: scanResult.riskLevel,
      violationCount: scanResult.violations.length,
      violations: scanResult.violations.map(v => ({
        type: v.type,
        category: v.category,
        severity: v.severity,
        confidence: v.confidence
      })),
      metadata: request.metadata || {},
      complianceRequired: ['OFFICE', 'COMPANY'].includes(request.accessLevel)
    };

    // Store audit record in MongoDB
    const result = await this.mongoAccessor.createAuditLog(auditRecord);
    return result.id || 'audit_' + Date.now();
  }

  /**
   * Create error audit record
   */
  private async createErrorAuditRecord(request: SecurityRequest, error: any): Promise<string> {
    const auditRecord = {
      timestamp: new Date(),
      userId: request.userId,
      tenantId: request.tenantId,
      action: 'SECURITY_ERROR',
      contentType: request.contentType,
      source: request.source,
      accessLevel: request.accessLevel,
      result: 'ERROR',
      riskLevel: 'CRITICAL',
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: request.metadata || {}
    };

    const result = await this.mongoAccessor.createAuditLog(auditRecord);
    return result.id || 'audit_error_' + Date.now();
  }

  /**
   * Log security event for monitoring
   */
  private async logSecurityEvent(
    request: SecurityRequest,
    scanResult: SecurityScanResult,
    allowed: boolean,
    auditId: string
  ): Promise<void> {
    // Business rule: Log all security events for healthcare compliance
    console.log(`[SECURITY] ${allowed ? 'ALLOWED' : 'BLOCKED'} - User: ${request.userId}, Risk: ${scanResult.riskLevel}, Violations: ${scanResult.violations.length}, Audit: ${auditId}`);
    
    // Business rule: Alert on high-risk content
    if (scanResult.riskLevel === 'CRITICAL' || scanResult.riskLevel === 'HIGH') {
      console.warn(`[SECURITY ALERT] High-risk content detected - Audit ID: ${auditId}`);
    }
  }

  /**
   * Generate human-readable block reason
   */
  private generateBlockReason(violations: SecurityViolation[]): string {
    if (violations.length === 0) {
      return 'Content blocked due to security policy';
    }
    
    const phiCount = violations.filter(v => v.type === 'PHI').length;
    const piiCount = violations.filter(v => v.type === 'PII').length;
    const financialCount = violations.filter(v => v.type === 'FINANCIAL').length;
    const credentialCount = violations.filter(v => v.type === 'CREDENTIAL').length;
    
    const reasons: string[] = [];
    
    if (phiCount > 0) {
      reasons.push(`${phiCount} Protected Health Information (PHI) violation${phiCount > 1 ? 's' : ''} - HIPAA compliance required`);
    }
    
    if (piiCount > 0) {
      reasons.push(`${piiCount} Personally Identifiable Information (PII) violation${piiCount > 1 ? 's' : ''}`);
    }
    
    if (financialCount > 0) {
      reasons.push(`${financialCount} financial information violation${financialCount > 1 ? 's' : ''}`);
    }
    
    if (credentialCount > 0) {
      reasons.push(`${credentialCount} credential violation${credentialCount > 1 ? 's' : ''}`);
    }
    
    return `Content blocked due to: ${reasons.join(', ')}`;
  }

  /**
   * Check for critical violations
   */
  private hasCriticalViolations(violations: SecurityViolation[]): boolean {
    return violations.some(v => v.severity === 'CRITICAL' || v.type === 'PHI');
  }

  /**
   * Perform additional file-specific security checks
   */
  private async performFileSecurityChecks(
    fileContent: Buffer,
    filename: string,
    mimeType: string
  ): Promise<{ safe: boolean; reason?: string; violations: SecurityViolation[] }> {
    const violations: SecurityViolation[] = [];
    
    // Check file size limits
    const maxSize = 50 * 1024 * 1024; // 50MB limit
    if (fileContent.length > maxSize) {
      violations.push({
        type: 'CUSTOM',
        category: 'FILE_SIZE',
        description: 'File size exceeds security limit',
        severity: 'HIGH',
        location: { start: 0, end: 0, context: `File size: ${fileContent.length} bytes` },
        pattern: 'FILE_SIZE_CHECK',
        confidence: 1.0
      });
    }
    
    // Check for dangerous file types
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com'];
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    
    if (dangerousExtensions.includes(extension)) {
      violations.push({
        type: 'CUSTOM',
        category: 'DANGEROUS_FILE_TYPE',
        description: 'Potentially dangerous file type detected',
        severity: 'CRITICAL',
        location: { start: 0, end: 0, context: `File extension: ${extension}` },
        pattern: 'FILE_TYPE_CHECK',
        confidence: 1.0
      });
    }
    
    // Check for embedded malicious content patterns
    const contentString = fileContent.toString('utf8', 0, Math.min(1024, fileContent.length));
    const maliciousPatterns = [
      /javascript:/i,
      /<script/i,
      /eval\(/i,
      /document\.write/i
    ];
    
    for (const pattern of maliciousPatterns) {
      if (pattern.test(contentString)) {
        violations.push({
          type: 'CUSTOM',
          category: 'MALICIOUS_CONTENT',
          description: 'Potentially malicious content pattern detected',
          severity: 'HIGH',
          location: { start: 0, end: 0, context: 'File content analysis' },
          pattern: pattern.toString(),
          confidence: 0.8
        });
      }
    }
    
    const hasCritical = violations.some(v => v.severity === 'CRITICAL');
    
    return {
      safe: violations.length === 0 || !hasCritical,
      reason: hasCritical ? 'File contains critical security violations' : undefined,
      violations
    };
  }

  /**
   * Extract text content from buffer based on MIME type
   */
  private extractTextFromBuffer(buffer: Buffer, mimeType: string): string {
    if (mimeType.startsWith('text/')) {
      return buffer.toString('utf8');
    }
    
    // For binary files, extract what we can for security scanning
    return buffer.toString('utf8', 0, Math.min(2048, buffer.length));
  }

  /**
   * Map MIME type to content type
   */
  private mapMimeTypeToContentType(mimeType: string): SecurityRequest['contentType'] {
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.includes('pdf') || mimeType.includes('document')) return 'document';
    return 'text';
  }

  /**
   * Initialize compliance profiles for different security levels
   */
  private initializeComplianceProfiles(): Map<string, ComplianceProfile> {
    const profiles = new Map<string, ComplianceProfile>();
    
    // HIPAA Strict - For healthcare environments
    profiles.set('HIPAA_STRICT', {
      name: 'HIPAA Strict Compliance',
      description: 'Maximum security for healthcare environments with PHI',
      config: {
        enablePIIDetection: true,
        enablePHIDetection: true,
        enableFinancialDetection: true,
        blockOnViolation: true,
        sanitizeContent: false, // No sanitization for PHI
        auditLogging: true,
        riskThreshold: 'LOW',
        customPatterns: []
      },
      applicableAccessLevels: ['OFFICE', 'COMPANY'],
      requiredForHIPAA: true
    });
    
    // PII Protected - For business environments
    profiles.set('PII_PROTECTED', {
      name: 'PII Protected',
      description: 'Standard PII protection for business use',
      config: {
        enablePIIDetection: true,
        enablePHIDetection: false,
        enableFinancialDetection: true,
        blockOnViolation: true,
        sanitizeContent: true,
        auditLogging: true,
        riskThreshold: 'MEDIUM',
        customPatterns: []
      },
      applicableAccessLevels: ['ACCOUNT'],
      requiredForHIPAA: false
    });
    
    // Basic Security - For public content
    profiles.set('BASIC_SECURITY', {
      name: 'Basic Security',
      description: 'Basic security for public content',
      config: {
        enablePIIDetection: false,
        enablePHIDetection: false,
        enableFinancialDetection: false,
        blockOnViolation: false,
        sanitizeContent: false,
        auditLogging: false,
        riskThreshold: 'CRITICAL',
        customPatterns: []
      },
      applicableAccessLevels: ['PUBLIC'],
      requiredForHIPAA: false
    });
    
    return profiles;
  }
}

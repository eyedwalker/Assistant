/**
 * SecurityEngine - VBD Engine Layer
 * 
 * Core algorithms for PII/PHI detection, HIPAA compliance, and security scanning
 * Provides stable, technology-agnostic security validation with no business logic
 */

export interface SecurityScanResult {
  isSecure: boolean;
  violations: SecurityViolation[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  blockedContent: boolean;
  sanitizedContent?: string;
  auditLog: SecurityAuditEntry[];
}

export interface SecurityViolation {
  type: 'PII' | 'PHI' | 'FINANCIAL' | 'CREDENTIAL' | 'CUSTOM';
  category: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  location: {
    start: number;
    end: number;
    context: string;
  };
  pattern: string;
  confidence: number;
}

export interface SecurityAuditEntry {
  timestamp: Date;
  action: 'SCAN' | 'BLOCK' | 'SANITIZE' | 'ALERT';
  result: 'PASSED' | 'FAILED' | 'BLOCKED';
  details: string;
  riskLevel: string;
  userId?: string;
  contentHash?: string;
}

export interface SecurityConfig {
  enablePIIDetection: boolean;
  enablePHIDetection: boolean;
  enableFinancialDetection: boolean;
  blockOnViolation: boolean;
  sanitizeContent: boolean;
  auditLogging: boolean;
  riskThreshold: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  customPatterns: SecurityPattern[];
}

export interface SecurityPattern {
  name: string;
  pattern: RegExp;
  type: 'PII' | 'PHI' | 'FINANCIAL' | 'CREDENTIAL' | 'CUSTOM';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
}

export class SecurityEngine {
  private readonly piiPatterns: SecurityPattern[];
  private readonly phiPatterns: SecurityPattern[];
  private readonly financialPatterns: SecurityPattern[];
  private readonly credentialPatterns: SecurityPattern[];

  constructor() {
    this.piiPatterns = this.initializePIIPatterns();
    this.phiPatterns = this.initializePHIPatterns();
    this.financialPatterns = this.initializeFinancialPatterns();
    this.credentialPatterns = this.initializeCredentialPatterns();
  }

  /**
   * Core algorithm: Comprehensive security scan of content
   */
  async scanContent(
    content: string,
    config: SecurityConfig,
    userId?: string
  ): Promise<SecurityScanResult> {
    const auditLog: SecurityAuditEntry[] = [];
    const violations: SecurityViolation[] = [];
    
    // Start audit logging
    auditLog.push({
      timestamp: new Date(),
      action: 'SCAN',
      result: 'PASSED',
      details: 'Security scan initiated',
      riskLevel: 'LOW',
      userId,
      contentHash: this.generateContentHash(content)
    });

    try {
      // PII Detection
      if (config.enablePIIDetection) {
        const piiViolations = this.detectPII(content);
        violations.push(...piiViolations);
      }

      // PHI Detection (HIPAA Critical)
      if (config.enablePHIDetection) {
        const phiViolations = this.detectPHI(content);
        violations.push(...phiViolations);
      }

      // Financial Information Detection
      if (config.enableFinancialDetection) {
        const financialViolations = this.detectFinancialInfo(content);
        violations.push(...financialViolations);
      }

      // Credential Detection
      const credentialViolations = this.detectCredentials(content);
      violations.push(...credentialViolations);

      // Custom Pattern Detection
      if (config.customPatterns.length > 0) {
        const customViolations = this.detectCustomPatterns(content, config.customPatterns);
        violations.push(...customViolations);
      }

      // Calculate risk level
      const riskLevel = this.calculateRiskLevel(violations);
      
      // Determine if content should be blocked
      const blockedContent = this.shouldBlockContent(violations, config);
      
      // Sanitize content if enabled
      let sanitizedContent: string | undefined;
      if (config.sanitizeContent && violations.length > 0) {
        sanitizedContent = this.sanitizeContent(content, violations);
      }

      // Log results
      if (violations.length > 0) {
        auditLog.push({
          timestamp: new Date(),
          action: blockedContent ? 'BLOCK' : 'ALERT',
          result: blockedContent ? 'BLOCKED' : 'FAILED',
          details: `Found ${violations.length} security violations`,
          riskLevel,
          userId,
          contentHash: this.generateContentHash(content)
        });
      }

      return {
        isSecure: violations.length === 0,
        violations,
        riskLevel,
        blockedContent,
        sanitizedContent,
        auditLog
      };

    } catch (error) {
      auditLog.push({
        timestamp: new Date(),
        action: 'SCAN',
        result: 'FAILED',
        details: `Security scan error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        riskLevel: 'CRITICAL',
        userId,
        contentHash: this.generateContentHash(content)
      });

      return {
        isSecure: false,
        violations: [{
          type: 'CUSTOM',
          category: 'SCAN_ERROR',
          description: 'Security scan failed',
          severity: 'CRITICAL',
          location: { start: 0, end: 0, context: 'System Error' },
          pattern: 'N/A',
          confidence: 1.0
        }],
        riskLevel: 'CRITICAL',
        blockedContent: true,
        auditLog
      };
    }
  }

  /**
   * Core algorithm: Detect Personally Identifiable Information (PII)
   */
  private detectPII(content: string): SecurityViolation[] {
    const violations: SecurityViolation[] = [];

    for (const pattern of this.piiPatterns) {
      const matches = Array.from(content.matchAll(new RegExp(pattern.pattern, 'gi')));
      
      for (const match of matches) {
        if (match.index !== undefined) {
          violations.push({
            type: 'PII',
            category: pattern.name,
            description: pattern.description,
            severity: pattern.severity,
            location: {
              start: match.index,
              end: match.index + match[0].length,
              context: this.getContext(content, match.index, match[0].length)
            },
            pattern: pattern.pattern.toString(),
            confidence: this.calculateConfidence(match[0], pattern)
          });
        }
      }
    }

    return violations;
  }

  /**
   * Core algorithm: Detect Protected Health Information (PHI) - HIPAA Critical
   */
  private detectPHI(content: string): SecurityViolation[] {
    const violations: SecurityViolation[] = [];

    for (const pattern of this.phiPatterns) {
      const matches = Array.from(content.matchAll(new RegExp(pattern.pattern, 'gi')));
      
      for (const match of matches) {
        if (match.index !== undefined) {
          violations.push({
            type: 'PHI',
            category: pattern.name,
            description: pattern.description,
            severity: 'CRITICAL', // All PHI is critical for HIPAA
            location: {
              start: match.index,
              end: match.index + match[0].length,
              context: this.getContext(content, match.index, match[0].length)
            },
            pattern: pattern.pattern.toString(),
            confidence: this.calculateConfidence(match[0], pattern)
          });
        }
      }
    }

    return violations;
  }

  /**
   * Core algorithm: Detect financial information
   */
  private detectFinancialInfo(content: string): SecurityViolation[] {
    const violations: SecurityViolation[] = [];

    for (const pattern of this.financialPatterns) {
      const matches = Array.from(content.matchAll(new RegExp(pattern.pattern, 'gi')));
      
      for (const match of matches) {
        if (match.index !== undefined) {
          violations.push({
            type: 'FINANCIAL',
            category: pattern.name,
            description: pattern.description,
            severity: pattern.severity,
            location: {
              start: match.index,
              end: match.index + match[0].length,
              context: this.getContext(content, match.index, match[0].length)
            },
            pattern: pattern.pattern.toString(),
            confidence: this.calculateConfidence(match[0], pattern)
          });
        }
      }
    }

    return violations;
  }

  /**
   * Core algorithm: Detect credentials and API keys
   */
  private detectCredentials(content: string): SecurityViolation[] {
    const violations: SecurityViolation[] = [];

    for (const pattern of this.credentialPatterns) {
      const matches = Array.from(content.matchAll(new RegExp(pattern.pattern, 'gi')));
      
      for (const match of matches) {
        if (match.index !== undefined) {
          violations.push({
            type: 'CREDENTIAL',
            category: pattern.name,
            description: pattern.description,
            severity: 'HIGH',
            location: {
              start: match.index,
              end: match.index + match[0].length,
              context: this.getContext(content, match.index, match[0].length)
            },
            pattern: pattern.pattern.toString(),
            confidence: this.calculateConfidence(match[0], pattern)
          });
        }
      }
    }

    return violations;
  }

  /**
   * Core algorithm: Detect custom security patterns
   */
  private detectCustomPatterns(content: string, patterns: SecurityPattern[]): SecurityViolation[] {
    const violations: SecurityViolation[] = [];

    for (const pattern of patterns) {
      const matches = Array.from(content.matchAll(new RegExp(pattern.pattern, 'gi')));
      
      for (const match of matches) {
        if (match.index !== undefined) {
          violations.push({
            type: pattern.type,
            category: pattern.name,
            description: pattern.description,
            severity: pattern.severity,
            location: {
              start: match.index,
              end: match.index + match[0].length,
              context: this.getContext(content, match.index, match[0].length)
            },
            pattern: pattern.pattern.toString(),
            confidence: this.calculateConfidence(match[0], pattern)
          });
        }
      }
    }

    return violations;
  }

  /**
   * Initialize PII detection patterns
   */
  private initializePIIPatterns(): SecurityPattern[] {
    return [
      {
        name: 'SSN',
        pattern: /\b\d{3}-?\d{2}-?\d{4}\b/,
        type: 'PII',
        severity: 'HIGH',
        description: 'Social Security Number detected'
      },
      {
        name: 'EMAIL',
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
        type: 'PII',
        severity: 'MEDIUM',
        description: 'Email address detected'
      },
      {
        name: 'PHONE',
        pattern: /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/,
        type: 'PII',
        severity: 'MEDIUM',
        description: 'Phone number detected'
      },
      {
        name: 'DRIVERS_LICENSE',
        pattern: /\b[A-Z]{1,2}\d{6,8}\b/,
        type: 'PII',
        severity: 'HIGH',
        description: 'Driver\'s license number detected'
      }
    ];
  }

  /**
   * Initialize PHI detection patterns (HIPAA Critical)
   */
  private initializePHIPatterns(): SecurityPattern[] {
    return [
      {
        name: 'MEDICAL_RECORD_NUMBER',
        pattern: /\b(?:MRN|MR|Medical Record|Patient ID)[\s:]*[A-Z0-9]{6,12}\b/i,
        type: 'PHI',
        severity: 'CRITICAL',
        description: 'Medical Record Number detected'
      },
      {
        name: 'PATIENT_NAME_DOB',
        pattern: /\b(?:Patient|Name)[\s:]*[A-Z][a-z]+\s[A-Z][a-z]+.*(?:DOB|Date of Birth)[\s:]*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/i,
        type: 'PHI',
        severity: 'CRITICAL',
        description: 'Patient name with date of birth detected'
      },
      {
        name: 'DIAGNOSIS_CODE',
        pattern: /\b(?:ICD|CPT|DRG)[\s:-]*[A-Z0-9]{3,7}\b/i,
        type: 'PHI',
        severity: 'CRITICAL',
        description: 'Medical diagnosis code detected'
      },
      {
        name: 'PRESCRIPTION_INFO',
        pattern: /\b(?:Rx|Prescription|Medication)[\s:]*[A-Z][a-z]+.*\d+mg\b/i,
        type: 'PHI',
        severity: 'CRITICAL',
        description: 'Prescription information detected'
      },
      {
        name: 'HEALTH_PLAN_ID',
        pattern: /\b(?:Insurance|Policy|Member ID)[\s:]*[A-Z0-9]{8,15}\b/i,
        type: 'PHI',
        severity: 'CRITICAL',
        description: 'Health plan identifier detected'
      }
    ];
  }

  /**
   * Initialize financial information patterns
   */
  private initializeFinancialPatterns(): SecurityPattern[] {
    return [
      {
        name: 'CREDIT_CARD',
        pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/,
        type: 'FINANCIAL',
        severity: 'HIGH',
        description: 'Credit card number detected'
      },
      {
        name: 'BANK_ACCOUNT',
        pattern: /\b(?:Account|Acct)[\s:]*\d{8,17}\b/i,
        type: 'FINANCIAL',
        severity: 'HIGH',
        description: 'Bank account number detected'
      },
      {
        name: 'ROUTING_NUMBER',
        pattern: /\b(?:Routing|ABA)[\s:]*\d{9}\b/i,
        type: 'FINANCIAL',
        severity: 'HIGH',
        description: 'Bank routing number detected'
      }
    ];
  }

  /**
   * Initialize credential detection patterns
   */
  private initializeCredentialPatterns(): SecurityPattern[] {
    return [
      {
        name: 'API_KEY',
        pattern: /\b(?:api[_-]?key|apikey)[\s:=]*['"]*[A-Za-z0-9]{20,}['"]*\b/i,
        type: 'CREDENTIAL',
        severity: 'HIGH',
        description: 'API key detected'
      },
      {
        name: 'PASSWORD',
        pattern: /\b(?:password|pwd|pass)[\s:=]*['"]*[A-Za-z0-9!@#$%^&*]{8,}['"]*\b/i,
        type: 'CREDENTIAL',
        severity: 'HIGH',
        description: 'Password detected'
      },
      {
        name: 'AWS_KEY',
        pattern: /\b(?:AKIA[0-9A-Z]{16}|aws[_-]?access[_-]?key)\b/i,
        type: 'CREDENTIAL',
        severity: 'HIGH',
        description: 'AWS access key detected'
      }
    ];
  }

  /**
   * Calculate risk level based on violations
   */
  private calculateRiskLevel(violations: SecurityViolation[]): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (violations.length === 0) return 'LOW';
    
    const hasCritical = violations.some(v => v.severity === 'CRITICAL');
    if (hasCritical) return 'CRITICAL';
    
    const hasHigh = violations.some(v => v.severity === 'HIGH');
    if (hasHigh) return 'HIGH';
    
    const hasMedium = violations.some(v => v.severity === 'MEDIUM');
    if (hasMedium) return 'MEDIUM';
    
    return 'LOW';
  }

  /**
   * Determine if content should be blocked
   */
  private shouldBlockContent(violations: SecurityViolation[], config: SecurityConfig): boolean {
    if (!config.blockOnViolation) return false;
    
    const riskLevel = this.calculateRiskLevel(violations);
    
    switch (config.riskThreshold) {
      case 'LOW': return violations.length > 0;
      case 'MEDIUM': return ['MEDIUM', 'HIGH', 'CRITICAL'].includes(riskLevel);
      case 'HIGH': return ['HIGH', 'CRITICAL'].includes(riskLevel);
      case 'CRITICAL': return riskLevel === 'CRITICAL';
      default: return false;
    }
  }

  /**
   * Sanitize content by removing or masking violations
   */
  private sanitizeContent(content: string, violations: SecurityViolation[]): string {
    let sanitized = content;
    
    // Sort violations by position (descending) to avoid index shifting
    const sortedViolations = [...violations].sort((a, b) => b.location.start - a.location.start);
    
    for (const violation of sortedViolations) {
      const { start, end } = violation.location;
      const originalText = sanitized.substring(start, end);
      const maskedText = this.maskSensitiveData(originalText, violation.type);
      
      sanitized = sanitized.substring(0, start) + maskedText + sanitized.substring(end);
    }
    
    return sanitized;
  }

  /**
   * Mask sensitive data based on type
   */
  private maskSensitiveData(text: string, type: SecurityViolation['type']): string {
    switch (type) {
      case 'PII':
      case 'PHI':
        return '[REDACTED]';
      case 'FINANCIAL':
        return '[FINANCIAL_INFO_REDACTED]';
      case 'CREDENTIAL':
        return '[CREDENTIAL_REDACTED]';
      default:
        return '[SENSITIVE_DATA_REDACTED]';
    }
  }

  /**
   * Get context around a match
   */
  private getContext(content: string, start: number, length: number): string {
    const contextLength = 50;
    const contextStart = Math.max(0, start - contextLength);
    const contextEnd = Math.min(content.length, start + length + contextLength);
    
    return content.substring(contextStart, contextEnd);
  }

  /**
   * Calculate confidence score for a match
   */
  private calculateConfidence(match: string, pattern: SecurityPattern): number {
    // Simple confidence calculation based on match length and pattern complexity
    const baseConfidence = 0.7;
    const lengthBonus = Math.min(0.3, match.length / 20);
    
    return Math.min(1.0, baseConfidence + lengthBonus);
  }

  /**
   * Generate content hash for audit logging
   */
  private generateContentHash(content: string): string {
    // Simple hash function for audit purposes
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

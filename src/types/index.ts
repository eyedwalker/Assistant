// Core Types for AI Assistant Platform

export enum AccessLevel {
  PUBLIC = 'public',           // Eyefinity public training content
  ACCOUNT = 'account',         // Account-specific content
  COMPANY = 'company',         // Company-wide content
  OFFICE = 'office'            // Office-specific content
}

export enum DocumentProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum ProcessingStage {
  EXTRACTION = 'extraction',
  ANALYSIS = 'analysis',
  VECTORIZATION = 'vectorization',
  INDEXING = 'indexing'
}

export enum ProcessingLogStatus {
  STARTED = 'started',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum ContentType {
  DOCUMENTATION = 'documentation',
  TRAINING = 'training',
  REFERENCE = 'reference',
  POLICY = 'policy'
}

export enum QualityRating {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor'
}

export interface DocumentProcessingRequest {
  urls?: string[];
  files?: File[];
  options: ProcessingOptions;
}

export interface ProcessingOptions {
  enableJavaScript: boolean;
  crawlDepth: number;
  enableScreenshots: boolean;
  enableAIAnalysis: boolean;
  enableContentMonitoring: boolean;
  accessLevel: AccessLevel;
  accessId: string;
}

export interface DocumentMetadata {
  id: string;
  name: string;
  url?: string;
  s3Key: string;
  fileType: string;
  fileSize: number;
  accessLevel: AccessLevel;
  accessId: string;
  status: DocumentProcessingStatus;
  uploadedBy: string;
  createdAt: Date;
  lastUpdatedAt: Date;
  processingLogs: ProcessingLog[];
  ai_analysis?: AIAnalysis;
  vectorEmbeddings?: VectorEmbedding[];
  contentHash?: string;
  extractedText?: string;
  screenshots?: string[];
}

export interface ProcessingLog {
  timestamp: Date;
  stage: ProcessingStage;
  status: ProcessingLogStatus;
  message: string;
  duration?: number;
  metadata?: Record<string, any>;
  errorDetails?: string;
}

export interface AIAnalysis {
  summary: string;
  keywords: string[];
  categories: string[];
  contentType: ContentType;
  quality: QualityRating;
  wordCount: number;
  entityCount: number;
  topics: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  readabilityScore?: number;
  technicalComplexity?: 'low' | 'medium' | 'high';
  confidenceScore: number;
}

export interface VectorEmbedding {
  id: string;
  documentId: string;
  chunkText: string;
  embedding: number[];
  chunkIndex: number;
  metadata: {
    startPosition: number;
    endPosition: number;
    section?: string;
    importance?: number;
  };
}

export interface ExtractionResult {
  success: boolean;
  content: string;
  title?: string;
  metadata?: Record<string, any>;
  screenshots?: string[];
  links?: string[];
  extractionMethod: string;
  processingTime: number;
  error?: string;
}

// Chat and AI Assistant Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  sources?: DocumentReference[];
  confidence?: number;
  conversationId: string;
  metadata?: Record<string, any>;
}

export interface DocumentReference {
  documentId: string;
  documentName: string;
  relevanceScore: number;
  excerpt: string;
  url?: string;
  accessLevel: AccessLevel;
}

export interface ChatContext {
  conversationId: string;
  userId: string;
  accessLevel: AccessLevel;
  accessId: string;
  previousMessages: ChatMessage[];
  relevantDocuments?: DocumentReference[];
}

export interface ConversationMetadata {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  lastUpdatedAt: Date;
  messageCount: number;
  accessLevel: AccessLevel;
  accessId: string;
  tags?: string[];
}

// Search and Knowledge Base Types
export interface SearchFilters {
  accessLevel?: AccessLevel;
  accessId?: string;
  contentType?: ContentType[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  quality?: QualityRating[];
  fileTypes?: string[];
  keywords?: string[];
}

export interface SearchResult {
  documentId: string;
  title: string;
  excerpt: string;
  relevanceScore: number;
  url?: string;
  accessLevel: AccessLevel;
  contentType: ContentType;
  lastUpdated: Date;
  highlights?: string[];
}

export interface KnowledgeBaseQuery {
  query: string;
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
  includeEmbeddings?: boolean;
}

// User and Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  accessLevel: AccessLevel;
  accessId: string;
  permissions: Permission[];
  createdAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;
  preferences?: UserPreferences;
}

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  USER = 'user',
  VIEWER = 'viewer'
}

export enum Permission {
  READ_DOCUMENTS = 'read_documents',
  UPLOAD_DOCUMENTS = 'upload_documents',
  DELETE_DOCUMENTS = 'delete_documents',
  MANAGE_USERS = 'manage_users',
  VIEW_ANALYTICS = 'view_analytics',
  ADMIN_ACCESS = 'admin_access'
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: {
    email: boolean;
    inApp: boolean;
    processingUpdates: boolean;
  };
  defaultAccessLevel: AccessLevel;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Processing Queue Types
export interface ProcessingJob {
  id: string;
  type: 'url_extraction' | 'file_upload' | 'ai_analysis' | 'vectorization';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  priority: number;
  payload: Record<string, any>;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  retryCount: number;
  maxRetries: number;
}

// Analytics and Monitoring Types
export interface ProcessingMetrics {
  totalDocuments: number;
  successfulExtractions: number;
  failedExtractions: number;
  averageProcessingTime: number;
  totalStorageUsed: number;
  activeUsers: number;
  conversationsToday: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  services: {
    database: 'up' | 'down';
    storage: 'up' | 'down';
    aiService: 'up' | 'down';
    vectorDb: 'up' | 'down';
  };
  lastChecked: Date;
  uptime: number;
}

// Configuration Types
export interface AppConfig {
  maxDocumentSize: number;
  maxConcurrentExtractions: number;
  defaultCrawlDepth: number;
  processingTimeout: number;
  enablePHIScanning: boolean;
  enableAuditLogging: boolean;
  sessionTimeout: number;
  supportedFileTypes: string[];
}

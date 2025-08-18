/**
 * Enhanced Content Types for Multi-Modal Processing Platform
 * Supports documents, videos, audio, web content, and training materials
 */

export type ContentType = 
  | 'document' 
  | 'video' 
  | 'audio' 
  | 'web' 
  | 'image' 
  | 'presentation'
  | 'spreadsheet'
  | 'archive';

export type ProcessingStatus = 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'transcribing'
  | 'extracting'
  | 'analyzing'
  | 'indexing';

export interface ContentSource {
  type: 'url' | 'file' | 'batch';
  source: string; // URL, file path, or batch ID
  metadata?: Record<string, any>;
}

export interface ProcessedContent {
  id: string;
  contentType: ContentType;
  source: ContentSource;
  title: string;
  description?: string;
  extractedText?: string;
  transcription?: string;
  keyFrames?: string[]; // For videos
  audioSegments?: AudioSegment[]; // For audio files
  webMetadata?: WebMetadata; // For web content
  embeddings?: number[];
  processingStatus: ProcessingStatus;
  processingTime: number;
  fileSize?: number;
  duration?: number; // For video/audio in seconds
  quality?: 'low' | 'medium' | 'high';
  language?: string;
  confidence?: number;
  tags?: string[];
  categories?: string[];
  learningObjectives?: string[];
  prerequisites?: string[];
  difficultyLevel?: 'beginner' | 'intermediate' | 'advanced';
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  tenantId: string;
  accessLevel: 'PUBLIC' | 'ACCOUNT' | 'COMPANY' | 'OFFICE';
}

export interface VideoContent extends ProcessedContent {
  contentType: 'video';
  videoMetadata: {
    duration: number;
    resolution: string;
    frameRate: number;
    codec: string;
    bitrate: number;
    chapters?: VideoChapter[];
    subtitles?: Subtitle[];
    keyFrames: KeyFrame[];
  };
  transcription: string;
  audioTrack?: AudioSegment[];
}

export interface AudioContent extends ProcessedContent {
  contentType: 'audio';
  audioMetadata: {
    duration: number;
    sampleRate: number;
    channels: number;
    bitrate: number;
    format: string;
    speakers?: SpeakerSegment[];
  };
  transcription: string;
  segments: AudioSegment[];
}

export interface WebContent extends ProcessedContent {
  contentType: 'web';
  webMetadata: WebMetadata;
  crawledPages: CrawledPage[];
  sitemap?: string[];
  linkedResources: LinkedResource[];
}

export interface DocumentContent extends ProcessedContent {
  contentType: 'document' | 'presentation' | 'spreadsheet';
  documentMetadata: {
    pageCount?: number;
    wordCount?: number;
    format: string;
    author?: string;
    creationDate?: Date;
    lastModified?: Date;
    tables?: TableData[];
    images?: ImageData[];
    charts?: ChartData[];
  };
}

// Supporting interfaces
export interface AudioSegment {
  startTime: number;
  endTime: number;
  text: string;
  speaker?: string;
  confidence: number;
  emotions?: string[];
  keywords?: string[];
}

export interface VideoChapter {
  title: string;
  startTime: number;
  endTime: number;
  description?: string;
  keyTopics?: string[];
}

export interface KeyFrame {
  timestamp: number;
  imageUrl: string;
  description?: string;
  objects?: DetectedObject[];
  text?: string; // OCR text from frame
}

export interface Subtitle {
  startTime: number;
  endTime: number;
  text: string;
  language: string;
}

export interface SpeakerSegment {
  speakerId: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface WebMetadata {
  title: string;
  description?: string;
  author?: string;
  publishDate?: Date;
  lastModified?: Date;
  siteName?: string;
  url: string;
  canonicalUrl?: string;
  language?: string;
  keywords?: string[];
  socialMedia?: {
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    twitterCard?: string;
  };
  technicalInfo?: {
    loadTime: number;
    pageSize: number;
    resources: number;
    lighthouse?: {
      performance: number;
      accessibility: number;
      bestPractices: number;
      seo: number;
    };
  };
}

export interface CrawledPage {
  url: string;
  title: string;
  content: string;
  depth: number;
  parentUrl?: string;
  lastCrawled: Date;
  status: 'success' | 'failed' | 'skipped';
  statusCode?: number;
  contentType?: string;
  size: number;
}

export interface LinkedResource {
  id?: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'link';
  url: string;
  title?: string;
  description?: string;
  size?: number;
  processed: boolean;
  content?: string;
  metadata?: Record<string, any>;
}

export interface DetectedObject {
  label: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface TableData {
  headers: string[];
  rows: string[][];
  caption?: string;
  pageNumber?: number;
}

export interface ImageData {
  url: string;
  caption?: string;
  altText?: string;
  width?: number;
  height?: number;
  ocrText?: string;
  pageNumber?: number;
}

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'other';
  title?: string;
  description?: string;
  data?: any;
  pageNumber?: number;
}

import { AuthConfig } from '@/lib/engines/WebCrawlingEngine';

// Processing configuration interfaces
export interface ProcessingConfig {
  contentType: ContentType;
  extractText: boolean;
  generateEmbeddings: boolean;
  enableTranscription: boolean;
  enableOCR: boolean;
  enableObjectDetection: boolean;
  quality: 'low' | 'medium' | 'high';
  maxDuration?: number; // For video/audio processing limits
  maxPages?: number; // For document processing limits
  crawlDepth?: number; // For web crawling
  allowedDomains?: string[]; // For web crawling
  auth?: AuthConfig; // Authentication config for web crawling
  phiDetection: boolean;
  auditLogging: boolean;
}

export interface ProcessingJob {
  id: string;
  contentId: string;
  status: ProcessingStatus;
  progress: number; // 0-100
  startTime: Date;
  endTime?: Date;
  config: ProcessingConfig;
  errors?: ProcessingError[];
  metrics?: ProcessingMetrics;
}

export interface ProcessingError {
  code: string;
  message: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
}

export interface ProcessingMetrics {
  processingTime: number;
  memoryUsage: number;
  cpuUsage: number;
  storageUsed: number;
  apiCalls: number;
  costs?: {
    transcription?: number;
    embedding?: number;
    storage?: number;
    compute?: number;
    total: number;
  };
}

// Search and retrieval interfaces
export interface SearchQuery {
  query: string;
  contentTypes?: ContentType[];
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
  includeTranscripts?: boolean;
  includeMetadata?: boolean;
}

export interface SearchFilters {
  dateRange?: {
    start: Date;
    end: Date;
  };
  duration?: {
    min?: number;
    max?: number;
  };
  quality?: ('low' | 'medium' | 'high')[];
  categories?: string[];
  tags?: string[];
  difficultyLevel?: ('beginner' | 'intermediate' | 'advanced')[];
  language?: string[];
  userId?: string;
  tenantId?: string;
  accessLevel?: ('PUBLIC' | 'ACCOUNT' | 'COMPANY' | 'OFFICE')[];
}

export interface SearchResult {
  content: ProcessedContent;
  score: number;
  highlights: SearchHighlight[];
  relatedContent?: ProcessedContent[];
}

export interface SearchHighlight {
  field: string;
  text: string;
  startOffset: number;
  endOffset: number;
  timestamp?: number; // For video/audio highlights
}

// Training and learning interfaces
export interface LearningPath {
  id: string;
  title: string;
  description: string;
  contents: ProcessedContent[];
  prerequisites: string[];
  learningObjectives: string[];
  estimatedDuration: number;
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProgress {
  userId: string;
  contentId: string;
  progress: number; // 0-100
  timeSpent: number; // seconds
  lastAccessed: Date;
  completed: boolean;
  bookmarks: Bookmark[];
  notes: Note[];
}

export interface Bookmark {
  id: string;
  timestamp?: number; // For video/audio bookmarks
  pageNumber?: number; // For document bookmarks
  title: string;
  description?: string;
  createdAt: Date;
}

export interface Note {
  id: string;
  content: string;
  timestamp?: number; // For video/audio notes
  pageNumber?: number; // For document notes
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

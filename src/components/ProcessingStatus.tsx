'use client';

import React, { useState, useEffect } from 'react';
import { 
  RefreshCcwIcon as RefreshCw, 
  DocumentTextIcon as FileText, 
  ClockIcon as Clock, 
  CheckCircleIcon as CheckCircle, 
  XCircleIcon as XCircle, 
  ExclamationTriangleIcon as AlertTriangle 
} from '@heroicons/react/24/outline';

interface ProcessingJob {
  id: string;
  jobId: string;
  type: string;
  status: string;
  progress: number;
  createdAt: string;
  completedAt?: string;
  processingTime?: number;
  error?: string;
  result?: {
    contentId: string;
    success: boolean;
    extractedTextLength: number;
    hasAiAnalysis: boolean;
    hasEmbeddings: boolean;
  };
}

interface ProcessedContent {
  id: string;
  title: string;
  contentType: string;
  processingStatus: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
  extractedTextLength: number;
  transcriptionLength: number;
  hasAiAnalysis: boolean;
  aiAnalysisQuality?: string;
  categoriesCount: number;
  tagsCount: number;
  hasEmbeddings: boolean;
  embeddingCount: number;
  contentPreview: {
    extractedText?: string;
    transcription?: string;
    aiSummary?: string;
    keyPoints: string[];
    categories: string[];
    tags: string[];
  };
}

interface ProcessingInsights {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  totalContent: number;
  contentWithText: number;
  contentWithAI: number;
  ragReadyContent: number;
  suspiciouslyFastJobs: number;
}

interface Recommendation {
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  action: string;
}

export default function ProcessingStatus() {
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagnostics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/processing/diagnostics?userId=demo-user&tenantId=demo-tenant&limit=20');
      const data = await response.json();
      
      if (data.success) {
        setDiagnostics(data);
      } else {
        setError(data.error || 'Failed to fetch diagnostics');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing': return <Clock className="h-4 w-4 text-blue-500" />;
      default: return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      completed: 'default',
      failed: 'destructive',
      processing: 'secondary',
      pending: 'outline'
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Loading processing diagnostics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="p-6">
          <div className="flex items-center text-red-600 mb-4">
            <XCircle className="h-5 w-5 mr-2" />
            <span className="font-medium">Error loading diagnostics</span>
          </div>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchDiagnostics} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!diagnostics) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-gray-500">No diagnostics data available</p>
        </CardContent>
      </Card>
    );
  }

  const { insights, recommendations } = diagnostics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Processing Diagnostics</h2>
        <Button onClick={fetchDiagnostics} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Insights Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Jobs</p>
                <p className="text-2xl font-bold">{insights.totalJobs}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">{insights.completedJobs}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">RAG Ready</p>
                <p className="text-2xl font-bold text-purple-600">{insights.ragReadyContent}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Time</p>
                <p className="text-2xl font-bold">{formatTime(insights.averageProcessingTime)}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations.map((rec: Recommendation, index: number) => (
                <div key={index} className={`p-3 rounded-lg border ${
                  rec.type === 'error' ? 'border-red-200 bg-red-50' :
                  rec.type === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                  'border-blue-200 bg-blue-50'
                }`}>
                  <div className="flex items-start">
                    {rec.type === 'error' ? <XCircle className="h-5 w-5 text-red-500 mt-0.5 mr-2" /> :
                     rec.type === 'warning' ? <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 mr-2" /> :
                     <CheckCircle className="h-5 w-5 text-blue-500 mt-0.5 mr-2" />}
                    <div>
                      <h4 className="font-medium">{rec.title}</h4>
                      <p className="text-sm text-gray-600 mt-1">{rec.message}</p>
                      <p className="text-sm font-medium mt-2">Action: {rec.action}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Processing Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Processing Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {diagnostics.diagnostics.processingJobs.map((job: ProcessingJob) => (
              <div key={job.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(job.status)}
                    <span className="font-medium">{job.type}</span>
                    {getStatusBadge(job.status)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {job.processingTime ? formatTime(job.processingTime) : 'N/A'}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p><strong>Job ID:</strong> {job.jobId}</p>
                    <p><strong>Created:</strong> {formatDate(job.createdAt)}</p>
                    {job.completedAt && <p><strong>Completed:</strong> {formatDate(job.completedAt)}</p>}
                  </div>
                  
                  {job.result && (
                    <div>
                      <p><strong>Text Length:</strong> {job.result.extractedTextLength}</p>
                      <p><strong>AI Analysis:</strong> {job.result.hasAiAnalysis ? 'Yes' : 'No'}</p>
                      <p><strong>Embeddings:</strong> {job.result.hasEmbeddings ? 'Yes' : 'No'}</p>
                    </div>
                  )}
                </div>
                
                {job.error && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    <strong>Error:</strong> {job.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Processed Content */}
      <Card>
        <CardHeader>
          <CardTitle>Processed Content</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {diagnostics.diagnostics.processedContent.map((content: ProcessedContent) => (
              <div key={content.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">{content.title}</h4>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">{content.contentType}</Badge>
                    {getStatusBadge(content.processingStatus)}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-3">
                  <div>
                    <p><strong>Text:</strong> {content.extractedTextLength} chars</p>
                    <p><strong>Categories:</strong> {content.categoriesCount}</p>
                    <p><strong>Tags:</strong> {content.tagsCount}</p>
                  </div>
                  <div>
                    <p><strong>AI Analysis:</strong> {content.hasAiAnalysis ? 'Yes' : 'No'}</p>
                    <p><strong>Quality:</strong> {content.aiAnalysisQuality || 'N/A'}</p>
                    <p><strong>Embeddings:</strong> {content.embeddingCount}</p>
                  </div>
                  <div>
                    <p><strong>RAG Ready:</strong> {content.hasEmbeddings && content.hasAiAnalysis ? 'Yes' : 'No'}</p>
                    <p><strong>Created:</strong> {formatDate(content.createdAt)}</p>
                    <p><strong>Updated:</strong> {formatDate(content.updatedAt)}</p>
                  </div>
                </div>
                
                {content.contentPreview && (
                  <div className="space-y-2">
                    {content.contentPreview.extractedText && (
                      <div className="p-2 bg-gray-50 rounded text-sm">
                        <strong>Text Preview:</strong> {content.contentPreview.extractedText}
                      </div>
                    )}
                    {content.contentPreview.aiSummary && (
                      <div className="p-2 bg-blue-50 rounded text-sm">
                        <strong>AI Summary:</strong> {content.contentPreview.aiSummary}
                      </div>
                    )}
                    {content.contentPreview.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <span className="text-sm font-medium">Categories:</span>
                        {content.contentPreview.categories.map((cat, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{cat}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

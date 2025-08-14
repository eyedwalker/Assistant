'use client';

import React, { useState, useEffect } from 'react';
import { 
  ArrowPathIcon as RefreshCcwIcon, 
  DocumentTextIcon, 
  ClockIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';

interface ProcessingDiagnostics {
  success: boolean;
  diagnostics?: any;
  insights?: any;
  recommendations?: any[];
  error?: string;
}

export default function SimpleProcessingStatus() {
  const [diagnostics, setDiagnostics] = useState<ProcessingDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagnostics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/processing/diagnostics?userId=demo-user&tenantId=demo-tenant&limit=10');
      const data = await response.json();
      setDiagnostics(data);
      
      if (!data.success) {
        setError(data.error || 'Failed to fetch diagnostics');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setDiagnostics({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

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
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center">
          <RefreshCcwIcon className="h-6 w-6 animate-spin mr-2" />
          <span>Loading processing diagnostics...</span>
        </div>
      </div>
    );
  }

  if (error || !diagnostics?.success) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center text-red-600 mb-4">
          <XCircleIcon className="h-5 w-5 mr-2" />
          <span className="font-medium">Error loading diagnostics</span>
        </div>
        <p className="text-sm text-gray-600 mb-4">{error || diagnostics?.error}</p>
        <button 
          onClick={fetchDiagnostics}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
        >
          <RefreshCcwIcon className="h-4 w-4 mr-2" />
          Retry
        </button>
      </div>
    );
  }

  const { insights, recommendations } = diagnostics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Processing Diagnostics</h2>
        <button 
          onClick={fetchDiagnostics}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
        >
          <RefreshCcwIcon className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Insights Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Jobs</p>
              <p className="text-2xl font-bold">{insights?.totalJobs || 0}</p>
            </div>
            <DocumentTextIcon className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">{insights?.completedJobs || 0}</p>
            </div>
            <CheckCircleIcon className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">RAG Ready</p>
              <p className="text-2xl font-bold text-purple-600">{insights?.ragReadyContent || 0}</p>
            </div>
            <ExclamationTriangleIcon className="h-8 w-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Time</p>
              <p className="text-2xl font-bold">{insights?.averageProcessingTime ? formatTime(insights.averageProcessingTime) : 'N/A'}</p>
            </div>
            <ClockIcon className="h-8 w-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Recommendations</h3>
          <div className="space-y-3">
            {recommendations.map((rec: any, index: number) => (
              <div key={index} className={`p-3 rounded-lg border ${
                rec.type === 'error' ? 'border-red-200 bg-red-50' :
                rec.type === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                'border-blue-200 bg-blue-50'
              }`}>
                <div className="flex items-start">
                  {rec.type === 'error' ? <XCircleIcon className="h-5 w-5 text-red-500 mt-0.5 mr-2" /> :
                   rec.type === 'warning' ? <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 mt-0.5 mr-2" /> :
                   <CheckCircleIcon className="h-5 w-5 text-blue-500 mt-0.5 mr-2" />}
                  <div>
                    <h4 className="font-medium">{rec.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{rec.message}</p>
                    <p className="text-sm font-medium mt-2">Action: {rec.action}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Processing Jobs */}
      {diagnostics.diagnostics?.processingJobs && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Processing Jobs</h3>
          <div className="space-y-3">
            {diagnostics.diagnostics.processingJobs.map((job: any) => (
              <div key={job.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {job.status === 'completed' ? <CheckCircleIcon className="h-4 w-4 text-green-500" /> :
                     job.status === 'failed' ? <XCircleIcon className="h-4 w-4 text-red-500" /> :
                     <ClockIcon className="h-4 w-4 text-blue-500" />}
                    <span className="font-medium">{job.type}</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      job.status === 'completed' ? 'bg-green-100 text-green-800' :
                      job.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {job.status}
                    </span>
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
        </div>
      )}

      {/* Processed Content */}
      {diagnostics.diagnostics?.processedContent && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Processed Content</h3>
          <div className="space-y-4">
            {diagnostics.diagnostics.processedContent.map((content: any) => (
              <div key={content.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">{content.title}</h4>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                      {content.contentType}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      content.processingStatus === 'completed' ? 'bg-green-100 text-green-800' :
                      content.processingStatus === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {content.processingStatus}
                    </span>
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
                        {content.contentPreview.categories.map((cat: string, i: number) => (
                          <span key={i} className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

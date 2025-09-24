'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface LearningContent {
  summary: string;
  learningObjectives: string[];
  clinicalRelevance: string;
  keyTopics: string[];
  targetAudience: string[];
  difficultyLevel: string;
  estimatedTime: string;
}

interface ContentMetrics {
  hasTranscript: boolean;
  hasAIAnalysis: boolean;
  hasProductCategorization: boolean;
  transcriptWordCount: number;
  analysisWordCount: number;
}

interface ProcessedVideo {
  id: string;
  vimeoId: string;
  title: string;
  url: string;
  description: string;
  processedAt: string;
  aiModel: string;
  analysisVersion: string;
  transcriptLength: number;
  transcript: string;
  aiAnalysis: string;
  vspProduct: string;
  productFeatures: string[];
  productConfidence: number;
  duration: number;
  thumbnail: string;
  tags: string[];
  learningContent: LearningContent;
  contentMetrics: ContentMetrics;
}

interface VideoResultsResponse {
  success: boolean;
  data: {
    videos: ProcessedVideo[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    categoryStats: Array<{ category: string; count: number }>;
    summary: {
      totalVideos: number;
      avgTranscriptLength: number;
      avgAnalysisLength: number;
      productsIdentified: number;
      processingModels: string[];
    };
  };
}

export default function VideoResultsPage() {
  const [data, setData] = useState<VideoResultsResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<ProcessedVideo | null>(null);
  const [filter, setFilter] = useState({
    vspProduct: '',
    search: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [stats, setStats] = useState({
    total: 0,
    byProduct: {} as Record<string, number>
  });

  const productOptions = [
    { value: '', label: 'All Products' },
    { value: 'Officemate', label: 'Officemate' },
    { value: 'Acuity Logic', label: 'Acuity Logic' },
    { value: 'EPM', label: 'EPM (Encompass)' },
    { value: 'Encompass', label: 'Encompass' },
    { value: 'General', label: 'General' }
  ];

  const featureOptions = [
    { value: '', label: 'All Features' },
    { value: 'Contact Lens Management', label: 'Contact Lens Management' },
    { value: 'Analytics & Insights', label: 'Analytics & Insights' },
    { value: 'Billing & Claims', label: 'Billing & Claims' },
    { value: 'Patient Management', label: 'Patient Management' },
    { value: 'Training & Education', label: 'Training & Education' },
    { value: 'Integration', label: 'Integration' },
    { value: 'Online Services', label: 'Online Services' }
  ];

  useEffect(() => {
    setCurrentPage(1); // Reset to page 1 when filters change
    fetchVideos(1);
  }, [filter]);

  useEffect(() => {
    fetchVideos(currentPage);
  }, [currentPage]);

  const fetchVideos = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.vspProduct) params.append('category', filter.vspProduct);
      if (filter.search) params.append('search', filter.search);
      params.append('page', page.toString());
      params.append('limit', '10');
      
      const response = await fetch(`/api/videos/results?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleReprocessVideo = async (videoId: string) => {
    if (!confirm('Are you sure you want to reprocess this video? This will update the AI analysis and product categorization.')) {
      return;
    }

    try {
      const response = await fetch('/api/videos/reprocess', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoId }),
      });

      const result = await response.json();
      
      if (response.ok) {
        alert('✅ Video reprocessing started successfully!');
        // Refresh the page to show updated data
        window.location.reload();
      } else {
        throw new Error(result.error || 'Failed to reprocess video');
      }
    } catch (error) {
      console.error('Error reprocessing video:', error);
      alert(`❌ Failed to reprocess video: ${error.message}`);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600 bg-green-50';
    if (confidence >= 0.7) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              🎥 Processed Video Results
            </h1>
            <p className="text-gray-600 mt-2">
              View and analyze AI-enhanced video training content with product categorization
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/"
              className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 flex items-center space-x-2"
            >
              <span>←</span>
              <span>Back to Menu</span>
            </Link>
            <Link
              href="/admin/videos"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              ← Back to Processing
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-2xl font-bold text-blue-600">{data.summary.totalVideos}</div>
              <div className="text-sm text-gray-600">Total Videos</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-2xl font-bold text-green-600">{Math.round(data.summary.avgTranscriptLength)}</div>
              <div className="text-sm text-gray-600">Avg Transcript Length</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-2xl font-bold text-purple-600">{data.summary.productsIdentified}</div>
              <div className="text-sm text-gray-600">Products Identified</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-2xl font-bold text-orange-600">{data.summary.processingModels.length}</div>
              <div className="text-sm text-gray-600">AI Models Used</div>
            </div>
          </div>
        )}

        {/* Category Stats */}
        {data && data.categoryStats.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow mb-8">
            <h3 className="text-lg font-semibold mb-4">Content by Category</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {data.categoryStats.map((stat) => (
                <div key={stat.category} className="text-center">
                  <div className="text-xl font-bold text-gray-900">{stat.count}</div>
                  <div className="text-sm text-gray-600">{stat.category}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-lg font-semibold mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                VSP Product
              </label>
              <select
                value={filter.vspProduct}
                onChange={(e) => setFilter({...filter, vspProduct: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {productOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                value={filter.search}
                onChange={(e) => setFilter({...filter, search: e.target.value})}
                placeholder="Search videos..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Videos List */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : data && data.videos.length > 0 ? (
          <div className="space-y-6">
            {data.videos.map((video) => (
              <div key={video.id} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">
                          {video.title}
                        </h3>
                        <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                          video.productConfidence >= 0.9 ? 'bg-green-100 text-green-800' :
                          video.productConfidence >= 0.7 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {video.vspProduct} ({Math.round(video.productConfidence * 100)}% confidence)
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                        <span className="flex items-center gap-1">
                          🎯 <strong>{video.vspProduct}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          ⏱️ {formatDuration(video.duration)}
                        </span>
                        <span className="flex items-center gap-1">
                          🤖 {video.aiModel}
                        </span>
                        <span className="flex items-center gap-1">
                          📅 {new Date(video.processedAt).toLocaleDateString()}
                        </span>
                      </div>

                      {video.description && (
                        <p className="text-gray-700 mb-4">{video.description}</p>
                      )}
                    </div>
                    
                    <div className="ml-4 flex gap-2">
                      <button
                        onClick={() => setSelectedVideo(selectedVideo?.id === video.id ? null : video)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm font-medium"
                      >
                        {selectedVideo?.id === video.id ? 'Hide Details' : 'View Details'}
                      </button>
                      <button
                        onClick={() => handleReprocessVideo(video.id)}
                        className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 text-sm font-medium flex items-center gap-1"
                      >
                        🔄 Reprocess
                      </button>
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
                      >
                        Watch Video
                      </a>
                    </div>
                  </div>

                  {/* Content Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-lg font-bold text-blue-600">{video.contentMetrics.transcriptWordCount}</div>
                      <div className="text-xs text-blue-700">Words</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-lg font-bold text-green-600">{video.contentMetrics.analysisWordCount}</div>
                      <div className="text-xs text-green-700">Analysis Words</div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="text-sm font-bold text-purple-600">{video.contentMetrics.hasTranscript ? '✅' : '❌'}</div>
                      <div className="text-xs text-purple-700">Transcript</div>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <div className="text-sm font-bold text-orange-600">{video.contentMetrics.hasAIAnalysis ? '✅' : '❌'}</div>
                      <div className="text-xs text-orange-700">AI Analysis</div>
                    </div>
                    <div className="text-center p-3 bg-pink-50 rounded-lg">
                      <div className="text-sm font-bold text-pink-600">{video.contentMetrics.hasProductCategorization ? '✅' : '❌'}</div>
                      <div className="text-xs text-pink-700">Categorized</div>
                    </div>
                  </div>

                  {/* Quick Preview */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {video.productFeatures.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Product Features:</h4>
                        <div className="flex flex-wrap gap-1">
                          {video.productFeatures.slice(0, 5).map((feature: string, index: number) => (
                            <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                              {feature}
                            </span>
                          ))}
                          {video.productFeatures.length > 5 && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                              +{video.productFeatures.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {video.tags.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Tags:</h4>
                        <div className="flex flex-wrap gap-1">
                          {video.tags.slice(0, 5).map((tag: string, index: number) => (
                            <span key={index} className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                              {tag}
                            </span>
                          ))}
                          {video.tags.length > 5 && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                              +{video.tags.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Detailed View */}
                {selectedVideo?.id === video.id && (
                  <div className="border-t border-gray-200 bg-gray-50">
                    <div className="p-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Learning Content */}
                        <div className="space-y-6">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                              🎓 Learning Content
                            </h3>
                            
                            {video.learningContent.summary && (
                              <div className="mb-4">
                                <h4 className="font-medium text-gray-800 mb-2">Summary:</h4>
                                <p className="text-sm text-gray-700 bg-white p-3 rounded border">
                                  {video.learningContent.summary}
                                </p>
                              </div>
                            )}

                            {video.learningContent.learningObjectives.length > 0 && (
                              <div className="mb-4">
                                <h4 className="font-medium text-gray-800 mb-2">Learning Objectives:</h4>
                                <ul className="text-sm text-gray-700 bg-white p-3 rounded border space-y-1">
                                  {video.learningContent.learningObjectives.map((objective: string, index: number) => (
                                    <li key={index} className="flex items-start gap-2">
                                      <span className="text-blue-600 font-bold">{index + 1}.</span>
                                      <span>{objective}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {video.learningContent.clinicalRelevance && (
                              <div className="mb-4">
                                <h4 className="font-medium text-gray-800 mb-2">Clinical Relevance:</h4>
                                <p className="text-sm text-gray-700 bg-white p-3 rounded border">
                                  {video.learningContent.clinicalRelevance}
                                </p>
                              </div>
                            )}

                            {video.learningContent.keyTopics.length > 0 && (
                              <div className="mb-4">
                                <h4 className="font-medium text-gray-800 mb-2">Key Topics:</h4>
                                <div className="flex flex-wrap gap-2">
                                  {video.learningContent.keyTopics.map((topic: string, index: number) => (
                                    <span key={index} className="px-3 py-1 bg-indigo-100 text-indigo-800 text-sm rounded-full">
                                      {topic}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                              {video.learningContent.targetAudience.length > 0 && (
                                <div>
                                  <h4 className="font-medium text-gray-800 mb-2">Target Audience:</h4>
                                  <div className="flex flex-wrap gap-1">
                                    {video.learningContent.targetAudience.map((audience: string, index: number) => (
                                      <span key={index} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                                        {audience}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {video.learningContent.difficultyLevel && (
                                <div>
                                  <h4 className="font-medium text-gray-800 mb-2">Difficulty:</h4>
                                  <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-full">
                                    {video.learningContent.difficultyLevel}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* AI Analysis & Transcript */}
                        <div className="space-y-6">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                              🤖 AI Analysis
                            </h3>
                            <div className="bg-white p-4 rounded border max-h-96 overflow-y-auto">
                              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                                {video.aiAnalysis}
                              </pre>
                            </div>
                          </div>

                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                              📝 Full Transcript
                              <span className="text-sm font-normal text-gray-600">({video.transcriptLength} chars)</span>
                            </h3>
                            <div className="bg-white p-4 rounded border max-h-96 overflow-y-auto">
                              <p className="text-sm text-gray-700 leading-relaxed">
                                {video.transcript || 'No transcript available'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Pagination */}
            {data.pagination.totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-8">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={!data.pagination.hasPrev}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700"
                >
                  Previous
                </button>
                <span className="text-gray-600">
                  Page {data.pagination.page} of {data.pagination.totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={!data.pagination.hasNext}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg mb-2">No videos found</div>
            <p className="text-gray-400">Try adjusting your filters or process some videos first.</p>
          </div>
        )}
      </div>
    </div>
  );
}

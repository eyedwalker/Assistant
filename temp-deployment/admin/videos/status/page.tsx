'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface VideoStatus {
  vimeoId: string;
  title: string;
  description?: string;
  duration: number;
  url: string;
  thumbnailUrl?: string;
  createdAt: string;
  isProcessed: boolean;
  processedAt?: string;
  hasTranscript: boolean;
  hasAIAnalysis: boolean;
  vspProduct?: string;
  transcriptLength: number;
}

interface VideoStatusResponse {
  success: boolean;
  data: {
    videos: VideoStatus[];
    pagination: {
      page: number;
      limit: number;
      totalVideos: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    summary: {
      total: number;
      processed: number;
      unprocessed: number;
      withTranscript: number;
      withAIAnalysis: number;
    };
  };
}

export default function VideoStatusPage() {
  const [data, setData] = useState<VideoStatusResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'processed' | 'unprocessed'>('all');

  useEffect(() => {
    setCurrentPage(1);
    fetchVideos(1);
  }, [search]);

  useEffect(() => {
    fetchVideos(currentPage);
  }, [currentPage]);

  const fetchVideos = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '25');
      if (search) params.append('search', search);
      
      const response = await fetch(`/api/videos/vimeo-status?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Error fetching video status:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredVideos = data?.videos.filter(video => {
    if (filter === 'processed') return video.isProcessed;
    if (filter === 'unprocessed') return !video.isProcessed;
    return true;
  }) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">📹 Vimeo Video Status</h1>
              <p className="text-gray-600">View all Vimeo videos and their processing status</p>
            </div>
            <Link
              href="/"
              className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 flex items-center space-x-2"
            >
              <span>←</span>
              <span>Back to Menu</span>
            </Link>
          </div>
        </div>

        {/* Stats Dashboard */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-blue-600">{data.summary.total}</div>
              <div className="text-sm text-gray-600">Total Videos</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-green-600">{data.summary.processed}</div>
              <div className="text-sm text-gray-600">Processed</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-red-600">{data.summary.unprocessed}</div>
              <div className="text-sm text-gray-600">Unprocessed</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-purple-600">{data.summary.withTranscript}</div>
              <div className="text-sm text-gray-600">With Transcript</div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search videos..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Videos</option>
                <option value="processed">Processed Only</option>
                <option value="unprocessed">Unprocessed Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Videos List */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : data && filteredVideos.length > 0 ? (
          <div className="space-y-4">
            {filteredVideos.map((video) => (
              <div key={video.vimeoId} className={`bg-white rounded-lg shadow overflow-hidden border-l-4 ${
                video.isProcessed ? 'border-green-500' : 'border-red-500'
              }`}>
                <div className="p-6">
                  <div className="flex items-start gap-6">
                    {/* Thumbnail */}
                    {video.thumbnailUrl && (
                      <div className="flex-shrink-0">
                        <img 
                          src={video.thumbnailUrl} 
                          alt={video.title}
                          className="w-32 h-20 object-cover rounded"
                        />
                      </div>
                    )}
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {video.title}
                        </h3>
                        <div className="flex items-center gap-2 ml-4">
                          <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                            video.isProcessed 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {video.isProcessed ? '✓ Processed' : '⏳ Not Processed'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                        <span>📹 {formatDuration(video.duration)}</span>
                        <span>🆔 {video.vimeoId}</span>
                        <span>📅 {new Date(video.createdAt).toLocaleDateString()}</span>
                        {video.vspProduct && (
                          <span>🎯 {video.vspProduct}</span>
                        )}
                      </div>

                      {video.description && (
                        <p className="text-gray-700 text-sm mb-3 line-clamp-2">
                          {video.description}
                        </p>
                      )}

                      {/* Processing Status Details */}
                      <div className="flex items-center gap-4 text-sm">
                        <div className={`flex items-center gap-1 ${
                          video.hasTranscript ? 'text-green-600' : 'text-gray-400'
                        }`}>
                          {video.hasTranscript ? '✅' : '❌'} Transcript
                          {video.transcriptLength > 0 && (
                            <span className="text-gray-500">({video.transcriptLength} chars)</span>
                          )}
                        </div>
                        <div className={`flex items-center gap-1 ${
                          video.hasAIAnalysis ? 'text-green-600' : 'text-gray-400'
                        }`}>
                          {video.hasAIAnalysis ? '✅' : '❌'} AI Analysis
                        </div>
                        {video.processedAt && (
                          <span className="text-gray-500">
                            Processed: {new Date(video.processedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium text-center"
                      >
                        Watch Video
                      </a>
                      {video.isProcessed && (
                        <a
                          href={`/admin/videos/results?search=${encodeURIComponent(video.title)}`}
                          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm font-medium text-center"
                        >
                          View Analysis
                        </a>
                      )}
                    </div>
                  </div>
                </div>
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
            <p className="text-gray-400">Try adjusting your search or filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}

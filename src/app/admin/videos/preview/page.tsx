'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface ProcessedVideo {
  id: string;
  name: string;
  description: string;
  duration: number;
  thumbnail: string;
  tags: string[];
  created_time: string;
  processed: boolean;
  processingStatus: string;
  processedAt?: string;
  aiSummary?: string;
  keyInsights?: string[];
  suggestedCategory?: string;
  transcript?: string;
  transcriptStatus: string;
  topics?: string[];
  confidence?: number;
}

interface Tag {
  name: string;
  count: number;
}

export default function VideoPreviewPage() {
  const { data: session, status } = useSession();
  const [videos, setVideos] = useState<ProcessedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<ProcessedVideo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (status === 'loading') return;
    fetchTags();
    fetchVideos();
  }, [status, page, searchQuery, selectedTags, statusFilter]);

  const fetchTags = async () => {
    try {
      const response = await fetch('/api/videos/tags');
      if (response.ok) {
        const data = await response.json();
        setAvailableTags(data.tags);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        query: searchQuery,
        tags: selectedTags.join(',')
      });

      const response = await fetch(`/api/videos/processed?${params}`);
      if (response.ok) {
        const data = await response.json();
        
        // Filter by processing status
        let filtered = data.videos;
        if (statusFilter === 'processed') {
          filtered = data.videos.filter((v: ProcessedVideo) => v.processed);
        } else if (statusFilter === 'unprocessed') {
          filtered = data.videos.filter((v: ProcessedVideo) => !v.processed);
        }
        
        setVideos(filtered);
        setTotalPages(Math.ceil(data.pagination.total / data.pagination.perPage));
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (tagName: string) => {
    setSelectedTags(prev => 
      prev.includes(tagName) 
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    );
    setPage(1);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCategoryColor = (category: string | undefined) => {
    const colors: Record<string, string> = {
      'patient-management': 'bg-blue-100 text-blue-800',
      'contact-lens-procedures': 'bg-purple-100 text-purple-800',
      'billing-claims': 'bg-green-100 text-green-800',
      'eyefinity-training': 'bg-orange-100 text-orange-800',
      'general-eyecare': 'bg-gray-100 text-gray-800'
    };
    return colors[category || ''] || 'bg-gray-100 text-gray-800';
  };

  const getStatusBadge = (video: ProcessedVideo) => {
    if (video.processed) {
      return (
        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
          ✅ Processed
        </span>
      );
    }
    switch (video.processingStatus) {
      case 'processing':
        return (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
            ⏳ Processing
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">
            ❌ Failed
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">
            ⚪ Not Processed
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">🎞️ Vimeo Video Preview</h1>
              <p className="text-gray-600">Browse and preview processed Vimeo training videos with AI insights</p>
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
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <input
              type="text"
              placeholder="Search videos..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Videos</option>
              <option value="processed">Processed Only</option>
              <option value="unprocessed">Unprocessed Only</option>
            </select>

            <button
              onClick={() => setShowTagFilter(!showTagFilter)}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              {showTagFilter ? 'Hide Tags' : 'Filter by Tags'}
            </button>
          </div>

          {/* Tag Filter */}
          {showTagFilter && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex flex-wrap gap-2">
                {availableTags.slice(0, 30).map((tag) => (
                  <button
                    key={tag.name}
                    onClick={() => toggleTag(tag.name)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      selectedTags.includes(tag.name)
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {tag.name} ({tag.count})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Video Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-500">Loading videos...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <div
                key={video.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedVideo(video)}
              >
                <div className="relative">
                  <img
                    src={video.thumbnail}
                    alt={video.name}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm">
                    {formatDuration(video.duration)}
                  </div>
                </div>
                
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                    {video.name}
                  </h3>
                  
                  <div className="flex items-center justify-between mb-2">
                    {getStatusBadge(video)}
                    {video.confidence > 0 && (
                      <span className="text-xs text-gray-500">
                        {Math.round(video.confidence * 100)}% confidence
                      </span>
                    )}
                  </div>

                  {video.suggestedCategory && (
                    <div className={`inline-block px-2 py-1 rounded text-xs mb-2 ${getCategoryColor(video.suggestedCategory)}`}>
                      {video.suggestedCategory.replace(/-/g, ' ')}
                    </div>
                  )}

                  {video.processed && video.aiSummary && (
                    <p className="text-sm text-gray-600 line-clamp-3">
                      {video.aiSummary}
                    </p>
                  )}

                  {video.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {video.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-4 py-2">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}

        {/* Video Detail Modal */}
        {selectedVideo && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
                <h2 className="text-xl font-bold">{selectedVideo.name}</h2>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <img
                      src={selectedVideo.thumbnail}
                      alt={selectedVideo.name}
                      className="w-full rounded-lg"
                    />
                  </div>
                  
                  <div>
                    <div className="mb-4">
                      <h3 className="font-semibold text-gray-700 mb-2">Status</h3>
                      {getStatusBadge(selectedVideo)}
                      {selectedVideo.processedAt && (
                        <p className="text-sm text-gray-500 mt-1">
                          Processed: {new Date(selectedVideo.processedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    {selectedVideo.suggestedCategory && (
                      <div className="mb-4">
                        <h3 className="font-semibold text-gray-700 mb-2">AI Suggested Category</h3>
                        <span className={`inline-block px-3 py-1 rounded ${getCategoryColor(selectedVideo.suggestedCategory)}`}>
                          {selectedVideo.suggestedCategory.replace(/-/g, ' ')}
                        </span>
                      </div>
                    )}

                    {selectedVideo.topics && selectedVideo.topics.length > 0 && (
                      <div className="mb-4">
                        <h3 className="font-semibold text-gray-700 mb-2">Topics</h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedVideo.topics.map((topic) => (
                            <span
                              key={topic}
                              className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {selectedVideo.aiSummary && (
                  <div className="mb-6">
                    <h3 className="font-semibold text-gray-700 mb-2">AI Summary</h3>
                    <p className="text-gray-600 bg-gray-50 p-4 rounded-lg">
                      {selectedVideo.aiSummary}
                    </p>
                  </div>
                )}

                {selectedVideo.keyInsights && selectedVideo.keyInsights.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-semibold text-gray-700 mb-2">Key Insights</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {selectedVideo.keyInsights.map((insight, idx) => (
                        <li key={idx} className="text-gray-600">
                          {insight}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedVideo.transcript && (
                  <div className="mb-6">
                    <h3 className="font-semibold text-gray-700 mb-2">
                      Transcript 
                      <span className="ml-2 text-sm text-gray-500">
                        ({selectedVideo.transcriptStatus})
                      </span>
                    </h3>
                    <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                      <p className="text-gray-600 whitespace-pre-wrap">
                        {selectedVideo.transcript}
                      </p>
                    </div>
                  </div>
                )}

                {selectedVideo.tags.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedVideo.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

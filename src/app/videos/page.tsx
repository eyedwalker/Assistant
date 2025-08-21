'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Video {
  id: string;
  title: string;
  description: string;
  duration: number;
  thumbnail: string;
  link: string;
  createdAt: string;
  tags: string[];
}

interface Transcript {
  text: string;
  language: string;
  type: string;
}

interface Tag {
  name: string;
  count: number;
}

export default function VideosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [totalVideos, setTotalVideos] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagFilter, setShowTagFilter] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    searchVideos();
    fetchAvailableTags();
  }, [session, status, currentPage, selectedTags]);

  const fetchAvailableTags = async () => {
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

  const searchVideos = async (query: string = '') => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        q: query,
        page: currentPage.toString(),
        per_page: '12'
      });
      
      // Add selected tags to search params
      if (selectedTags.length > 0) {
        params.append('tags', selectedTags.join(','));
      }
      
      const response = await fetch(`/api/videos/search?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to search videos');
      }
      
      const data = await response.json();
      setVideos(data.videos);
      setTotalVideos(data.pagination.total);
    } catch (error) {
      console.error('Error searching videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    searchVideos(searchQuery);
  };

  const toggleTag = (tagName: string) => {
    setSelectedTags(prev => 
      prev.includes(tagName) 
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    );
    setCurrentPage(1);
  };

  const clearTagFilters = () => {
    setSelectedTags([]);
    setCurrentPage(1);
  };

  const fetchTranscript = async (videoId: string) => {
    try {
      setLoadingTranscript(true);
      setTranscript(null);
      
      const response = await fetch(`/api/videos/${videoId}/transcript`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch transcript');
      }
      
      const data = await response.json();
      setTranscript(data.transcript);
    } catch (error) {
      console.error('Error fetching transcript:', error);
    } finally {
      setLoadingTranscript(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Vimeo Video Library</h1>
      
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search videos..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
          <button
            type="button"
            onClick={() => setShowTagFilter(!showTagFilter)}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            {showTagFilter ? 'Hide Tags' : 'Filter by Tags'}
          </button>
        </div>
      </form>

      {/* Tag Filter */}
      {showTagFilter && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-700">Filter by Tags</h3>
            {selectedTags.length > 0 && (
              <button
                onClick={clearTagFilters}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear all ({selectedTags.length})
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {availableTags.length > 0 ? (
              availableTags.map((tag) => (
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
              ))
            ) : (
              <div className="text-gray-500">Loading tags...</div>
            )}
          </div>
        </div>
      )}

      {/* Selected Tags Display */}
      {selectedTags.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-gray-600">Active filters:</span>
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-1"
              >
                {tag}
                <button
                  onClick={() => toggleTag(tag)}
                  className="hover:text-blue-900"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Video Count */}
      <div className="mb-4 text-gray-600">
        Found {totalVideos} videos
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {videos.map((video) => (
          <div
            key={video.id}
            className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => {
              setSelectedVideo(video);
              fetchTranscript(video.id);
            }}
          >
            {video.thumbnail && (
              <img
                src={video.thumbnail}
                alt={video.title}
                className="w-full h-48 object-cover"
              />
            )}
            <div className="p-4">
              <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                {video.title}
              </h3>
              <p className="text-gray-600 text-sm line-clamp-2 mb-2">
                {video.description || 'No description'}
              </p>
              <div className="flex justify-between items-center text-sm text-gray-500">
                <span>{formatDuration(video.duration)}</span>
                <span>{new Date(video.createdAt).toLocaleDateString()}</span>
              </div>
              {video.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {video.tags.slice(0, 3).map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
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

      {/* Pagination */}
      {totalVideos > 12 && (
        <div className="flex justify-center gap-2 mb-8">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1 || loading}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2">
            Page {currentPage} of {Math.ceil(totalVideos / 12)}
          </span>
          <button
            onClick={() => setCurrentPage(p => p + 1)}
            disabled={currentPage >= Math.ceil(totalVideos / 12) || loading}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Video Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold">{selectedVideo.title}</h2>
                <button
                  onClick={() => {
                    setSelectedVideo(null);
                    setTranscript(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Video Player */}
              <div className="mb-6">
                <div className="aspect-w-16 aspect-h-9 bg-gray-100 rounded-lg overflow-hidden">
                  {selectedVideo.thumbnail && (
                    <img
                      src={selectedVideo.thumbnail}
                      alt={selectedVideo.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="mt-4">
                  <a
                    href={selectedVideo.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Watch on Vimeo
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>

              {/* Transcript Section */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-4">Transcript</h3>
                {loadingTranscript ? (
                  <div className="text-gray-500">Loading transcript...</div>
                ) : transcript ? (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="mb-2 text-sm text-gray-600">
                      Language: {transcript.language} | Type: {transcript.type}
                    </div>
                    <div className="prose max-w-none">
                      {transcript.text || 'No transcript text available'}
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500">
                    No transcript available for this video
                  </div>
                )}
              </div>

              {/* Video Details */}
              <div className="border-t pt-4 mt-4">
                <h3 className="text-lg font-semibold mb-2">Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Duration:</span> {formatDuration(selectedVideo.duration)}
                  </div>
                  <div>
                    <span className="font-medium">Created:</span> {new Date(selectedVideo.createdAt).toLocaleDateString()}
                  </div>
                  {selectedVideo.tags.length > 0 && (
                    <div className="col-span-2">
                      <span className="font-medium">Tags:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedVideo.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
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
          </div>
        </div>
      )}
    </div>
  );
}

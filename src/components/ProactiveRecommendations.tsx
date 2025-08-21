'use client';

import { useState, useEffect } from 'react';
import { ChevronRightIcon, PlayIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface Video {
  id: string;
  title: string;
  link: string;
  thumbnail?: string;
  duration: string;
  summary?: string;
  relevanceScore: string;
  vspProduct: string;
  difficulty: string;
}

interface Recommendation {
  topic: string;
  reason: string;
  videos: Video[];
}

interface ProactiveRecommendationsProps {
  pageContext?: {
    url?: string;
    title?: string;
    pageType?: string;
    activity?: string;
    userRole?: string;
    product?: string;
  };
  className?: string;
  position?: 'top' | 'sidebar' | 'inline';
}

export default function ProactiveRecommendations({ 
  pageContext, 
  className = '',
  position = 'inline'
}: ProactiveRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Disabled for now - causing excessive API calls with Bedrock errors
    // if (pageContext && !dismissed) {
    //   fetchRecommendations();
    // }
  }, [pageContext]);

  const fetchRecommendations = async () => {
    if (!pageContext) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/recommendations/proactive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pageContext }),
      });

      if (response.ok) {
        const result = await response.json();
        setRecommendations(result.recommendations || []);
        setExplanation(result.explanation || '');
      }
    } catch (error) {
      console.error('Failed to fetch proactive recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  const handleVideoClick = (video: Video) => {
    // Track engagement for analytics
    console.log('🎥 Proactive recommendation clicked:', video.title);
    window.open(video.link, '_blank');
  };

  if (dismissed || loading || recommendations.length === 0) {
    return null;
  }

  const containerClasses = `
    ${className}
    ${position === 'top' ? 'fixed top-4 right-4 z-50 max-w-md' : ''}
    ${position === 'sidebar' ? 'w-full' : ''}
    ${position === 'inline' ? 'w-full' : ''}
  `;

  return (
    <div className={containerClasses}>
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-blue-200">
          <div className="flex items-center space-x-2">
            <div className="bg-blue-100 rounded-full p-1">
              <PlayIcon className="h-4 w-4 text-blue-600" />
            </div>
            <h3 className="font-semibold text-blue-900 text-sm">
              💡 Recommended Training
            </h3>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 hover:bg-blue-100 rounded text-blue-600"
            >
              <ChevronRightIcon className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-blue-100 rounded text-blue-600"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {explanation && (
            <p className="text-sm text-blue-800 mb-3">
              {explanation}
            </p>
          )}

          {/* Quick Preview */}
          {!expanded && recommendations.length > 0 && (
            <div className="space-y-2">
              {recommendations.slice(0, 1).map((rec, idx) => (
                <div key={idx} className="bg-white rounded p-3 border border-blue-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900 text-sm">{rec.topic}</span>
                    <span className="text-xs text-blue-600">{rec.videos.length} video{rec.videos.length !== 1 ? 's' : ''}</span>
                  </div>
                  {rec.videos[0] && (
                    <button
                      onClick={() => handleVideoClick(rec.videos[0])}
                      className="flex items-center space-x-2 w-full p-2 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                    >
                      {rec.videos[0].thumbnail && (
                        <img 
                          src={rec.videos[0].thumbnail} 
                          alt={rec.videos[0].title}
                          className="w-12 h-8 object-cover rounded"
                        />
                      )}
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-gray-900 line-clamp-1">
                          {rec.videos[0].title}
                        </p>
                        <p className="text-xs text-gray-600">
                          {rec.videos[0].duration} • {rec.videos[0].difficulty}
                        </p>
                      </div>
                      <PlayIcon className="h-4 w-4 text-blue-600" />
                    </button>
                  )}
                </div>
              ))}
              {recommendations.length > 1 && (
                <button
                  onClick={() => setExpanded(true)}
                  className="w-full text-center text-sm text-blue-600 hover:text-blue-800 py-1"
                >
                  View {recommendations.length - 1} more recommendation{recommendations.length - 1 !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          )}

          {/* Expanded View */}
          {expanded && (
            <div className="space-y-4">
              {recommendations.map((rec, idx) => (
                <div key={idx} className="bg-white rounded-lg p-3 border border-blue-100">
                  <div className="mb-3">
                    <h4 className="font-medium text-gray-900 text-sm mb-1">{rec.topic}</h4>
                    <p className="text-xs text-gray-600">{rec.reason}</p>
                  </div>
                  
                  <div className="space-y-2">
                    {rec.videos.map((video, videoIdx) => (
                      <button
                        key={videoIdx}
                        onClick={() => handleVideoClick(video)}
                        className="flex items-center space-x-3 w-full p-2 bg-gray-50 hover:bg-blue-50 rounded transition-colors group"
                      >
                        {video.thumbnail && (
                          <img 
                            src={video.thumbnail} 
                            alt={video.title}
                            className="w-16 h-10 object-cover rounded"
                          />
                        )}
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-sm font-medium text-gray-900 line-clamp-2">
                            {video.title}
                          </p>
                          <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
                            <span>{video.duration}</span>
                            <span>•</span>
                            <span>{video.difficulty}</span>
                            <span>•</span>
                            <span>{video.relevanceScore} relevant</span>
                          </div>
                          <p className="text-xs text-blue-600">{video.vspProduct}</p>
                        </div>
                        <PlayIcon className="h-4 w-4 text-blue-600 group-hover:text-blue-800" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';

interface ContentItem {
  id: string;
  type: 'document' | 'video' | 'web';
  title: string;
  source: string;
  processedAt: string;
  lastUpdated: string;
  status: string;
  summary: string;
  keyTopics: string[];
  needsRefresh: boolean;
  metadata: any;
  hasEmbeddings: boolean;
}

interface CrawlJob {
  crawlJobId: string;
  baseUrl: string;
  status: string;
  createdAt: string;
  stats: {
    totalDiscovered: number;
    totalProcessed: number;
    totalFailed: number;
  };
  urls: Array<{
    url: string;
    status: string;
    selected: boolean;
    title?: string;
  }>;
}

export default function ContentManagementPage() {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState<any>({});
  const [crawlUrl, setCrawlUrl] = useState('');
  const [crawling, setCrawling] = useState(false);
  const [currentCrawlJob, setCurrentCrawlJob] = useState<CrawlJob | null>(null);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState<string | null>(null);

  useEffect(() => {
    fetchContent();
  }, [filter]);

  const fetchContent = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/content/management?type=${filter}`);
      const data = await response.json();
      if (data.success) {
        setContent(data.content);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch content:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCrawl = async () => {
    if (!crawlUrl) return;
    
    setCrawling(true);
    try {
      const response = await fetch('/api/content/site-crawler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: crawlUrl,
          maxDepth: 3,
          maxPages: 100
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setCurrentCrawlJob(data);
        setSelectedUrls(new Set(data.urls.filter((u: any) => u.selected).map((u: any) => u.url)));
      }
    } catch (error) {
      console.error('Crawl failed:', error);
    } finally {
      setCrawling(false);
    }
  };

  const handleProcessUrls = async () => {
    if (!currentCrawlJob || selectedUrls.size === 0) return;
    
    try {
      const response = await fetch('/api/content/site-crawler', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crawlJobId: currentCrawlJob.crawlJobId,
          selectedUrls: Array.from(selectedUrls)
        })
      });
      
      const data = await response.json();
      if (data.success) {
        alert(`Successfully queued ${selectedUrls.size} URLs for processing`);
        setCurrentCrawlJob(null);
        setSelectedUrls(new Set());
        fetchContent();
      }
    } catch (error) {
      console.error('Processing failed:', error);
    }
  };

  const handleRefresh = async (contentId: string, source: string) => {
    setRefreshing(contentId);
    try {
      const response = await fetch('/api/content/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentId, url: source })
      });
      
      if (response.ok) {
        fetchContent();
      }
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(null);
    }
  };

  const toggleUrlSelection = (url: string) => {
    const newSelected = new Set(selectedUrls);
    if (newSelected.has(url)) {
      newSelected.delete(url);
    } else {
      newSelected.add(url);
    }
    setSelectedUrls(newSelected);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'document':
        return '📄';
      case 'video':
        return '🎥';
      case 'web':
        return '🌐';
      default:
        return '📁';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <h1 className="text-3xl font-bold mb-8">Content Management Dashboard</h1>

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total Documents</p>
          <p className="text-2xl font-bold">{stats.totalDocuments || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total Videos</p>
          <p className="text-2xl font-bold">{stats.totalVideos || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Web Pages</p>
          <p className="text-2xl font-bold">{stats.totalWebPages || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Needs Refresh</p>
          <p className="text-2xl font-bold text-orange-600">{stats.needsRefresh || 0}</p>
        </div>
      </div>

      {/* Site Crawler */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h2 className="text-xl font-semibold mb-4">Site Crawler</h2>
        <div className="flex gap-4">
          <input
            type="url"
            value={crawlUrl}
            onChange={(e) => setCrawlUrl(e.target.value)}
            placeholder="Enter a URL to crawl (e.g., https://example.com)"
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleCrawl}
            disabled={crawling || !crawlUrl}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {crawling ? 'Crawling...' : 'Crawl Site'}
          </button>
        </div>

        {/* Crawl Results */}
        {currentCrawlJob && (
          <div className="mt-6 border-t pt-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">
                Discovered {currentCrawlJob.stats.totalDiscovered} URLs from {currentCrawlJob.baseUrl}
              </h3>
              <button
                onClick={handleProcessUrls}
                disabled={selectedUrls.size === 0}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                Process {selectedUrls.size} Selected URLs
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto border rounded p-2">
              {currentCrawlJob.urls.map((url) => (
                <div key={url.url} className="flex items-center gap-2 p-2 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedUrls.has(url.url)}
                    onChange={() => toggleUrlSelection(url.url)}
                    className="w-4 h-4"
                  />
                  <span className="flex-1 text-sm truncate">{url.url}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    url.status === 'processed' ? 'bg-green-100 text-green-800' :
                    url.status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {url.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content Filter */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          All Content
        </button>
        <button
          onClick={() => setFilter('document')}
          className={`px-4 py-2 rounded ${filter === 'document' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Documents
        </button>
        <button
          onClick={() => setFilter('video')}
          className={`px-4 py-2 rounded ${filter === 'video' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Videos
        </button>
        <button
          onClick={() => setFilter('web')}
          className={`px-4 py-2 rounded ${filter === 'web' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Web Pages
        </button>
      </div>

      {/* Content List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title/Source</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Processed</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Summary</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center">Loading...</td>
              </tr>
            ) : content.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">No content found</td>
              </tr>
            ) : (
              content.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-2xl">{getTypeIcon(item.type)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-sm">{item.title}</p>
                      <p className="text-xs text-gray-500 truncate max-w-xs">{item.source}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(item.processedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-700 line-clamp-2">{item.summary}</p>
                    {item.keyTopics.length > 0 && (
                      <div className="mt-1 flex gap-1 flex-wrap">
                        {item.keyTopics.slice(0, 3).map((topic, idx) => (
                          <span key={idx} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {topic}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <span className={`text-xs px-2 py-1 rounded inline-block ${
                        item.status === 'completed' ? 'bg-green-100 text-green-800' :
                        item.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {item.status}
                      </span>
                      {item.needsRefresh && (
                        <span className="text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded">
                          Needs Update
                        </span>
                      )}
                      {item.hasEmbeddings && (
                        <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded">
                          RAG Ready
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {item.type === 'web' && (
                      <button
                        onClick={() => handleRefresh(item.id, item.source)}
                        disabled={refreshing === item.id}
                        className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                      >
                        {refreshing === item.id ? 'Refreshing...' : 'Refresh'}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

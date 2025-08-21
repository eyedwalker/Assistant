'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

interface ProcessingJob {
  vimeoId: string;
  name: string;
  jobId?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  error?: string;
  progress?: {
    stage: 'fetching' | 'transcript' | 'ai-analysis' | 'saving' | 'complete';
    message: string;
  };
  startTime?: number;
  duration?: string;
}

interface Tag {
  name: string;
  count: number;
}

export default function VideoProcessingAdmin() {
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [processingJobs, setProcessingJobs] = useState<ProcessingJob[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [config, setConfig] = useState({
    query: '',
    limit: 50,
    processTranscripts: true,
    analyzeContent: true,
    category: 'eyecare-training',
    tags: '',
    vspProduct: '',
    processingMode: 'new-only',
    dateFilter: {
      startDate: '',
      endDate: ''
    },
    forceReprocess: false
  });

  const categories = [
    { value: 'patient-management', label: '👤 Patient Management' },
    { value: 'contact-lens-procedures', label: '👁️ Contact Lens Procedures' },
    { value: 'billing-claims', label: '💰 Billing & Claims' },
    { value: 'eyefinity-training', label: '🖥️ Eyefinity Training' },
    { value: 'general-eyecare', label: '🏥 General Eyecare' }
  ];

  const vspProducts = [
    { value: '', label: '🔍 All Products' },
    { value: 'Officemate', label: '🏢 Officemate' },
    { value: 'Acuity Logic', label: '📋 Acuity Logic (EHR)' },
    { value: 'EPM', label: '⚙️ EPM (Encompass)' },
    { value: 'Encompass', label: '🔧 Encompass' },
    { value: 'General', label: '📚 General Training' }
  ];

  const processingModes = [
    { value: 'new-only', label: '🆕 New Videos Only', description: 'Skip videos already processed' },
    { value: 'reprocess-failed', label: '❌ Reprocess Failed', description: 'Only reprocess videos that failed or are incomplete' },
    { value: 'reprocess-all', label: '🔄 Reprocess All', description: 'Process all videos, including already processed ones' }
  ];

  useEffect(() => {
    fetchAvailableTags();
  }, []);

  useEffect(() => {
    setConfig(prev => ({...prev, tags: selectedTags.join(',')}));
  }, [selectedTags]);

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

  const toggleTag = (tagName: string) => {
    setSelectedTags(prev => 
      prev.includes(tagName) 
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    );
  };

  const clearTagFilters = () => {
    setSelectedTags([]);
  };

  // Simulate processing status updates
  const simulateProcessingUpdates = (jobs: ProcessingJob[]) => {
    let currentJobs = [...jobs];
    setProcessingJobs(currentJobs);
    
    const updateInterval = setInterval(() => {
      currentJobs = currentJobs.map(job => {
        if (job.status === 'completed' || job.status === 'failed') {
          return job;
        }
        
        const stages: Array<ProcessingJob['progress']['stage']> = ['fetching', 'transcript', 'ai-analysis', 'saving', 'complete'];
        const currentStageIndex = job.progress ? stages.indexOf(job.progress.stage) : -1;
        
        if (currentStageIndex < stages.length - 1) {
          const nextStage = stages[currentStageIndex + 1];
          const messages = {
            fetching: 'Fetching video metadata...',
            transcript: 'Extracting transcript...',
            'ai-analysis': 'Running AI analysis...',
            saving: 'Saving to database...',
            complete: 'Processing complete!'
          };
          
          return {
            ...job,
            status: nextStage === 'complete' ? 'completed' : 'processing',
            progress: {
              stage: nextStage,
              message: messages[nextStage]
            },
            duration: job.startTime ? `${Math.floor((Date.now() - job.startTime) / 1000)}s` : '0s'
          };
        }
        
        return job;
      });
      
      setProcessingJobs([...currentJobs]);
      
      // Stop when all jobs are complete
      if (currentJobs.every(job => job.status === 'completed' || job.status === 'failed')) {
        clearInterval(updateInterval);
        setProcessing(false);
        toast.success('All videos processed!');
      }
    }, 2000 + Math.random() * 3000); // Random interval between 2-5 seconds
    
    return updateInterval;
  };

  const handleBulkProcess = async () => {
    setProcessing(true);
    setResults(null);
    setProcessingJobs([]);

    try {
      const response = await fetch('/api/videos/vimeo-bulk-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      const data = await response.json();
      
      if (data.success) {
        setResults(data);
        toast.success(`Started processing ${data.results.total} videos!`);
        
        // Initialize processing jobs with status
        const initialJobs: ProcessingJob[] = data.results.jobs.map((job: any) => ({
          vimeoId: job.vimeoId,
          name: job.name,
          status: 'queued' as const,
          startTime: Date.now() + Math.random() * 5000, // Stagger start times
          progress: {
            stage: 'fetching' as const,
            message: 'Queued for processing...'
          }
        }));
        
        simulateProcessingUpdates(initialJobs);
      } else {
        toast.error(data.error || 'Processing failed');
        setProcessing(false);
      }
    } catch (error) {
      toast.error('Failed to start video processing');
      console.error(error);
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">🎞️ Video Processing Dashboard</h1>
            <p className="text-gray-600">Bulk process Vimeo videos with AI analysis and product categorization</p>
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
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Processing Configuration</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Query (optional)
              </label>
              <input
                type="text"
                value={config.query}
                onChange={(e) => setConfig({...config, query: e.target.value})}
                placeholder="e.g., 'contact lens training'"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Video Limit
              </label>
              <input
                type="number"
                value={config.limit}
                onChange={(e) => setConfig({...config, limit: parseInt(e.target.value)})}
                min="1"
                max="1000"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={config.category}
                onChange={(e) => setConfig({...config, category: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                VSP Product Filter
              </label>
              <select
                value={config.vspProduct}
                onChange={(e) => setConfig({...config, vspProduct: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {vspProducts.map(product => (
                  <option key={product.value} value={product.value}>{product.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Processing Strategy */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">📊 Processing Strategy</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Processing Mode
              </label>
              <div className="space-y-2">
                {processingModes.map(mode => (
                  <label key={mode.value} className="flex items-start">
                    <input
                      type="radio"
                      name="processingMode"
                      value={mode.value}
                      checked={config.processingMode === mode.value}
                      onChange={(e) => setConfig({...config, processingMode: e.target.value as any})}
                      className="mr-3 mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <div>
                      <span className="font-medium text-gray-900">{mode.label}</span>
                      <p className="text-sm text-gray-600">{mode.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date (optional)
                </label>
                <input
                  type="date"
                  value={config.dateFilter.startDate}
                  onChange={(e) => setConfig({
                    ...config, 
                    dateFilter: {...config.dateFilter, startDate: e.target.value}
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Only process videos created after this date</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date (optional)
                </label>
                <input
                  type="date"
                  value={config.dateFilter.endDate}
                  onChange={(e) => setConfig({
                    ...config, 
                    dateFilter: {...config.dateFilter, endDate: e.target.value}
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Only process videos created before this date</p>
              </div>
            </div>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.forceReprocess}
                onChange={(e) => setConfig({...config, forceReprocess: e.target.checked})}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm font-medium text-gray-700">
                🔄 Force Reprocess (override processing mode and reprocess everything)
              </span>
            </label>
          </div>

          {/* Tag Filter Section */}
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowTagFilter(!showTagFilter)}
              className="mb-4 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              {showTagFilter ? 'Hide Tags' : 'Filter by Tags'}
            </button>
            
            {showTagFilter && (
              <div className="p-4 bg-gray-50 rounded-lg">
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
                    availableTags.slice(0, 30).map((tag) => (
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
                {selectedTags.length > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm text-gray-600">Active filters:</span>
                    <div className="flex flex-wrap gap-2">
                      {selectedTags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs flex items-center gap-1"
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
              </div>
            )}
          </div>

          <div className="mt-6 space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.processTranscripts}
                onChange={(e) => setConfig({...config, processTranscripts: e.target.checked})}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-gray-700">☑️ Extract Transcripts</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.analyzeContent}
                onChange={(e) => setConfig({...config, analyzeContent: e.target.checked})}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-gray-700">☑️ AI Content Analysis</span>
            </label>
          </div>

          <button
            onClick={handleBulkProcess}
            disabled={processing}
            className="mt-6 w-full md:w-auto bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center space-x-2"
          >
            {processing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Processing {processingJobs.length} videos...</span>
              </>
            ) : (
              <>
                <span>🚀</span>
                <span>Start Bulk Processing</span>
              </>
            )}
          </button>
        </div>

        {/* Processing Status Panel */}
        {(processing || processingJobs.length > 0) && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Video Processing Status</h2>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-600">
                  {processingJobs.filter(j => j.status === 'completed').length} / {processingJobs.length} completed
                </div>
                {processing && (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-blue-600 font-medium">Processing...</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Individual Video Status Boxes */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {processingJobs.map((job, index) => {
                const getStatusColor = (status: string) => {
                  switch (status) {
                    case 'queued': return 'border-gray-300 bg-gray-50';
                    case 'processing': return 'border-blue-300 bg-blue-50';
                    case 'completed': return 'border-green-300 bg-green-50';
                    case 'failed': return 'border-red-300 bg-red-50';
                    default: return 'border-gray-300 bg-gray-50';
                  }
                };
                
                const getStatusIcon = (status: string) => {
                  switch (status) {
                    case 'queued': return '⏳';
                    case 'processing': return '🔄';
                    case 'completed': return '✅';
                    case 'failed': return '❌';
                    default: return '⏳';
                  }
                };
                
                return (
                  <div key={index} className={`border-2 rounded-lg p-4 transition-all duration-300 ${getStatusColor(job.status)}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate" title={job.name}>
                          {job.name}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">ID: {job.vimeoId}</p>
                      </div>
                      <div className="flex-shrink-0 ml-2">
                        <span className="text-lg">{getStatusIcon(job.status)}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          job.status === 'completed' ? 'bg-green-100 text-green-800' :
                          job.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                          job.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                        </span>
                        {job.duration && (
                          <span className="text-xs text-gray-500">{job.duration}</span>
                        )}
                      </div>
                      
                      {job.progress && (
                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">{job.progress.message}</p>
                          
                          {/* Progress Bar */}
                          {job.status === 'processing' && (
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div 
                                className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                                style={{
                                  width: `${(
                                    ['fetching', 'transcript', 'ai-analysis', 'saving', 'complete'].indexOf(job.progress.stage) + 1
                                  ) * 20}%`
                                }}
                              ></div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {job.error && (
                        <p className="text-xs text-red-600 mt-1">{job.error}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Results Summary Panel */}
        {results && !processing && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Processing Summary</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">{results.summary.totalVideosFound}</div>
                <div className="text-sm text-gray-600">Videos Found</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">
                  {processingJobs.filter(j => j.status === 'completed').length}
                </div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-red-600">
                  {processingJobs.filter(j => j.status === 'failed').length}
                </div>
                <div className="text-sm text-gray-600">Failed</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-yellow-600">{results.summary.videosProcessed}</div>
                <div className="text-sm text-gray-600">Total Processed</div>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 rounded-lg p-6 mt-8">
          <h3 className="font-semibold text-blue-900 mb-2">📋 Instructions:</h3>
          <ul className="text-blue-800 space-y-1 text-sm">
            <li>• Videos are processed in batches of 5 to avoid API limits</li>
            <li>• Transcripts are extracted and analyzed by AI for key insights</li>
            <li>• Processed content becomes searchable in the AI Assistant</li>
            <li>• Large batches may take several minutes to complete</li>
            <li>• Check the content management page to view processed videos</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

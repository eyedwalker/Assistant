'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';

interface ProcessingJob {
  vimeoId: string;
  name: string;
  jobId?: string;
  status: string;
  error?: string;
}

export default function VideoProcessingAdmin() {
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [config, setConfig] = useState({
    query: '',
    limit: 50,
    processTranscripts: true,
    analyzeContent: true,
    category: 'eyecare-training'
  });

  const categories = [
    { value: 'patient-management', label: '👤 Patient Management' },
    { value: 'contact-lens-procedures', label: '👁️ Contact Lens Procedures' },
    { value: 'billing-claims', label: '💰 Billing & Claims' },
    { value: 'eyefinity-training', label: '🖥️ Eyefinity Training' },
    { value: 'general-eyecare', label: '🏥 General Eyecare' }
  ];

  const handleBulkProcess = async () => {
    setProcessing(true);
    setResults(null);

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
      } else {
        toast.error(data.error || 'Processing failed');
      }
    } catch (error) {
      toast.error('Failed to start video processing');
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          🎥 Vimeo Video Processing Admin
        </h1>

        {/* Configuration Panel */}
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
                max="500"
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

            <div className="flex flex-col space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.processTranscripts}
                  onChange={(e) => setConfig({...config, processTranscripts: e.target.checked})}
                  className="mr-2"
                />
                Extract Transcripts
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.analyzeContent}
                  onChange={(e) => setConfig({...config, analyzeContent: e.target.checked})}
                  className="mr-2"
                />
                AI Content Analysis
              </label>
            </div>
          </div>

          <button
            onClick={handleBulkProcess}
            disabled={processing}
            className="mt-6 bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? '🔄 Processing...' : '🚀 Start Bulk Processing'}
          </button>
        </div>

        {/* Results Panel */}
        {results && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Processing Results</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{results.summary.totalVideosFound}</div>
                <div className="text-sm text-gray-600">Videos Found</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{results.summary.successful}</div>
                <div className="text-sm text-gray-600">Successful</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{results.summary.failed}</div>
                <div className="text-sm text-gray-600">Failed</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{results.summary.videosProcessed}</div>
                <div className="text-sm text-gray-600">Processed</div>
              </div>
            </div>

            {/* Job Details */}
            <div className="space-y-2">
              <h3 className="font-medium text-gray-900">Processing Jobs:</h3>
              {results.results.jobs.map((job: ProcessingJob, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <div>
                    <div className="font-medium">{job.name}</div>
                    <div className="text-sm text-gray-500">ID: {job.vimeoId}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {job.status === 'processing' && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                        🔄 Processing
                      </span>
                    )}
                    {job.error && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">
                        ❌ Error
                      </span>
                    )}
                  </div>
                </div>
              ))}
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

'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

export default function VideoTrainingPage() {
  const [videos, setVideos] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [batchJobId, setBatchJobId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<any>({});
  const [batchStatus, setBatchStatus] = useState<any>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setVideos(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm']
    },
    multiple: true
  });

  const handleUpload = async () => {
    if (videos.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    
    videos.forEach(video => {
      formData.append('videos', video);
    });
    
    formData.append('title', 'AI Training Videos');
    formData.append('description', 'Bulk video upload for AI training');
    formData.append('mode', 'training');

    try {
      const response = await fetch('/api/training/videos/bulk-upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      if (data.success) {
        setBatchJobId(data.batchJobId);
        setUploadProgress(data.jobs);
        
        // Start polling for status
        pollBatchStatus(data.batchJobId);
      } else {
        alert(`Upload failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload videos');
    } finally {
      setUploading(false);
    }
  };

  const pollBatchStatus = async (jobId: string) => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/training/videos/bulk-upload?batchJobId=${jobId}`);
        const data = await response.json();
        
        setBatchStatus(data);
        
        if (data.status !== 'completed') {
          setTimeout(checkStatus, 3000); // Check every 3 seconds
        }
      } catch (error) {
        console.error('Status check error:', error);
      }
    };
    
    checkStatus();
  };

  const removeVideo = (index: number) => {
    setVideos(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Video Training Center</h1>
      
      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
      >
        <input {...getInputProps()} />
        <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        {isDragActive ? (
          <p className="text-blue-600">Drop the videos here...</p>
        ) : (
          <div>
            <p className="text-gray-600 mb-2">Drag & drop videos here, or click to select</p>
            <p className="text-sm text-gray-400">Supports MP4, AVI, MOV, WMV, FLV, MKV, WebM</p>
          </div>
        )}
      </div>

      {/* Video List */}
      {videos.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-3">Selected Videos ({videos.length})</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {videos.map((video, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                <div className="flex items-center space-x-3">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <p className="font-medium text-sm">{video.name}</p>
                    <p className="text-xs text-gray-500">{(video.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  onClick={() => removeVideo(index)}
                  className="text-red-500 hover:text-red-700"
                  disabled={uploading}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Button */}
      {videos.length > 0 && !batchJobId && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className={`mt-6 w-full py-3 px-4 rounded-lg font-medium text-white transition-colors
            ${uploading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {uploading ? 'Uploading...' : `Upload ${videos.length} Video${videos.length > 1 ? 's' : ''} for Training`}
        </button>
      )}

      {/* Processing Status */}
      {batchJobId && batchStatus && (
        <div className="mt-6 bg-white border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Processing Status</h2>
          
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Overall Progress</span>
              <span>{batchStatus.successCount + batchStatus.failedCount}/{batchStatus.totalVideos}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((batchStatus.successCount + batchStatus.failedCount) / batchStatus.totalVideos) * 100}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{batchStatus.successCount}</p>
              <p className="text-sm text-gray-600">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{batchStatus.processingCount}</p>
              <p className="text-sm text-gray-600">Processing</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{batchStatus.failedCount}</p>
              <p className="text-sm text-gray-600">Failed</p>
            </div>
          </div>

          {/* Individual Job Status */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {batchStatus.jobs?.map((job: any, index: number) => (
              <div key={index} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                <span className="truncate flex-1">{job.filename}</span>
                <span className={`ml-2 px-2 py-1 rounded text-xs font-medium
                  ${job.status === 'completed' ? 'bg-green-100 text-green-800' : 
                    job.status === 'failed' ? 'bg-red-100 text-red-800' : 
                    'bg-yellow-100 text-yellow-800'}`}>
                  {job.status}
                </span>
              </div>
            ))}
          </div>

          {batchStatus.status === 'completed' && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
              <p className="text-green-800 font-medium">✅ All videos processed successfully!</p>
              <p className="text-green-700 text-sm mt-1">Your videos have been analyzed and added to the AI training database.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

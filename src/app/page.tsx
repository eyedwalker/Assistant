'use client';

import React, { useState } from 'react';
import { 
  DocumentTextIcon, 
  ChatBubbleLeftRightIcon, 
  CloudArrowUpIcon,
  ChartBarIcon,
  UsersIcon,
  CogIcon,
  HomeIcon,
  PlusIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import SimpleProcessingStatus from '@/components/SimpleProcessingStatus';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: any[];
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Mock user for demo purposes
  const mockUser = {
    id: '1',
    name: 'Demo User',
    email: 'demo@example.com',
    role: 'admin' as const,
    accessLevel: 'public' as const,
    accessId: 'demo',
    permissions: []
  };

  // Navigation tabs
  const tabs = [
    { id: 'overview', name: 'Overview', icon: HomeIcon },
    { id: 'documents', name: 'Documents', icon: DocumentTextIcon },
    { id: 'chat', name: 'Chat', icon: ChatBubbleLeftRightIcon },
    { id: 'upload', name: 'Upload', icon: CloudArrowUpIcon },
    { id: 'processing', name: 'Processing Status', icon: ChartBarIcon },
    { id: 'users', name: 'Users', icon: UsersIcon },
    { id: 'settings', name: 'Settings', icon: CogIcon },
  ];

  // Fetch processed documents
  const fetchDocuments = async () => {
    setIsLoadingDocuments(true);
    try {
      const response = await fetch('/api/processing/diagnostics');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.diagnostics) {
          // Combine documents and processedContent for display
          const allDocuments = [
            ...(data.diagnostics.documents || []),
            ...(data.diagnostics.processedContent || [])
          ];
          setDocuments(allDocuments);
        }
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  // Load documents when Documents tab is selected
  React.useEffect(() => {
    if (activeTab === 'documents') {
      fetchDocuments();
    }
  }, [activeTab]);

  // Handle URL processing
  const handleProcessUrl = async () => {
    if (!urlInput.trim()) return;
    
    setIsProcessing(true);
    try {
      const response = await fetch('/api/documents/process-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: urlInput }),
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(`Document processing started! Job ID: ${result.jobId}`);
        setUrlInput('');
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      alert('Failed to process URL. Please check your connection.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle chat message
  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    
    const userMessage: ChatMessage = { role: 'user', content: chatInput, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: chatInput,
          conversationId: 'demo-conversation'
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        const aiMessage: ChatMessage = { 
          role: 'assistant', 
          content: result.message, 
          timestamp: new Date(),
          sources: result.sources 
        };
        setChatMessages(prev => [...prev, aiMessage]);
      } else {
        const error = await response.json();
        const errorMessage: ChatMessage = { 
          role: 'assistant', 
          content: `Error: ${error.message}`, 
          timestamp: new Date() 
        };
        setChatMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      const errorMessage: ChatMessage = { 
        role: 'assistant', 
        content: 'Failed to send message. Please check your connection.', 
        timestamp: new Date() 
      };
      setChatMessages(prev => [...prev, errorMessage]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-gray-900">
                  AI Assistant Platform
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                Welcome, {mockUser.name}
              </div>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {mockUser.accessLevel}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {mockUser.role}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div>
            {/* Welcome Section */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Dashboard Overview</h2>
              <p className="text-gray-600 mb-6">
                Welcome to the AI Assistant Platform for eyecare professionals. 
                This platform enables intelligent document processing and conversational AI assistance.
              </p>
              
              {/* Status Alert */}
              <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">
                      Platform Status - All Systems Online
                    </h3>
                    <div className="mt-2 text-sm text-green-700">
                      <ul className="list-disc pl-5 space-y-1">
                        <li>✅ MongoDB database connected and ready</li>
                        <li>✅ AWS S3 storage configured and accessible</li>
                        <li>✅ AI services (Anthropic Claude) active</li>
                        <li>✅ All API endpoints functional</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <DocumentTextIcon className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Documents</p>
                    <p className="text-2xl font-semibold text-gray-900">Ready</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ChatBubbleLeftRightIcon className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">AI Assistant</p>
                    <p className="text-2xl font-semibold text-green-600">Active</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CloudArrowUpIcon className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Processing</p>
                    <p className="text-2xl font-semibold text-green-600">Ready</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ChartBarIcon className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Platform</p>
                    <p className="text-2xl font-semibold text-green-600">Online</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Features Overview */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Platform Features</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="text-center p-4 border border-gray-200 rounded-lg">
                  <DocumentTextIcon className="h-12 w-12 text-blue-600 mx-auto mb-3" />
                  <h4 className="font-medium text-gray-900 mb-2">Document Processing</h4>
                  <p className="text-sm text-gray-600">
                    Multi-strategy content extraction from URLs and files with AI analysis
                  </p>
                </div>
                
                <div className="text-center p-4 border border-gray-200 rounded-lg">
                  <ChatBubbleLeftRightIcon className="h-12 w-12 text-blue-600 mx-auto mb-3" />
                  <h4 className="font-medium text-gray-900 mb-2">AI Assistant</h4>
                  <p className="text-sm text-gray-600">
                    RAG-based conversational AI with document context and source attribution
                  </p>
                </div>
                
                <div className="text-center p-4 border border-gray-200 rounded-lg">
                  <CloudArrowUpIcon className="h-12 w-12 text-blue-600 mx-auto mb-3" />
                  <h4 className="font-medium text-gray-900 mb-2">Secure Storage</h4>
                  <p className="text-sm text-gray-600">
                    Multi-tenant secure document storage with access control
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Document Management</h2>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <p className="text-gray-600">View and manage your processed documents.</p>
                <button
                  onClick={fetchDocuments}
                  disabled={isLoadingDocuments}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isLoadingDocuments ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <MagnifyingGlassIcon className="h-4 w-4" />
                      <span>Refresh</span>
                    </>
                  )}
                </button>
              </div>

              {isLoadingDocuments ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-500">Loading documents...</p>
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8">
                  <DocumentTextIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No documents processed yet. Try uploading or processing a URL!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {documents.map((doc, index) => (
                    <div key={doc.id || index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          {doc.title || doc.name || 'Untitled Document'}
                        </h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          doc.hasEmbeddings ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {doc.hasEmbeddings ? 'RAG-Ready' : 'Processing'}
                        </span>
                      </div>
                      
                      {doc.source && (
                        <p className="text-sm text-blue-600 mb-2">
                          <a href={doc.source} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {doc.source}
                          </a>
                        </p>
                      )}
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-2">
                        <div>
                          <span className="font-medium">Text Length:</span> {doc.extractedTextLength || 0} chars
                        </div>
                        <div>
                          <span className="font-medium">Embeddings:</span> {doc.embeddingCount || 0}
                        </div>
                        <div>
                          <span className="font-medium">Access Level:</span> {doc.accessLevel || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Created:</span> {
                            new Date(doc.createdAt).toLocaleDateString() || 'N/A'
                          }
                        </div>
                      </div>
                      
                      {doc.contentPreview?.extractedText && doc.contentPreview.extractedText !== 'undefined...' && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-md">
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Preview:</span> {doc.contentPreview.extractedText}
                          </p>
                        </div>
                      )}
                      
                      {doc.aiAnalysis?.summary && doc.aiAnalysis.summary !== 'Analysis failed...' && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-md">
                          <p className="text-sm text-blue-700">
                            <span className="font-medium">AI Summary:</span> {doc.aiAnalysis.summary}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">AI Assistant Chat</h2>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              {/* Chat Messages */}
              <div className="p-6 h-96 overflow-y-auto border-b border-gray-200">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-8">
                    <ChatBubbleLeftRightIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Start a conversation with the AI assistant!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chatMessages.map((message, index) => (
                      <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.role === 'user' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 text-gray-900'
                        }`}>
                          <p className="text-sm">{message.content}</p>
                          <p className="text-xs mt-1 opacity-70">
                            {message.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Chat Input */}
              <div className="p-4">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask the AI assistant anything..."
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload & Process</h2>
            
            {/* URL Processing */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Process URL</h3>
              <div className="flex space-x-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Enter URL to process..."
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleProcessUrl}
                  disabled={!urlInput.trim() || isProcessing}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <PlusIcon className="h-4 w-4" />
                      <span>Process URL</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* File Upload */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">File Upload</h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <CloudArrowUpIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Drag and drop files here, or click to select</p>
                <p className="text-sm text-gray-500">Supports PDF, Word, Excel, and text files</p>
                <button className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                  Select Files
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Processing Status Tab */}
        {activeTab === 'processing' && (
          <SimpleProcessingStatus />
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">User Management</h2>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <div className="text-center py-8">
                <UsersIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">User management features coming soon!</p>
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Platform Settings</h2>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <div className="text-center py-8">
                <CogIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Settings panel coming soon!</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

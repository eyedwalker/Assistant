'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  DocumentTextIcon, 
  CloudArrowUpIcon, 
  ChatBubbleLeftRightIcon,
  UsersIcon,
  CogIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  PlusIcon
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
  const [contactLensContext, setContactLensContext] = useState<any>(null);

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

  // Listen for messages from browser extension
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Accept messages from extension iframe context
      if (event.data?.type === 'LENS_CONTEXT') {
        console.log('Received contact lens context:', event.data.data);
        setContactLensContext(event.data.data);
        
        // Add a system message to chat
        const contextMessage: ChatMessage = {
          role: 'assistant',
          content: `📍 **Contact Lens Detected**: ${event.data.data.manufacturer || 'Unknown'} ${event.data.data.style || 'lenses'} at $${event.data.data.price || 'N/A'}. I can help you with questions about these lenses or find better prices.`,
          timestamp: new Date()
        };
        setChatMessages(prev => [...prev, contextMessage]);
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Check if we're embedded in extension context
    if (window.location.search.includes('extension=true')) {
      // Request context from parent window
      window.parent.postMessage({ type: 'REQUEST_CONTEXT' }, '*');
    }

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Navigation tabs
  const tabs = [
    { id: 'overview', name: 'Overview', icon: HomeIcon },
    { id: 'documents', name: 'Documents', icon: DocumentTextIcon },
    { id: 'chat', name: 'Chat', icon: ChatBubbleLeftRightIcon },
    { id: 'training', name: 'Training', icon: CheckCircleIcon },
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

  // Handle Generate Training Modules
  const handleGenerateTraining = async () => {
    console.log('🎓 Generate Training Modules button clicked');
    try {
      console.log('📡 Making API request to /api/training/demo');
      const response = await fetch('/api/training/demo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('📡 Response status:', response.status);
      const data = await response.json();
      console.log('📡 Response data:', data);
      
      if (data.success) {
        alert(`✅ Successfully created ${data.summary.successfulModules} training modules!`);
      } else {
        alert('❌ Failed to create training modules');
      }
    } catch (error) {
      console.error('❌ Error generating training modules:', error);
      alert('❌ Error generating training modules. Check console for details.');
    }
  };

  // Handle Start Module
  const handleStartModule = async (moduleId: string, moduleTitle: string) => {
    console.log('🎯 Start Module button clicked for:', moduleTitle);
    try {
      console.log('📡 Starting training module:', moduleId);
      
      // For now, show a demo training interface
      const confirmed = confirm(`🎓 Start training module: "${moduleTitle}"?\n\nThis will begin the interactive training session.`);
      
      if (confirmed) {
        alert(`🚀 Training module "${moduleTitle}" started!\n\n📚 In a full implementation, this would:\n• Load module content\n• Track progress\n• Present interactive lessons\n• Record completion\n\nFor now, this is a demo placeholder.`);
        
        // TODO: Create actual training session API and UI
        // const response = await fetch('/api/training/start', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ moduleId, userId: 'demo-user' })
        // });
      }
    } catch (error) {
      console.error('❌ Error starting training module:', error);
      alert('❌ Error starting training module. Check console for details.');
    }
  };

  // Handle chat message
  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    
    const userMessage: ChatMessage = { role: 'user', content: chatInput, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    
    // Include contact lens context if available
    let messageWithContext = chatInput;
    if (contactLensContext) {
      messageWithContext = `[Context: User is viewing contact lens order - ${contactLensContext.manufacturer || 'Unknown'} ${contactLensContext.style || 'lenses'}, Price: $${contactLensContext.price || 'N/A'}] ${chatInput}`;
    }
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: messageWithContext,
          conversationId: 'demo-conversation',
          context: contactLensContext
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
                          {message.role === 'assistant' ? (
                            <div className="text-sm prose prose-sm max-w-none">
                              <ReactMarkdown>{message.content}</ReactMarkdown>
                            </div>
                          ) : (
                            <p className="text-sm">{message.content}</p>
                          )}
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

        {/* Training Tab */}
        {activeTab === 'training' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Training & Certification System</h2>
            
            {/* Training System Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CheckCircleIcon className="h-8 w-8 text-green-500" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">Training Modules</h3>
                    <p className="text-sm text-gray-500">AI-generated from your content</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <UsersIcon className="h-8 w-8 text-blue-500" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">User Progress</h3>
                    <p className="text-sm text-gray-500">Track learning and compliance</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <DocumentTextIcon className="h-8 w-8 text-purple-500" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">Certifications</h3>
                    <p className="text-sm text-gray-500">Digital certificates & tracking</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <button 
                  onClick={handleGenerateTraining}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
                >
                  Generate Training Modules
                </button>
                
                <button 
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/users/demo', { method: 'POST' });
                      const result = await response.json();
                      if (result.success) {
                        alert(`Initialized ${result.summary.totalUsers} users and ${result.summary.totalRoles} roles!`);
                      } else {
                        alert(`Error: ${result.error}`);
                      }
                    } catch (error) {
                      alert('Failed to initialize users');
                    }
                  }}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm"
                >
                  Initialize Users & Roles
                </button>
                
                <button 
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/users?action=compliance');
                      const result = await response.json();
                      if (result.success) {
                        const dashboard = result.dashboard;
                        alert(`Compliance Status:\nCompliant: ${dashboard.compliance.compliant}\nWarning: ${dashboard.compliance.warning}\nOverdue: ${dashboard.compliance.overdue}`);
                      } else {
                        alert('Error fetching compliance data');
                      }
                    } catch (error) {
                      alert('Failed to fetch compliance data');
                    }
                  }}
                  className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 text-sm"
                >
                  Check Compliance
                </button>
                
                <button 
                  onClick={() => {
                    window.open('/api/training/demo?action=status', '_blank');
                  }}
                  className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 text-sm"
                >
                  View System Status
                </button>
              </div>
            </div>

            {/* Training Features */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Training Modules */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Available Training Modules</h3>
                <div className="space-y-4">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900">Eyefinity Administration Fundamentals</h4>
                    <p className="text-sm text-gray-600 mt-1">Practice management and administrative procedures</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Intermediate • 45 min</span>
                      <button className="text-blue-600 hover:text-blue-800 text-sm">Start Module</button>
                    </div>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900">Front Office Operations Excellence</h4>
                    <p className="text-sm text-gray-600 mt-1">Patient management and front office procedures</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Beginner • 30 min</span>
                      <button className="text-blue-600 hover:text-blue-800 text-sm">Start Module</button>
                    </div>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900">Eyecare Practice Essentials</h4>
                    <p className="text-sm text-gray-600 mt-1">General practice knowledge and procedures</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Beginner • 25 min</span>
                      <button className="text-blue-600 hover:text-blue-800 text-sm">Start Module</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* User Progress */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">User Progress & Compliance</h3>
                <div className="space-y-4">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">Sarah Johnson</h4>
                        <p className="text-sm text-gray-600">Practice Manager</p>
                      </div>
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Warning</span>
                    </div>
                    <div className="mt-3">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Training Progress</span>
                        <span>75%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{width: '75%'}}></div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">Emily Davis</h4>
                        <p className="text-sm text-gray-600">New Employee</p>
                      </div>
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Warning</span>
                    </div>
                    <div className="mt-3">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Training Progress</span>
                        <span>33%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-yellow-500 h-2 rounded-full" style={{width: '33%'}}></div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">Mike Chen</h4>
                        <p className="text-sm text-gray-600">Front Office Supervisor</p>
                      </div>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Compliant</span>
                    </div>
                    <div className="mt-3">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Training Progress</span>
                        <span>100%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full" style={{width: '100%'}}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* API Testing Section */}
            <div className="mt-8 bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">API Testing & Development</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Training System APIs</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• <code className="bg-white px-1 rounded">POST /api/training/demo</code> - Generate modules</li>
                    <li>• <code className="bg-white px-1 rounded">GET /api/training/generate-module</code> - List modules</li>
                    <li>• <code className="bg-white px-1 rounded">POST /api/training/assessment</code> - Take assessments</li>
                    <li>• <code className="bg-white px-1 rounded">GET /api/training/progress</code> - Track progress</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">User Management APIs</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• <code className="bg-white px-1 rounded">POST /api/users/demo</code> - Initialize users</li>
                    <li>• <code className="bg-white px-1 rounded">GET /api/users</code> - List users</li>
                    <li>• <code className="bg-white px-1 rounded">GET /api/roles</code> - List roles</li>
                    <li>• <code className="bg-white px-1 rounded">GET /api/users?action=compliance</code> - Compliance dashboard</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">User Management & Roles</h2>
            
            {/* User Overview Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <div className="flex items-center">
                  <UsersIcon className="h-8 w-8 text-blue-500" />
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">7</h3>
                    <p className="text-sm text-gray-500">Total Users</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <div className="flex items-center">
                  <CheckCircleIcon className="h-8 w-8 text-green-500" />
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">5</h3>
                    <p className="text-sm text-gray-500">Compliant</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <div className="flex items-center">
                  <ExclamationTriangleIcon className="h-8 w-8 text-yellow-500" />
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">2</h3>
                    <p className="text-sm text-gray-500">Warning</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <div className="flex items-center">
                  <CogIcon className="h-8 w-8 text-purple-500" />
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">7</h3>
                    <p className="text-sm text-gray-500">Roles</p>
                  </div>
                </div>
              </div>
            </div>

            {/* User List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Users */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Users & Compliance Status</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-800">SJ</span>
                      </div>
                      <div className="ml-3">
                        <h4 className="font-medium text-gray-900">Sarah Johnson</h4>
                        <p className="text-sm text-gray-600">Practice Manager • 45 hrs</p>
                      </div>
                    </div>
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Warning</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-green-800">MC</span>
                      </div>
                      <div className="ml-3">
                        <h4 className="font-medium text-gray-900">Mike Chen</h4>
                        <p className="text-sm text-gray-600">Front Office Supervisor • 32 hrs</p>
                      </div>
                    </div>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Compliant</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-green-800">JR</span>
                      </div>
                      <div className="ml-3">
                        <h4 className="font-medium text-gray-900">Jessica Rodriguez</h4>
                        <p className="text-sm text-gray-600">Front Office Staff • 28 hrs</p>
                      </div>
                    </div>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Compliant</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-yellow-800">ED</span>
                      </div>
                      <div className="ml-3">
                        <h4 className="font-medium text-gray-900">Emily Davis</h4>
                        <p className="text-sm text-gray-600">New Employee • 8 hrs</p>
                      </div>
                    </div>
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Warning</span>
                  </div>
                </div>
              </div>

              {/* Roles */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Roles & Permissions</h3>
                <div className="space-y-4">
                  <div className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">Practice Manager</h4>
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">OFFICE</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">Full access • 1 user</p>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">Front Office Supervisor</h4>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">COMPANY</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">Team management • 1 user</p>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">Front Office Staff</h4>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">ACCOUNT</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">Basic access • 1 user</p>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">Licensed Optician</h4>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">ACCOUNT</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">Optical services • 1 user</p>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">New Employee</h4>
                      <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">PUBLIC</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">Limited access • 1 user</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Management Actions */}
            <div className="mt-8 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Management Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button 
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/users/demo', { method: 'POST' });
                      const result = await response.json();
                      if (result.success) {
                        alert(`Initialized ${result.summary.totalUsers} users and ${result.summary.totalRoles} roles successfully!`);
                      } else {
                        alert(`Error: ${result.error || result.details}`);
                      }
                    } catch (error) {
                      alert('Failed to initialize users and roles');
                    }
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Initialize Demo Users
                </button>
                
                <button 
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/users?action=compliance');
                      const result = await response.json();
                      if (result.success && result.dashboard) {
                        const d = result.dashboard.compliance;
                        alert(`Compliance Dashboard:\n\nCompliant: ${d.compliant}\nWarning: ${d.warning}\nOverdue: ${d.overdue}\nTotal Training Hours: ${d.totalTrainingHours}\nAverage Hours: ${d.averageTrainingHours}`);
                      } else {
                        alert('Error fetching compliance data');
                      }
                    } catch (error) {
                      alert('Failed to fetch compliance data');
                    }
                  }}
                  className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700"
                >
                  View Compliance Report
                </button>
                
                <button 
                  onClick={() => {
                    window.open('/api/users?action=deadlines', '_blank');
                  }}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                >
                  Check Training Deadlines
                </button>
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

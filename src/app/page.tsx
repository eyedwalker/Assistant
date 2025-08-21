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
import ProactiveRecommendations from '@/components/ProactiveRecommendations';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: any[];
  videos?: Array<{
    title: string;
    link: string;
    thumbnail?: string;
    duration: string;
    summary?: string;
    relevance: string;
  }>;
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
    { id: 'video-processing', name: 'Video Processing', icon: CloudArrowUpIcon, url: '/admin/videos' },
    { id: 'video-results', name: 'Video Results', icon: ChartBarIcon, url: '/admin/videos/results' },
    { id: 'video-status', name: 'Video Status', icon: DocumentTextIcon, url: '/admin/videos/status' },
    { id: 'ai-config', name: 'AI Config', icon: CogIcon, url: '/admin/ai-config' },
    { id: 'training', name: 'Training', icon: CheckCircleIcon },
    { id: 'upload', name: 'Upload', icon: CloudArrowUpIcon },
    { id: 'processing', name: 'Processing Status', icon: ChartBarIcon },
    { id: 'test-ai', name: 'Test AI', icon: CogIcon, url: '/api/test-bedrock' },
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
        console.log('🔍 Full API Response:', result);
        console.log('🎥 Videos in response:', result.videos);
        console.log('📚 Sources in response:', result.sources);
        
        const aiMessage: ChatMessage = { 
          role: 'assistant', 
          content: result.message, 
          timestamp: new Date(),
          sources: result.sources,
          videos: result.videos // Include video recommendations from API
        };
        console.log('💬 Chat Message being added:', aiMessage);
        console.log('🎬 Videos in chat message:', aiMessage.videos);
        setChatMessages(prev => {
          const updatedMessages = [...prev, aiMessage];
          console.log('📝 All chat messages after update:', updatedMessages);
          return updatedMessages;
        });
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
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="bg-white rounded-lg p-2 mr-3">
                  <ChartBarIcon className="h-6 w-6 text-blue-600" />
                </div>
                <h1 className="text-2xl font-bold text-white">
                  AI Assistant Platform
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-blue-100">
                Welcome, <span className="font-semibold text-white">{mockUser.name}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white backdrop-blur">
                  {mockUser.accessLevel}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white backdrop-blur">
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
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
            <nav className="flex flex-wrap gap-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                
                // If tab has a URL, render as a link
                if (tab.url) {
                  return (
                    <a
                      key={tab.id}
                      href={tab.url}
                      target={tab.url.startsWith('/api/') ? '_blank' : '_self'}
                      rel={tab.url.startsWith('/api/') ? 'noopener noreferrer' : undefined}
                      className="bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 px-4 py-2 rounded-lg font-medium text-sm flex items-center space-x-2 transition-all duration-200"
                    >
                      <Icon className="h-5 w-5" />
                      <span>{tab.name}</span>
                    </a>
                  );
                }
                
                // Regular tab switching for internal tabs
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`${
                      activeTab === tab.id
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    } px-4 py-2 rounded-lg font-medium text-sm flex items-center space-x-2 transition-all duration-200`}
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
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <CheckCircleIcon className="h-6 w-6 text-green-600 mt-0.5" />
                  <div className="ml-3 flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-green-800">
                        Platform Status - All Systems Online
                      </h3>
                      <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                        v2.1.0 - Enhanced Features ✨
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-green-700">
                      <div className="flex items-center">
                        <CheckCircleIcon className="h-4 w-4 mr-2" />
                        <span>MongoDB database connected and ready</span>
                      </div>
                      <div className="flex items-center">
                        <CheckCircleIcon className="h-4 w-4 mr-2" />
                        <span>AWS S3 storage configured and accessible</span>
                      </div>
                      <div className="flex items-center">
                        <CheckCircleIcon className="h-4 w-4 mr-2" />
                        <span>AI services (Anthropic Claude) active</span>
                      </div>
                      <div className="flex items-center">
                        <CheckCircleIcon className="h-4 w-4 mr-2" />
                        <span>All API endpoints functional</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <div className="flex flex-wrap gap-2 text-xs text-green-600">
                        <span className="bg-green-100 px-2 py-1 rounded">🎥 Clickable Video Recommendations</span>
                        <span className="bg-green-100 px-2 py-1 rounded">🔗 Clickable Resource Links</span>
                        <span className="bg-green-100 px-2 py-1 rounded">🤖 Browser Extension Integration</span>
                        <span className="bg-green-100 px-2 py-1 rounded">📚 Enhanced RAG Context</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Documents</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">Ready</p>
                  </div>
                  <div className="bg-blue-100 rounded-lg p-3">
                    <DocumentTextIcon className="h-8 w-8 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">AI Assistant</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">Active</p>
                  </div>
                  <div className="bg-green-100 rounded-lg p-3">
                    <ChatBubbleLeftRightIcon className="h-8 w-8 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Processing</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">Ready</p>
                  </div>
                  <div className="bg-purple-100 rounded-lg p-3">
                    <CloudArrowUpIcon className="h-8 w-8 text-purple-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Platform</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">Online</p>
                  </div>
                  <div className="bg-orange-100 rounded-lg p-3">
                    <ChartBarIcon className="h-8 w-8 text-orange-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Features Overview */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Platform Features</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="group text-center p-6 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all duration-200">
                  <div className="bg-gradient-to-br from-blue-100 to-blue-50 rounded-full p-4 w-fit mx-auto mb-4">
                    <DocumentTextIcon className="h-10 w-10 text-blue-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">Document Processing</h4>
                  <p className="text-sm text-gray-600">
                    Multi-strategy content extraction from URLs and files with AI analysis
                  </p>
                </div>
                
                <div className="group text-center p-6 border border-gray-200 rounded-lg hover:border-green-300 hover:shadow-md transition-all duration-200">
                  <div className="bg-gradient-to-br from-green-100 to-green-50 rounded-full p-4 w-fit mx-auto mb-4">
                    <ChatBubbleLeftRightIcon className="h-10 w-10 text-green-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">AI Assistant</h4>
                  <p className="text-sm text-gray-600">
                    RAG-based conversational AI with document context and source attribution
                  </p>
                </div>
                
                <div className="group text-center p-6 border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-md transition-all duration-200">
                  <div className="bg-gradient-to-br from-purple-100 to-purple-50 rounded-full p-4 w-fit mx-auto mb-4">
                    <CloudArrowUpIcon className="h-10 w-10 text-purple-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">Secure Storage</h4>
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
            
            {/* Proactive Recommendations */}
            <div className="mb-6">
              <ProactiveRecommendations 
                pageContext={contactLensContext ? {
                  pageType: 'contact-lens-order',
                  product: contactLensContext.manufacturer,
                  activity: 'viewing product details',
                  userRole: 'sales-rep'
                } : {
                  pageType: 'ai-assistant-dashboard',
                  activity: 'using chat interface',
                  userRole: 'user'
                }}
                position="inline"
              />
            </div>

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
                        <div className={`${message.role === 'user' ? 'max-w-xs lg:max-w-md' : 'max-w-full lg:max-w-2xl'} px-4 py-2 rounded-lg ${
                          message.role === 'user' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 text-gray-900'
                        }`}>
                          {message.role === 'assistant' ? (
                            <div className="text-sm">
                              {/* Video recommendations at top if present */}
                              {(() => {
                                console.log('🎬 RENDER CHECK - Message:', message);
                                console.log('🎬 RENDER CHECK - Videos exist?:', !!message.videos);
                                console.log('🎬 RENDER CHECK - Videos length:', message.videos?.length || 0);
                                console.log('🎬 RENDER CHECK - Videos array:', message.videos);
                                return null;
                              })()}
                              {message.videos && message.videos.length > 0 && (
                                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                  <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                                    🎥 Recommended Training Videos ({message.videos.length})
                                  </h4>
                                  <div className="space-y-2">
                                    {message.videos.map((video: any, idx: number) => (
                                      <div key={idx} className="flex items-center space-x-3 p-2 bg-white rounded border hover:shadow-sm transition-shadow">
                                        {video.thumbnail && (
                                          <img 
                                            src={video.thumbnail} 
                                            alt={video.title}
                                            className="w-16 h-10 object-cover rounded"
                                          />
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <a 
                                            href={video.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-medium text-blue-600 hover:text-blue-800 text-sm line-clamp-1"
                                          >
                                            {video.title}
                                          </a>
                                          <p className="text-xs text-gray-500">
                                            {video.duration} • {video.relevance} relevant
                                          </p>
                                        </div>
                                        <a
                                          href={video.link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 flex-shrink-0"
                                        >
                                          Watch
                                        </a>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Sources/Links if present */}
                              {message.sources && message.sources.length > 0 && (
                                <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                                    🔗 Related Resources
                                  </h4>
                                  <div className="space-y-1">
                                    {message.sources.map((source: any, idx: number) => (
                                      <div key={idx} className="flex items-center space-x-2">
                                        <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
                                        {source.url ? (
                                          <a 
                                            href={source.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 text-sm underline"
                                          >
                                            {source.title || source.url}
                                          </a>
                                        ) : (
                                          <span className="text-gray-700 text-sm">{source.title}</span>
                                        )}
                                        {source.type && (
                                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                            {source.type}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Regular message content */}
                              <div className="prose prose-sm max-w-none">
                                <ReactMarkdown
                                  components={{
                                    a: ({ href, children }) => (
                                      <a 
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 underline"
                                      >
                                        {children}
                                      </a>
                                    )
                                  }}
                                >
                                  {message.content}
                                </ReactMarkdown>
                              </div>
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

        {/* Admin Tools Tab */}
        {activeTab === 'admin' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Admin Tools & Testing</h2>
            
            {/* Quick Admin Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">🎥 Video Processing</h3>
                <p className="text-sm text-gray-600 mb-4">Bulk process Vimeo videos for AI training</p>
                <button
                  onClick={() => window.open('/admin/videos', '_blank')}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Open Video Admin
                </button>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">🧪 API Testing</h3>
                <p className="text-sm text-gray-600 mb-4">Test various API endpoints and functionality</p>
                <div className="space-y-2">
                  <button
                    onClick={() => window.open('/api/test-rag', '_blank')}
                    className="w-full bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 text-sm"
                  >
                    Test RAG System
                  </button>
                  <button
                    onClick={() => window.open('/api/content/status', '_blank')}
                    className="w-full bg-purple-600 text-white px-3 py-2 rounded-md hover:bg-purple-700 text-sm"
                  >
                    Content Status
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">🔧 Browser Extension</h3>
                <p className="text-sm text-gray-600 mb-4">Test browser extension functionality</p>
                <div className="space-y-2">
                  <button
                    onClick={() => window.open('/test-extension-api.html', '_blank')}
                    className="w-full bg-orange-600 text-white px-3 py-2 rounded-md hover:bg-orange-700 text-sm"
                  >
                    Extension API Test
                  </button>
                  <button
                    onClick={() => window.open('/test-extension-complete.html', '_blank')}
                    className="w-full bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700 text-sm"
                  >
                    Complete Extension Test
                  </button>
                </div>
              </div>
            </div>

            {/* Database & System Tools */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Database & System Management</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/processing/diagnostics');
                      const data = await response.json();
                      alert(`Database Status:\n\nDocuments: ${data.diagnostics?.documents?.length || 0}\nProcessed Content: ${data.diagnostics?.processedContent?.length || 0}\nUsers: ${data.diagnostics?.users?.length || 0}`);
                    } catch (error) {
                      alert('Failed to fetch diagnostics');
                    }
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
                >
                  Database Diagnostics
                </button>
                
                <button
                  onClick={() => window.open('/api/health', '_blank')}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm"
                >
                  Health Check
                </button>
                
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/videos/vimeo-bulk-process');
                      const data = await response.json();
                      alert(`Vimeo Bulk Processing:\n\n${data.description}\n\nEndpoint: ${data.usage.endpoint}`);
                    } catch (error) {
                      alert('Failed to get Vimeo info');
                    }
                  }}
                  className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 text-sm"
                >
                  Vimeo Bulk Info
                </button>
                
                <button
                  onClick={() => {
                    const testData = {
                      message: "Test RAG functionality with processed content",
                      query: "eyecare procedures"
                    };
                    fetch('/api/test-rag', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(testData)
                    }).then(response => response.json())
                      .then(data => alert(`RAG Test Result:\n\n${JSON.stringify(data, null, 2)}`))
                      .catch(error => alert('RAG test failed'));
                  }}
                  className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 text-sm"
                >
                  Test RAG Query
                </button>
              </div>
            </div>

            {/* Contact Lens & Price Matching */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Lens & Price Matching</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => window.open('/test-contact-lens-page.html', '_blank')}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm"
                >
                  Contact Lens Test Page
                </button>
                
                <button
                  onClick={async () => {
                    const testData = {
                      manufacturer: "Acuvue",
                      product: "Oasys",
                      basecurve: "8.4",
                      diameter: "14.0",
                      sphere: "-2.00",
                      quantity: 6
                    };
                    try {
                      const response = await fetch('/api/price-match/contact-lens', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(testData)
                      });
                      const data = await response.json();
                      alert(`Price Match Test:\n\nFound ${data.matches?.length || 0} matches\nBest Price: $${data.bestPrice || 'N/A'}\nSavings: $${data.potentialSavings || 'N/A'}`);
                    } catch (error) {
                      alert('Price match test failed');
                    }
                  }}
                  className="bg-teal-600 text-white px-4 py-2 rounded-md hover:bg-teal-700 text-sm"
                >
                  Test Price Matching
                </button>
                
                <button
                  onClick={() => window.open('/test-real-contact-lens.html', '_blank')}
                  className="bg-cyan-600 text-white px-4 py-2 rounded-md hover:bg-cyan-700 text-sm"
                >
                  Real Contact Lens Test
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

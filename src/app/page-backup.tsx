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

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: any[];
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [documents, setDocuments] = useState<any[]>([]);
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
    { id: 'users', name: 'Users', icon: UsersIcon },
    { id: 'settings', name: 'Settings', icon: CogIcon },
  ];

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
    
    const userMessage = { role: 'user', content: chatInput, timestamp: new Date() };
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
        const aiMessage = { 
          role: 'assistant', 
          content: result.response, 
          timestamp: new Date(),
          sources: result.sources 
        };
        setChatMessages(prev => [...prev, aiMessage]);
      } else {
        const error = await response.json();
        const errorMessage = { 
          role: 'assistant', 
          content: `Error: ${error.message}`, 
          timestamp: new Date() 
        };
        setChatMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      const errorMessage = { 
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
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Platform Status
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>✅ Core platform infrastructure ready</li>
                    <li>⚠️ MongoDB connection needs configuration</li>
                    <li>⚠️ AWS credentials need refresh for full functionality</li>
                    <li>✅ AI services (Anthropic Claude) configured</li>
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
                <DocumentTextIcon className="h-8 w-8 text-primary-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Documents</p>
                <p className="text-2xl font-semibold text-gray-900">Ready</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChatBubbleLeftRightIcon className="h-8 w-8 text-primary-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">AI Assistant</p>
                <p className="text-2xl font-semibold text-gray-900">Active</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CloudArrowUpIcon className="h-8 w-8 text-primary-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Processing</p>
                <p className="text-2xl font-semibold text-gray-900">Ready</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-8 w-8 text-primary-600" />
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
              <DocumentTextIcon className="h-12 w-12 text-primary-600 mx-auto mb-3" />
              <h4 className="font-medium text-gray-900 mb-2">Document Processing</h4>
              <p className="text-sm text-gray-600">
                Multi-strategy content extraction from URLs and files with AI analysis
              </p>
            </div>
            
            <div className="text-center p-4 border border-gray-200 rounded-lg">
              <ChatBubbleLeftRightIcon className="h-12 w-12 text-primary-600 mx-auto mb-3" />
              <h4 className="font-medium text-gray-900 mb-2">AI Assistant</h4>
              <p className="text-sm text-gray-600">
                RAG-based conversational AI with document context and source attribution
              </p>
            </div>
            
            <div className="text-center p-4 border border-gray-200 rounded-lg">
              <CloudArrowUpIcon className="h-12 w-12 text-primary-600 mx-auto mb-3" />
              <h4 className="font-medium text-gray-900 mb-2">Secure Storage</h4>
              <p className="text-sm text-gray-600">
                Multi-tenant secure document storage with access control
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

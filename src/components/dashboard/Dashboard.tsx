'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/types';
import { 
  DocumentTextIcon, 
  ChatBubbleLeftRightIcon, 
  CloudArrowUpIcon,
  ChartBarIcon,
  CogIcon,
  UserGroupIcon,
  VideoCameraIcon,
  EyeIcon,
  BeakerIcon,
  FolderIcon
} from '@heroicons/react/24/outline';

interface DashboardProps {
  user: User;
}

export default function Dashboard({ user }: DashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const router = useRouter();

  const navigation = [
    { id: 'overview', name: 'Overview', icon: ChartBarIcon, type: 'tab' },
    { id: 'documents', name: 'Documents', icon: DocumentTextIcon, type: 'tab' },
    { id: 'chat', name: 'AI Assistant', icon: ChatBubbleLeftRightIcon, type: 'tab' },
    { id: 'upload', name: 'Upload', icon: CloudArrowUpIcon, type: 'tab' },
    { id: 'video-processing', name: 'Video Processing', icon: VideoCameraIcon, type: 'link', href: '/admin/videos' },
    { id: 'video-results', name: 'Video Results', icon: EyeIcon, type: 'link', href: '/admin/videos/results' },
    { id: 'ai-testing', name: 'AI Testing', icon: BeakerIcon, type: 'link', href: '/admin/videos/test-ai' },
    { id: 'content-management', name: 'Content Manager', icon: FolderIcon, type: 'link', href: '/content-management' },
    { id: 'users', name: 'Users', icon: UserGroupIcon, type: 'tab' },
    { id: 'settings', name: 'Settings', icon: CogIcon, type: 'tab' },
  ];

  const handleNavigation = (item: any) => {
    if (item.type === 'link') {
      router.push(item.href);
    } else {
      setActiveTab(item.id);
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
                Welcome, {user.name}
              </div>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                  {user.accessLevel}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary-100 text-secondary-800">
                  {user.role}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex">
          {/* Sidebar Navigation */}
          <nav className="w-64 mr-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <ul className="space-y-2">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => handleNavigation(item)}
                        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          activeTab === item.id && item.type === 'tab'
                            ? 'bg-primary-100 text-primary-700'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <Icon className="mr-3 h-5 w-5" />
                        {item.name}
                        {item.type === 'link' && (
                          <svg className="ml-auto h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1">
            {activeTab === 'overview' && <OverviewTab user={user} />}
            {activeTab === 'documents' && <DocumentsTab user={user} />}
            {activeTab === 'chat' && <ChatTab user={user} />}
            {activeTab === 'upload' && <UploadTab user={user} />}
            {activeTab === 'users' && <UsersTab user={user} />}
            {activeTab === 'settings' && <SettingsTab user={user} />}
          </main>
        </div>
      </div>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ user }: { user: User }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Dashboard Overview</h2>
        <p className="text-gray-600">
          Welcome to the AI Assistant Platform for eyecare professionals. 
          This platform enables intelligent document processing and conversational AI assistance.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <DocumentTextIcon className="h-8 w-8 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Documents</p>
              <p className="text-2xl font-semibold text-gray-900">0</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ChatBubbleLeftRightIcon className="h-8 w-8 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Conversations</p>
              <p className="text-2xl font-semibold text-gray-900">0</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CloudArrowUpIcon className="h-8 w-8 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Processing Queue</p>
              <p className="text-2xl font-semibold text-gray-900">0</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ChartBarIcon className="h-8 w-8 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Success Rate</p>
              <p className="text-2xl font-semibold text-gray-900">--</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="btn-primary p-4 text-left">
            <CloudArrowUpIcon className="h-6 w-6 mb-2" />
            <div className="font-medium">Upload Documents</div>
            <div className="text-sm opacity-90">Process new files or URLs</div>
          </button>
          
          <button className="btn-secondary p-4 text-left">
            <ChatBubbleLeftRightIcon className="h-6 w-6 mb-2" />
            <div className="font-medium">Start Chat</div>
            <div className="text-sm opacity-90">Ask the AI assistant</div>
          </button>
          
          <button className="btn-outline p-4 text-left">
            <DocumentTextIcon className="h-6 w-6 mb-2" />
            <div className="font-medium">Browse Documents</div>
            <div className="text-sm opacity-90">View processed content</div>
          </button>
        </div>
      </div>
    </div>
  );
}

// Placeholder components for other tabs
function DocumentsTab({ user }: { user: User }) {
  return (
    <div className="card p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Document Management</h2>
      <p className="text-gray-600">Document management interface will be implemented here.</p>
    </div>
  );
}

function ChatTab({ user }: { user: User }) {
  return (
    <div className="card p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">AI Assistant Chat</h2>
      <p className="text-gray-600">Conversational AI interface will be implemented here.</p>
    </div>
  );
}

function UploadTab({ user }: { user: User }) {
  return (
    <div className="card p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Upload Documents</h2>
      <p className="text-gray-600">File upload and URL processing interface will be implemented here.</p>
    </div>
  );
}

function UsersTab({ user }: { user: User }) {
  return (
    <div className="card p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">User Management</h2>
      <p className="text-gray-600">User management interface will be implemented here.</p>
    </div>
  );
}

function SettingsTab({ user }: { user: User }) {
  return (
    <div className="card p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Settings</h2>
      <p className="text-gray-600">Application settings will be implemented here.</p>
    </div>
  );
}

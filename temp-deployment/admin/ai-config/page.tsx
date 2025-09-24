'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface AIConfig {
  id: string;
  name: string;
  systemPrompt: string;
  userPromptTemplate: string;
  prioritizeUploadedContent: boolean;
  maxContextLength: number;
  temperature: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export default function AIConfigPage() {
  const [configs, setConfigs] = useState<AIConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  const defaultConfig: Partial<AIConfig> = {
    name: 'New AI Configuration',
    systemPrompt: `You are an AI assistant specialized in eyecare and optometry for professionals using VSP products.

CRITICAL INSTRUCTIONS:
1. ALWAYS prioritize information from uploaded documents and processed videos over general knowledge
2. When answering questions, first search through the provided context from documents and videos
3. If the answer is found in uploaded content, cite the specific source (document title, video name, etc.)
4. Only provide general eyecare knowledge if NO relevant information is found in uploaded content
5. Be explicit about whether your answer comes from uploaded content or general knowledge

Your primary role is to help eyecare professionals with:
- VSP software training (Officemate, Acuity Logic, EPM, Encompass)
- Clinical procedures and best practices
- Billing and claims processes
- Patient management workflows
- Contact lens procedures and fitting`,
    userPromptTemplate: `Context from uploaded documents and videos:
{context}

User question: {question}

Instructions: Answer based FIRST on the provided context above. If the context contains relevant information, use it and cite the source. If the context doesn't contain relevant information, then provide general eyecare knowledge but clearly state this distinction.`,
    prioritizeUploadedContent: true,
    maxContextLength: 4000,
    temperature: 0.3,
    active: false
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const response = await fetch('/api/admin/ai-config');
      const data = await response.json();
      
      if (data.success) {
        setConfigs(data.configs);
      }
    } catch (error) {
      console.error('Error fetching configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (config: AIConfig) => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });

      const data = await response.json();
      
      if (data.success) {
        await fetchConfigs();
        setShowEditor(false);
        setSelectedConfig(null);
        alert('Configuration saved successfully!');
      } else {
        alert('Failed to save configuration: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Error saving configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfig = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this configuration?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/ai-config?id=${configId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.success) {
        await fetchConfigs();
        alert('Configuration deleted successfully!');
      } else {
        alert('Failed to delete configuration: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting config:', error);
      alert('Error deleting configuration');
    }
  };

  const startEditConfig = (config: AIConfig | null = null) => {
    if (config) {
      setSelectedConfig({ ...config });
    } else {
      setSelectedConfig({
        ...defaultConfig,
        id: '',
        createdAt: new Date(),
        updatedAt: new Date()
      } as AIConfig);
    }
    setShowEditor(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">🤖 AI Assistant Configuration</h1>
              <p className="text-gray-600">Configure AI assistant prompts and behavior for eyecare professionals</p>
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

        {!showEditor ? (
          <>
            {/* Action Bar */}
            <div className="mb-6 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                {configs.length} configuration{configs.length !== 1 ? 's' : ''} found
              </div>
              <button
                onClick={() => startEditConfig()}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center space-x-2"
              >
                <span>➕</span>
                <span>New Configuration</span>
              </button>
            </div>

            {/* Configurations List */}
            <div className="space-y-4">
              {configs.map((config) => (
                <div key={config.id} className="bg-white rounded-lg shadow border overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold text-gray-900">{config.name}</h3>
                          {config.active && (
                            <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 font-medium">
                              ✅ Active
                            </span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-4">
                          <div>
                            <span className="font-medium">Max Context:</span> {config.maxContextLength} chars
                          </div>
                          <div>
                            <span className="font-medium">Temperature:</span> {config.temperature}
                          </div>
                          <div>
                            <span className="font-medium">Prioritize Uploaded Content:</span> {config.prioritizeUploadedContent ? '✅ Yes' : '❌ No'}
                          </div>
                        </div>

                        <div className="bg-gray-50 p-3 rounded-md">
                          <p className="text-sm text-gray-700 font-medium mb-2">System Prompt Preview:</p>
                          <p className="text-sm text-gray-600 line-clamp-3">
                            {config.systemPrompt.substring(0, 200)}...
                          </p>
                        </div>
                      </div>
                      
                      <div className="ml-4 flex gap-2">
                        <button
                          onClick={() => startEditConfig(config)}
                          className="bg-indigo-600 text-white px-3 py-2 rounded-md hover:bg-indigo-700 text-sm"
                        >
                          Edit
                        </button>
                        {!config.active && (
                          <button
                            onClick={() => handleDeleteConfig(config.id)}
                            className="bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700 text-sm"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Configuration Editor */
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">
                {selectedConfig?.id ? 'Edit Configuration' : 'New Configuration'}
              </h2>
              <button
                onClick={() => {
                  setShowEditor(false);
                  setSelectedConfig(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕ Cancel
              </button>
            </div>

            {selectedConfig && (
              <div className="space-y-6">
                {/* Basic Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Configuration Name
                    </label>
                    <input
                      type="text"
                      value={selectedConfig.name}
                      onChange={(e) => setSelectedConfig({...selectedConfig, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Eyecare Specialist Assistant"
                    />
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Context Length
                      </label>
                      <input
                        type="number"
                        value={selectedConfig.maxContextLength}
                        onChange={(e) => setSelectedConfig({...selectedConfig, maxContextLength: parseInt(e.target.value)})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1000"
                        max="8000"
                        step="100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Temperature (0.0 - 1.0)
                      </label>
                      <input
                        type="number"
                        value={selectedConfig.temperature}
                        onChange={(e) => setSelectedConfig({...selectedConfig, temperature: parseFloat(e.target.value)})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                        max="1"
                        step="0.1"
                      />
                    </div>
                  </div>
                </div>

                {/* Checkboxes */}
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedConfig.prioritizeUploadedContent}
                      onChange={(e) => setSelectedConfig({...selectedConfig, prioritizeUploadedContent: e.target.checked})}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Prioritize Uploaded Content over General Knowledge
                    </span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedConfig.active}
                      onChange={(e) => setSelectedConfig({...selectedConfig, active: e.target.checked})}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Set as Active Configuration
                    </span>
                  </label>
                </div>

                {/* System Prompt */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    System Prompt
                  </label>
                  <textarea
                    value={selectedConfig.systemPrompt}
                    onChange={(e) => setSelectedConfig({...selectedConfig, systemPrompt: e.target.value})}
                    rows={12}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="Enter the system prompt that defines the AI assistant's role and behavior..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This prompt defines the AI assistant's role, expertise, and how it should respond to users.
                  </p>
                </div>

                {/* User Prompt Template */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    User Prompt Template
                  </label>
                  <textarea
                    value={selectedConfig.userPromptTemplate}
                    onChange={(e) => setSelectedConfig({...selectedConfig, userPromptTemplate: e.target.value})}
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="Template for formatting user questions with context..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use <code>{`{context}`}</code> for document/video context and <code>{`{question}`}</code> for the user's question.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setShowEditor(false);
                      setSelectedConfig(null);
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveConfig(selectedConfig)}
                    disabled={saving || !selectedConfig.name.trim() || !selectedConfig.systemPrompt.trim()}
                    className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Configuration</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

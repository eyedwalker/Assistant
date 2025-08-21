'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

interface TestVideo {
  _id: string;
  title: string;
  url: string;
  vspProduct: string;
  productFeatures: string[];
  aiAnalysis: string;
  extractedText: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  videoContext?: string[];
}

export default function AITestingPage() {
  const [videos, setVideos] = useState<TestVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<TestVideo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string>('');

  const sampleQuestions = [
    "How do I log into the front office system?",
    "What are the steps for contact lens management?",
    "How do I process insurance claims?", 
    "Show me patient management best practices",
    "What's new in the latest EHR update?",
    "How do I use the analytics dashboard?",
    "Explain the billing workflow process",
    "What training is available for new staff?"
  ];

  useEffect(() => {
    fetchVideos();
    // Generate a unique conversation ID
    setConversationId(`test-${Date.now()}`);
  }, []);

  const fetchVideos = async () => {
    try {
      const response = await fetch('/api/videos/processed-results?limit=20');
      const data = await response.json();
      if (data.success) {
        setVideos(data.videos);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
    }
  };

  const sendMessage = async (message: string) => {
    if (!message.trim()) return;

    setLoading(true);
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          sessionId: conversationId,
          userId: 'test-user',
          tenantId: 'test-tenant',
          accessLevel: 'ACCOUNT',
          context: selectedVideo ? {
            videoId: selectedVideo._id,
            videoTitle: selectedVideo.title,
            vspProduct: selectedVideo.vspProduct,
            pageType: 'ai-testing'
          } : {
            pageType: 'ai-testing'
          }
        })
      });

      const data = await response.json();
      
      if (data.success) {
        const assistantMessage: ChatMessage = {
          role: 'assistant', 
          content: data.message,
          timestamp: new Date(),
          videoContext: data.videos ? data.videos.map((v: any) => v.title) : []
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        toast.error('Failed to get AI response');
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setConversationId(`test-${Date.now()}`);
  };

  const selectSampleQuestion = (question: string) => {
    setInputMessage(question);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">🤖 AI Video Q&A Testing</h1>
              <p className="text-gray-600">Test the AI assistant with questions about processed videos</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Video Selection Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-4 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Context Video (Optional)</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                <button
                  onClick={() => setSelectedVideo(null)}
                  className={`w-full text-left p-2 rounded text-sm ${
                    !selectedVideo ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'
                  }`}
                >
                  🌐 No specific video (search all)
                </button>
                {videos.map((video) => (
                  <button
                    key={video._id}
                    onClick={() => setSelectedVideo(video)}
                    className={`w-full text-left p-2 rounded text-sm ${
                      selectedVideo?._id === video._id 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-medium line-clamp-2">{video.title}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      📦 {video.vspProduct}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Sample Questions */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Sample Questions</h3>
              <div className="space-y-2">
                {sampleQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => selectSampleQuestion(question)}
                    className="w-full text-left p-2 text-sm text-blue-600 hover:bg-blue-50 rounded"
                  >
                    💬 {question}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Chat Interface */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow flex flex-col h-[600px]">
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">AI Assistant Chat</h3>
                    {selectedVideo && (
                      <p className="text-sm text-gray-600">
                        Context: {selectedVideo.title} ({selectedVideo.vspProduct})
                      </p>
                    )}
                  </div>
                  <button
                    onClick={clearChat}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Clear Chat
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">
                    <div className="text-4xl mb-4">🤖</div>
                    <p>Ask me anything about eyecare training!</p>
                    <p className="text-sm mt-2">
                      Try questions about Officemate, Acuity Logic, billing, or patient management.
                    </p>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-3 rounded-lg ${
                        message.role === 'user' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-100 text-gray-900'
                      }`}>
                        <div className="whitespace-pre-wrap">{message.content}</div>
                        
                        {message.videoContext && message.videoContext.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-300">
                            <div className="text-xs opacity-75 mb-2">📹 Referenced Videos:</div>
                            <div className="space-y-1">
                              {message.videoContext.map((context, i) => (
                                <div key={i} className="text-xs opacity-75">
                                  • {context}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className={`text-xs mt-2 opacity-75 ${
                          message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {message.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 text-gray-900 p-3 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span>AI is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-gray-200">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !loading && sendMessage(inputMessage)}
                    placeholder="Ask about eyecare training, software features, or procedures..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  />
                  <button
                    onClick={() => sendMessage(inputMessage)}
                    disabled={loading || !inputMessage.trim()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>

            {/* Test Results Summary */}
            {messages.length > 0 && (
              <div className="mt-6 bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Test Session Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Messages:</span>
                    <span className="ml-2">{messages.length}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Context Video:</span>
                    <span className="ml-2">{selectedVideo ? selectedVideo.vspProduct : 'All Videos'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Session:</span>
                    <span className="ml-2">{conversationId}</span>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-blue-50 rounded text-sm">
                  <div className="font-medium text-blue-900 mb-2">💡 Testing Tips:</div>
                  <ul className="text-blue-800 space-y-1">
                    <li>• Ask specific questions about VSP products (Officemate, Acuity Logic, EPM)</li>
                    <li>• Test both general and detailed procedural questions</li>
                    <li>• Try questions that should reference specific training videos</li>
                    <li>• Check if the AI provides video URLs for further learning</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

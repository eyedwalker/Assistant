'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { 
  ClockIcon, 
  CheckCircleIcon, 
  PlayIcon,
  BookOpenIcon,
  QuestionMarkCircleIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

interface TrainingSection {
  id: string;
  title: string;
  type: 'content' | 'interactive' | 'hands-on' | 'quiz' | 'summary';
  duration: number;
  content: string;
}

interface TrainingModule {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  estimatedDuration: number;
  description: string;
  status: string;
  content?: {
    sections: TrainingSection[];
    totalSections: number;
    completionCriteria: {
      requiredSections: string[];
      minimumScore: number;
      practicalExercises: number;
    };
  };
  metadata?: {
    version: string;
    lastUpdated: string;
    author: string;
    reviewedBy: string;
    tags: string[];
  };
}

export default function TrainingModulePage() {
  const params = useParams();
  const [module, setModule] = useState<TrainingModule | null>(null);
  const [currentSection, setCurrentSection] = useState(0);
  const [completedSections, setCompletedSections] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchModule = async () => {
      try {
        console.log('📚 Fetching training module:', params.id);
        const response = await fetch(`/api/training/modules/${params.id}`);
        const data = await response.json();
        
        if (data.success) {
          setModule(data.module);
        } else {
          setError(data.error || 'Failed to load module');
        }
      } catch (err) {
        setError('Failed to fetch training module');
        console.error('Error fetching module:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (params.id) {
      fetchModule();
    }
  }, [params.id]);

  const handleSectionComplete = (sectionId: string) => {
    if (!completedSections.includes(sectionId)) {
      setCompletedSections([...completedSections, sectionId]);
    }
  };

  const getSectionIcon = (type: string) => {
    switch (type) {
      case 'content': return BookOpenIcon;
      case 'interactive': return PlayIcon;
      case 'hands-on': return ChartBarIcon;
      case 'quiz': return QuestionMarkCircleIcon;
      case 'summary': return CheckCircleIcon;
      default: return BookOpenIcon;
    }
  };

  const getSectionColor = (type: string) => {
    switch (type) {
      case 'content': return 'bg-blue-100 text-blue-800';
      case 'interactive': return 'bg-green-100 text-green-800';
      case 'hands-on': return 'bg-purple-100 text-purple-800';
      case 'quiz': return 'bg-orange-100 text-orange-800';
      case 'summary': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading training module...</p>
        </div>
      </div>
    );
  }

  if (error || !module) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Module Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'The requested training module could not be found.'}</p>
          <a href="/" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  // If module doesn't have content, show the basic module info
  if (!module.content || !module.content.sections) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto py-8 px-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{module.title}</h1>
              <p className="text-lg text-gray-600 mb-6">{module.description}</p>
              
              <div className="flex items-center justify-center space-x-6 text-sm text-gray-500 mb-8">
                <div className="flex items-center">
                  <ClockIcon className="h-4 w-4 mr-1" />
                  {module.estimatedDuration} minutes
                </div>
                <div className="flex items-center">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    module.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                    module.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {module.difficulty}
                  </span>
                </div>
                <div className="text-gray-600">
                  {module.category}
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
              <h3 className="text-lg font-medium text-yellow-800 mb-2">🚧 Module Under Development</h3>
              <p className="text-yellow-700">
                This training module has been created but the detailed content is still being developed. 
                In a full implementation, this would include:
              </p>
              <ul className="list-disc list-inside text-yellow-700 mt-3 space-y-1">
                <li>Interactive lessons and tutorials</li>
                <li>Hands-on exercises with real scenarios</li>
                <li>Knowledge assessments and quizzes</li>
                <li>Progress tracking and completion certificates</li>
                <li>Multimedia content (videos, simulations)</li>
              </ul>
            </div>

            <div className="text-center">
              <button 
                onClick={() => alert('🎓 In a full implementation, this would start the interactive training session!')}
                className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 font-medium"
              >
                Start Training Module
              </button>
              <div className="mt-4">
                <a href="/" className="text-blue-600 hover:text-blue-800">
                  ← Back to Dashboard
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentSectionData = module.content?.sections[currentSection];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{module.title}</h1>
              <p className="text-gray-600 mt-1">{module.description}</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Progress</div>
              <div className="text-lg font-semibold text-gray-900">
                {completedSections.length} / {module.content.sections.length}
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{width: `${(completedSections.length / module.content.sections.length) * 100}%`}}
              ></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Section Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="font-medium text-gray-900 mb-4">Sections</h3>
              <div className="space-y-2">
                {module.content.sections.map((section, index) => {
                  const Icon = getSectionIcon(section.type);
                  const isCompleted = completedSections.includes(section.id);
                  const isCurrent = index === currentSection;
                  
                  return (
                    <button
                      key={section.id}
                      onClick={() => setCurrentSection(index)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        isCurrent 
                          ? 'border-blue-500 bg-blue-50' 
                          : isCompleted 
                          ? 'border-green-200 bg-green-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Icon className="h-4 w-4 mr-2 text-gray-500" />
                          <span className="text-sm font-medium">{section.title}</span>
                        </div>
                        {isCompleted && (
                          <CheckCircleIcon className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                      <div className="flex items-center mt-1 text-xs text-gray-500">
                        <ClockIcon className="h-3 w-3 mr-1" />
                        {section.duration} min
                        <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${getSectionColor(section.type)}`}>
                          {section.type}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{currentSectionData.title}</h2>
                  <div className="flex items-center mt-2 text-sm text-gray-500">
                    <ClockIcon className="h-4 w-4 mr-1" />
                    {currentSectionData.duration} minutes
                    <span className={`ml-3 px-2 py-1 rounded text-xs ${getSectionColor(currentSectionData.type)}`}>
                      {currentSectionData.type}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleSectionComplete(currentSectionData.id)}
                  disabled={completedSections.includes(currentSectionData.id)}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    completedSections.includes(currentSectionData.id)
                      ? 'bg-green-100 text-green-800 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {completedSections.includes(currentSectionData.id) ? 'Completed' : 'Mark Complete'}
                </button>
              </div>

              {/* Section Content */}
              <div className="prose max-w-none">
                <ReactMarkdown>{currentSectionData.content}</ReactMarkdown>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setCurrentSection(Math.max(0, currentSection - 1))}
                  disabled={currentSection === 0}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>
                
                <span className="text-sm text-gray-500">
                  Section {currentSection + 1} of {module.content?.sections.length || 0}
                </span>
                
                <button
                  onClick={() => setCurrentSection(Math.min((module.content?.sections.length || 1) - 1, currentSection + 1))}
                  disabled={currentSection === (module.content?.sections.length || 1) - 1}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

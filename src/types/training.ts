// Training System Types and Interfaces

export interface TrainingModule {
  id: string;
  title: string;
  description: string;
  sourceDocuments: string[];
  learningObjectives: string[];
  content: TrainingContent[];
  estimatedDuration: number; // in minutes
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  prerequisites: string[];
  category: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  tenantId: string;
  accessLevel: 'PUBLIC' | 'ACCOUNT' | 'COMPANY' | 'OFFICE';
  isActive: boolean;
}

export interface TrainingContent {
  id: string;
  type: 'text' | 'video' | 'interactive' | 'quiz' | 'scenario';
  title: string;
  content: string;
  order: number;
  metadata?: Record<string, any>;
  estimatedTime: number; // in minutes
}

export interface Assessment {
  id: string;
  moduleId: string;
  title: string;
  description: string;
  questions: Question[];
  passingScore: number; // percentage (0-100)
  timeLimit?: number; // in minutes
  maxAttempts: number;
  randomizeQuestions: boolean;
  showCorrectAnswers: boolean;
  createdAt: Date;
  updatedAt: Date;
  tenantId: string;
  accessLevel: 'PUBLIC' | 'ACCOUNT' | 'COMPANY' | 'OFFICE';
  isActive: boolean;
}

export interface Question {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'scenario' | 'drag-drop' | 'short-answer';
  question: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation: string;
  difficulty: 1 | 2 | 3 | 4 | 5; // 1=easy, 5=expert
  points: number;
  category: string;
  tags: string[];
}

export interface UserProgress {
  id: string;
  userId: string;
  moduleId: string;
  progress: number; // 0-100%
  timeSpent: number; // in minutes
  lastAccessed: Date;
  startedAt: Date;
  completedAt?: Date;
  completedSections: string[];
  currentSection: string;
  score?: number;
  status: 'not-started' | 'in-progress' | 'completed' | 'failed';
  tenantId: string;
}

export interface AssessmentAttempt {
  id: string;
  userId: string;
  assessmentId: string;
  moduleId: string;
  answers: QuestionAnswer[];
  score: number;
  passed: boolean;
  startedAt: Date;
  completedAt: Date;
  timeSpent: number;
  attemptNumber: number;
  tenantId: string;
}

export interface QuestionAnswer {
  questionId: string;
  answer: string | string[];
  isCorrect: boolean;
  points: number;
  timeSpent: number;
}

export interface Certification {
  id: string;
  userId: string;
  moduleId: string;
  assessmentId: string;
  title: string;
  description: string;
  score: number;
  completedAt: Date;
  expiresAt?: Date;
  certificateUrl: string;
  certificateNumber: string;
  isValid: boolean;
  tenantId: string;
  metadata?: Record<string, any>;
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  moduleIds: string[];
  requiredModules: string[];
  optionalModules: string[];
  estimatedDuration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  tenantId: string;
  accessLevel: 'PUBLIC' | 'ACCOUNT' | 'COMPANY' | 'OFFICE';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LearningAnalytics {
  moduleId: string;
  completionRate: number;
  averageScore: number;
  averageTimeToComplete: number;
  commonMistakes: QuestionAnalysis[];
  difficultyRating: number;
  userFeedback: number;
  totalEnrollments: number;
  totalCompletions: number;
}

export interface QuestionAnalysis {
  questionId: string;
  question: string;
  correctAnswerRate: number;
  commonWrongAnswers: string[];
  averageTimeSpent: number;
  difficultyRating: number;
}

export interface TrainingModuleRequest {
  sourceDocumentIds: string[];
  title?: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration?: number;
  learningObjectives?: string[];
  generateAssessment: boolean;
  tenantId: string;
  accessLevel: 'PUBLIC' | 'ACCOUNT' | 'COMPANY' | 'OFFICE';
}

export interface ModuleGenerationResult {
  module: TrainingModule;
  assessment?: Assessment;
  success: boolean;
  error?: string;
  generationTime: number;
  contentQuality: number; // 0-100%
  suggestions: string[];
}

import { MongoDBAccessor } from '../accessors/MongoDBAccessor';
import { AnthropicAccessor } from '../accessors/AnthropicAccessor';
import { 
  TrainingModule, 
  Assessment, 
  Question,
  TrainingContent,
  TrainingModuleRequest
} from '../../types/training';

export class ModuleGenerationEngine {
  private mongoAccessor: MongoDBAccessor;
  private anthropicAccessor: AnthropicAccessor;

  constructor(mongoAccessor: MongoDBAccessor, anthropicAccessor: AnthropicAccessor) {
    this.mongoAccessor = mongoAccessor;
    this.anthropicAccessor = anthropicAccessor;
  }

  /**
   * Generate a complete training module from source documents
   */
  async generateModule(sourceDocuments: any[], request: TrainingModuleRequest): Promise<TrainingModule> {
    try {
      console.log('🤖 AI generating training module from', sourceDocuments.length, 'documents');

      // Combine and analyze source content
      const combinedContent = this.combineSourceContent(sourceDocuments);
      
      // Generate module structure using AI
      const moduleStructure = await this.generateModuleStructure(combinedContent, request);
      
      // Generate detailed content for each section
      const detailedContent = await this.generateDetailedContent(moduleStructure, combinedContent, request);
      
      // Create the final training module
      const module: TrainingModule = {
        id: this.generateId(),
        title: request.title || moduleStructure.title,
        description: moduleStructure.description,
        sourceDocuments: request.sourceDocumentIds,
        learningObjectives: moduleStructure.learningObjectives,
        content: detailedContent,
        estimatedDuration: this.calculateEstimatedDuration(detailedContent),
        difficulty: request.difficulty,
        prerequisites: moduleStructure.prerequisites,
        category: request.category,
        tags: moduleStructure.tags,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'AI-Generated',
        tenantId: request.tenantId,
        accessLevel: request.accessLevel,
        isActive: true
      };

      console.log('✅ Training module generated:', module.title);
      return module;

    } catch (error) {
      console.error('❌ Error generating training module:', error);
      throw error;
    }
  }

  /**
   * Generate assessment questions for a training module
   */
  async generateAssessment(module: TrainingModule, request: TrainingModuleRequest): Promise<Assessment> {
    try {
      console.log('🧪 AI generating assessment for module:', module.title);

      const moduleContent = module.content.map(c => c.content).join('\n\n');
      
      // Generate questions using AI
      const questions = await this.generateQuestions(moduleContent, module.learningObjectives, request.difficulty);
      
      const assessment: Assessment = {
        id: this.generateId(),
        moduleId: module.id,
        title: `${module.title} - Assessment`,
        description: `Assessment to validate understanding of ${module.title}`,
        questions,
        passingScore: this.getPassingScore(request.difficulty),
        timeLimit: this.calculateTimeLimit(questions.length),
        maxAttempts: 3,
        randomizeQuestions: true,
        showCorrectAnswers: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        tenantId: request.tenantId,
        accessLevel: request.accessLevel,
        isActive: true
      };

      console.log('✅ Assessment generated with', questions.length, 'questions');
      return assessment;

    } catch (error) {
      console.error('❌ Error generating assessment:', error);
      throw error;
    }
  }

  // Private helper methods

  private combineSourceContent(documents: any[]): string {
    return documents
      .map(doc => `${doc.title || 'Document'}\n${doc.content || doc.extractedText || ''}`)
      .join('\n\n---\n\n');
  }

  private async generateModuleStructure(content: string, request: TrainingModuleRequest): Promise<any> {
    const prompt = `
You are an expert instructional designer creating training modules for eyecare professionals. 
Analyze the following content and create a comprehensive training module structure.

CONTENT TO ANALYZE:
${content.substring(0, 4000)}...

REQUIREMENTS:
- Category: ${request.category}
- Difficulty: ${request.difficulty}
- Target audience: Eyecare professionals
- Focus on practical, actionable learning

GENERATE A JSON RESPONSE with this structure:
{
  "title": "Clear, descriptive module title",
  "description": "2-3 sentence description of what learners will gain",
  "learningObjectives": [
    "Specific, measurable learning objective 1",
    "Specific, measurable learning objective 2",
    "Specific, measurable learning objective 3"
  ],
  "prerequisites": ["Any required prior knowledge"],
  "tags": ["relevant", "searchable", "tags"],
  "sections": [
    {
      "title": "Section 1 Title",
      "type": "text",
      "keyPoints": ["Key point 1", "Key point 2"]
    },
    {
      "title": "Section 2 Title", 
      "type": "scenario",
      "keyPoints": ["Key point 1", "Key point 2"]
    }
  ]
}

Focus on practical skills and real-world application in eyecare practice management.
`;

    try {
      const response = await this.anthropicAccessor.generateChatResponse(prompt, '');
      
      // Extract JSON from response
      const jsonMatch = response.message.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('Failed to parse AI response for module structure');
    } catch (error) {
      console.error('❌ Error generating module structure:', error);
      
      // Fallback structure
      return {
        title: request.title || `${request.category} Training Module`,
        description: `Comprehensive training on ${request.category} for eyecare professionals`,
        learningObjectives: [
          `Understand key concepts in ${request.category}`,
          `Apply best practices in daily operations`,
          `Demonstrate proficiency in required tasks`
        ],
        prerequisites: [],
        tags: [request.category.toLowerCase(), 'eyecare', 'training'],
        sections: [
          { title: 'Introduction', type: 'text', keyPoints: ['Overview', 'Objectives'] },
          { title: 'Core Concepts', type: 'text', keyPoints: ['Key principles', 'Best practices'] },
          { title: 'Practical Application', type: 'scenario', keyPoints: ['Real examples', 'Case studies'] }
        ]
      };
    }
  }

  private async generateDetailedContent(structure: any, sourceContent: string, request: TrainingModuleRequest): Promise<TrainingContent[]> {
    const detailedContent: TrainingContent[] = [];
    
    for (let i = 0; i < structure.sections.length; i++) {
      const section = structure.sections[i];
      
      const prompt = `
You are creating detailed training content for eyecare professionals.

SECTION TO DEVELOP: ${section.title}
TYPE: ${section.type}
KEY POINTS: ${section.keyPoints.join(', ')}

SOURCE CONTENT:
${sourceContent.substring(0, 3000)}...

Create engaging, practical content that:
1. Uses clear, professional language
2. Includes specific examples from eyecare practice
3. Provides actionable steps and procedures
4. Uses markdown formatting for readability

Generate 300-800 words of content for this section.
Focus on practical application and real-world scenarios.
`;

      try {
        const response = await this.anthropicAccessor.generateChatResponse(prompt, '');
        const contentText = response.message;
        
        const trainingContent: TrainingContent = {
          id: this.generateId(),
          type: section.type as any,
          title: section.title,
          content: contentText,
          order: i + 1,
          estimatedTime: this.estimateReadingTime(contentText),
          metadata: {
            keyPoints: section.keyPoints,
            difficulty: request.difficulty
          }
        };
        
        detailedContent.push(trainingContent);
        
      } catch (error) {
        console.error(`❌ Error generating content for section ${section.title}:`, error);
        
        // Fallback content
        const fallbackContent: TrainingContent = {
          id: this.generateId(),
          type: 'text',
          title: section.title,
          content: `## ${section.title}\n\nThis section covers important concepts related to ${section.title.toLowerCase()}.\n\n### Key Points:\n${section.keyPoints.map((p: string) => `- ${p}`).join('\n')}`,
          order: i + 1,
          estimatedTime: 5,
          metadata: { keyPoints: section.keyPoints }
        };
        
        detailedContent.push(fallbackContent);
      }
    }
    
    return detailedContent;
  }

  private async generateQuestions(content: string, objectives: string[], difficulty: string): Promise<Question[]> {
    const prompt = `
You are creating assessment questions for eyecare professionals based on training content.

TRAINING CONTENT:
${content.substring(0, 3000)}...

LEARNING OBJECTIVES:
${objectives.join('\n')}

DIFFICULTY LEVEL: ${difficulty}

Generate 8-12 assessment questions in JSON format:
{
  "questions": [
    {
      "type": "multiple-choice",
      "question": "Clear, specific question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option B",
      "explanation": "Why this answer is correct",
      "difficulty": 3,
      "points": 10,
      "category": "Practice Management",
      "tags": ["billing", "insurance"]
    }
  ]
}

Question types to include:
- multiple-choice (most common)
- true-false
- scenario (situational questions)

Focus on practical application and real-world scenarios in eyecare practice.
Ensure questions test understanding, not just memorization.
`;

    try {
      const response = await this.anthropicAccessor.generateChatResponse(prompt, '');
      
      // Extract JSON from response
      const jsonMatch = response.message.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.questions.map((q: any, index: number) => ({
          id: this.generateId(),
          type: q.type || 'multiple-choice',
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation || 'Correct answer explanation',
          difficulty: q.difficulty || this.getDifficultyNumber(difficulty),
          points: q.points || 10,
          category: q.category || 'General',
          tags: q.tags || []
        }));
      }
      
      throw new Error('Failed to parse AI response for questions');
    } catch (error) {
      console.error('❌ Error generating questions:', error);
      
      // Fallback questions
      return this.generateFallbackQuestions(objectives, difficulty);
    }
  }

  private generateFallbackQuestions(objectives: string[], difficulty: string): Question[] {
    return objectives.slice(0, 5).map((objective, index) => ({
      id: this.generateId(),
      type: 'multiple-choice' as const,
      question: `Which of the following best describes the key concept related to: ${objective}?`,
      options: [
        'Option A - Basic understanding',
        'Option B - Advanced application',
        'Option C - Practical implementation',
        'Option D - All of the above'
      ],
      correctAnswer: 'Option D - All of the above',
      explanation: 'This objective encompasses multiple aspects of understanding and application.',
      difficulty: this.getDifficultyNumber(difficulty),
      points: 10,
      category: 'General',
      tags: ['assessment', 'knowledge-check']
    }));
  }

  private calculateEstimatedDuration(content: TrainingContent[]): number {
    return content.reduce((total, item) => total + item.estimatedTime, 0);
  }

  private estimateReadingTime(text: string): number {
    const wordsPerMinute = 200;
    const wordCount = text.split(/\s+/).length;
    return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
  }

  private getPassingScore(difficulty: string): number {
    switch (difficulty) {
      case 'beginner': return 70;
      case 'intermediate': return 75;
      case 'advanced': return 80;
      default: return 75;
    }
  }

  private calculateTimeLimit(questionCount: number): number {
    return questionCount * 2; // 2 minutes per question
  }

  private getDifficultyNumber(difficulty: string): 1 | 2 | 3 | 4 | 5 {
    switch (difficulty) {
      case 'beginner': return 2;
      case 'intermediate': return 3;
      case 'advanced': return 4;
      default: return 3;
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

import { MongoDBAccessor } from '../accessors/MongoDBAccessor';
import { AnthropicAccessor } from '../accessors/AnthropicAccessor';
import { ModuleGenerationEngine } from '../engines/ModuleGenerationEngine';
import { 
  TrainingModule, 
  Assessment, 
  UserProgress, 
  TrainingModuleRequest,
  ModuleGenerationResult,
  LearningPath,
  LearningAnalytics
} from '../../types/training';

export class TrainingManager {
  private mongoAccessor: MongoDBAccessor;
  private anthropicAccessor: AnthropicAccessor;
  private moduleGenerationEngine: ModuleGenerationEngine;

  constructor() {
    this.mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI || 'mongodb://localhost:27017',
      process.env.MONGODB_DB || 'ai-assistant'
    );
    this.anthropicAccessor = new AnthropicAccessor();
    this.moduleGenerationEngine = new ModuleGenerationEngine(
      this.mongoAccessor,
      this.anthropicAccessor
    );
  }

  /**
   * Generate a training module from uploaded content
   */
  async generateTrainingModule(request: TrainingModuleRequest): Promise<ModuleGenerationResult> {
    try {
      console.log('🎓 Generating training module from documents:', request.sourceDocumentIds);
      
      const startTime = Date.now();
      
      // Get source documents and their content
      const sourceDocuments = await this.getSourceDocuments(request.sourceDocumentIds, request.tenantId);
      
      if (sourceDocuments.length === 0) {
        throw new Error('No source documents found for training module generation');
      }

      // Generate the training module using AI
      const module = await this.moduleGenerationEngine.generateModule(sourceDocuments, request);
      
      // Generate assessment if requested
      let assessment: Assessment | undefined;
      if (request.generateAssessment) {
        assessment = await this.moduleGenerationEngine.generateAssessment(module, request);
      }

      // Store the module and assessment
      await this.storeTrainingModule(module);
      if (assessment) {
        await this.storeAssessment(assessment);
      }

      const generationTime = Date.now() - startTime;
      
      console.log(`✅ Training module generated successfully in ${generationTime}ms`);
      
      return {
        module,
        assessment,
        success: true,
        generationTime,
        contentQuality: await this.assessContentQuality(module),
        suggestions: await this.generateImprovementSuggestions(module)
      };

    } catch (error) {
      console.error('❌ Error generating training module:', error);
      return {
        module: {} as TrainingModule,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        generationTime: 0,
        contentQuality: 0,
        suggestions: []
      };
    }
  }

  /**
   * Get all training modules for a tenant
   */
  async getTrainingModules(tenantId: string, accessLevel: string): Promise<TrainingModule[]> {
    try {
      const filter = {
        tenantId,
        accessLevel: { $in: this.getAccessibleLevels(accessLevel) },
        isActive: true
      };

      const modules = await this.mongoAccessor.find('training_modules', filter);
      return modules.map(this.mapToTrainingModule);
    } catch (error) {
      console.error('❌ Error fetching training modules:', error);
      return [];
    }
  }

  /**
   * Get a specific training module
   */
  async getTrainingModule(moduleId: string, tenantId: string): Promise<TrainingModule | null> {
    try {
      const module = await this.mongoAccessor.findById('training_modules', moduleId);
      
      if (!module || module.tenantId !== tenantId) {
        return null;
      }

      return this.mapToTrainingModule(module);
    } catch (error) {
      console.error('❌ Error fetching training module:', error);
      return null;
    }
  }

  /**
   * Track user progress in a training module
   */
  async updateUserProgress(
    userId: string, 
    moduleId: string, 
    sectionId: string, 
    timeSpent: number,
    tenantId: string
  ): Promise<UserProgress> {
    try {
      const existingProgress = await this.mongoAccessor.findOne('user_progress', {
        userId,
        moduleId,
        tenantId
      });

      const module = await this.getTrainingModule(moduleId, tenantId);
      if (!module) {
        throw new Error('Training module not found');
      }

      const totalSections = module.content.length;
      let completedSections: string[] = existingProgress?.completedSections || [];
      
      // Add current section if not already completed
      if (!completedSections.includes(sectionId)) {
        completedSections.push(sectionId);
      }

      const progress = Math.round((completedSections.length / totalSections) * 100);
      const totalTimeSpent = (existingProgress?.timeSpent || 0) + timeSpent;
      
      const progressData: UserProgress = {
        id: existingProgress?.id || this.generateId(),
        userId,
        moduleId,
        progress,
        timeSpent: totalTimeSpent,
        lastAccessed: new Date(),
        startedAt: existingProgress?.startedAt || new Date(),
        completedAt: progress === 100 ? new Date() : undefined,
        completedSections,
        currentSection: sectionId,
        status: progress === 100 ? 'completed' : 'in-progress',
        tenantId
      };

      if (existingProgress) {
        await this.mongoAccessor.update('user_progress', existingProgress.id, progressData);
      } else {
        await this.mongoAccessor.create('user_progress', progressData);
      }

      console.log(`📊 Updated progress for user ${userId} in module ${moduleId}: ${progress}%`);
      return progressData;

    } catch (error) {
      console.error('❌ Error updating user progress:', error);
      throw error;
    }
  }

  /**
   * Get user progress for a specific module
   */
  async getUserProgress(userId: string, moduleId: string, tenantId: string): Promise<UserProgress | null> {
    try {
      const progress = await this.mongoAccessor.findOne('user_progress', {
        userId,
        moduleId,
        tenantId
      });

      return progress ? this.mapToUserProgress(progress) : null;
    } catch (error) {
      console.error('❌ Error fetching user progress:', error);
      return null;
    }
  }

  /**
   * Get all user progress for a user
   */
  async getAllUserProgress(userId: string, tenantId: string): Promise<UserProgress[]> {
    try {
      const progressList = await this.mongoAccessor.find('user_progress', {
        userId,
        tenantId
      });

      return progressList.map(this.mapToUserProgress);
    } catch (error) {
      console.error('❌ Error fetching user progress:', error);
      return [];
    }
  }

  /**
   * Get learning analytics for a module
   */
  async getModuleAnalytics(moduleId: string, tenantId: string): Promise<LearningAnalytics | null> {
    try {
      // Get all progress records for this module
      const progressRecords = await this.mongoAccessor.find('user_progress', {
        moduleId,
        tenantId
      });

      if (progressRecords.length === 0) {
        return null;
      }

      const completedRecords = progressRecords.filter(p => p.status === 'completed');
      const completionRate = (completedRecords.length / progressRecords.length) * 100;
      
      const averageTimeToComplete = completedRecords.length > 0 
        ? completedRecords.reduce((sum, p) => sum + p.timeSpent, 0) / completedRecords.length
        : 0;

      // Get assessment data if available
      const assessments = await this.mongoAccessor.find('assessment_attempts', {
        moduleId,
        tenantId
      });

      const averageScore = assessments.length > 0
        ? assessments.reduce((sum, a) => sum + a.score, 0) / assessments.length
        : 0;

      return {
        moduleId,
        completionRate,
        averageScore,
        averageTimeToComplete,
        commonMistakes: [], // TODO: Implement question analysis
        difficultyRating: 0, // TODO: Calculate from user feedback
        userFeedback: 0, // TODO: Implement user feedback system
        totalEnrollments: progressRecords.length,
        totalCompletions: completedRecords.length
      };

    } catch (error) {
      console.error('❌ Error fetching module analytics:', error);
      return null;
    }
  }

  // Private helper methods

  private async getSourceDocuments(documentIds: string[], tenantId: string): Promise<any[]> {
    try {
      const documents = await this.mongoAccessor.find('contents', {
        documentId: { $in: documentIds },
        tenantId
      });

      return documents;
    } catch (error) {
      console.error('❌ Error fetching source documents:', error);
      return [];
    }
  }

  private async storeTrainingModule(module: TrainingModule): Promise<void> {
    await this.mongoAccessor.create('training_modules', module);
  }

  private async storeAssessment(assessment: Assessment): Promise<void> {
    await this.mongoAccessor.create('assessments', assessment);
  }

  private async assessContentQuality(module: TrainingModule): Promise<number> {
    // Simple quality assessment based on content length and structure
    const contentLength = module.content.reduce((sum, c) => sum + c.content.length, 0);
    const hasObjectives = module.learningObjectives.length > 0;
    const hasVariedContent = new Set(module.content.map(c => c.type)).size > 1;
    
    let quality = 50; // Base quality
    
    if (contentLength > 1000) quality += 20;
    if (hasObjectives) quality += 15;
    if (hasVariedContent) quality += 15;
    
    return Math.min(quality, 100);
  }

  private async generateImprovementSuggestions(module: TrainingModule): Promise<string[]> {
    const suggestions: string[] = [];
    
    if (module.learningObjectives.length === 0) {
      suggestions.push('Add specific learning objectives to improve module clarity');
    }
    
    if (module.content.length < 3) {
      suggestions.push('Consider adding more content sections for comprehensive coverage');
    }
    
    const contentTypes = new Set(module.content.map(c => c.type));
    if (contentTypes.size === 1) {
      suggestions.push('Add varied content types (videos, interactive elements) for better engagement');
    }
    
    return suggestions;
  }

  private getAccessibleLevels(accessLevel: string): string[] {
    const levels = ['PUBLIC'];
    if (['ACCOUNT', 'COMPANY', 'OFFICE'].includes(accessLevel)) {
      levels.push('ACCOUNT');
    }
    if (['COMPANY', 'OFFICE'].includes(accessLevel)) {
      levels.push('COMPANY');
    }
    if (accessLevel === 'OFFICE') {
      levels.push('OFFICE');
    }
    return levels;
  }

  private mapToTrainingModule(doc: any): TrainingModule {
    return {
      id: doc._id?.toString() || doc.id,
      title: doc.title,
      description: doc.description,
      sourceDocuments: doc.sourceDocuments || [],
      learningObjectives: doc.learningObjectives || [],
      content: doc.content || [],
      estimatedDuration: doc.estimatedDuration || 0,
      difficulty: doc.difficulty || 'beginner',
      prerequisites: doc.prerequisites || [],
      category: doc.category || 'General',
      tags: doc.tags || [],
      createdAt: doc.createdAt || new Date(),
      updatedAt: doc.updatedAt || new Date(),
      createdBy: doc.createdBy || '',
      tenantId: doc.tenantId,
      accessLevel: doc.accessLevel || 'PUBLIC',
      isActive: doc.isActive !== false
    };
  }

  private mapToUserProgress(doc: any): UserProgress {
    return {
      id: doc._id?.toString() || doc.id,
      userId: doc.userId,
      moduleId: doc.moduleId,
      progress: doc.progress || 0,
      timeSpent: doc.timeSpent || 0,
      lastAccessed: doc.lastAccessed || new Date(),
      startedAt: doc.startedAt || new Date(),
      completedAt: doc.completedAt,
      completedSections: doc.completedSections || [],
      currentSection: doc.currentSection || '',
      score: doc.score,
      status: doc.status || 'not-started',
      tenantId: doc.tenantId
    };
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

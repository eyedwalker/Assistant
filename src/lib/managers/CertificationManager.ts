import { MongoDBAccessor } from '../accessors/MongoDBAccessor';
import { AnthropicAccessor } from '../accessors/AnthropicAccessor';
import { 
  Assessment, 
  AssessmentAttempt, 
  Certification, 
  Question,
  QuestionAnswer
} from '../../types/training';

export class CertificationManager {
  private mongoAccessor: MongoDBAccessor;
  private anthropicAccessor: AnthropicAccessor;

  constructor() {
    this.mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI || 'mongodb://localhost:27017',
      process.env.MONGODB_DB || 'ai-assistant'
    );
    this.anthropicAccessor = new AnthropicAccessor();
  }

  /**
   * Get assessment for a training module
   */
  async getAssessment(moduleId: string, tenantId: string): Promise<Assessment | null> {
    try {
      const assessment = await this.mongoAccessor.findOne('assessments', {
        moduleId,
        tenantId,
        isActive: true
      });

      return assessment ? this.mapToAssessment(assessment) : null;
    } catch (error) {
      console.error('❌ Error fetching assessment:', error);
      return null;
    }
  }

  /**
   * Start a new assessment attempt
   */
  async startAssessment(
    userId: string, 
    assessmentId: string, 
    tenantId: string
  ): Promise<{ attempt: AssessmentAttempt; questions: Question[] }> {
    try {
      const assessment = await this.mongoAccessor.findById('assessments', assessmentId);
      
      if (!assessment || assessment.tenantId !== tenantId) {
        throw new Error('Assessment not found');
      }

      // Check previous attempts
      const previousAttempts = await this.mongoAccessor.find('assessment_attempts', {
        userId,
        assessmentId,
        tenantId
      });

      if (previousAttempts.length >= assessment.maxAttempts) {
        throw new Error('Maximum attempts exceeded');
      }

      // Create new attempt
      const attempt: AssessmentAttempt = {
        id: this.generateId(),
        userId,
        assessmentId,
        moduleId: assessment.moduleId,
        answers: [],
        score: 0,
        passed: false,
        startedAt: new Date(),
        completedAt: new Date(), // Will be updated when completed
        timeSpent: 0,
        attemptNumber: previousAttempts.length + 1,
        tenantId
      };

      await this.mongoAccessor.create('assessment_attempts', attempt);

      // Prepare questions (randomize if required)
      let questions = [...assessment.questions];
      if (assessment.randomizeQuestions) {
        questions = this.shuffleArray(questions);
      }

      console.log(`📝 Started assessment attempt ${attempt.attemptNumber} for user ${userId}`);
      
      return { attempt, questions };

    } catch (error) {
      console.error('❌ Error starting assessment:', error);
      throw error;
    }
  }

  /**
   * Submit assessment answers and calculate results
   */
  async submitAssessment(
    attemptId: string,
    answers: QuestionAnswer[],
    tenantId: string
  ): Promise<{ attempt: AssessmentAttempt; certification?: Certification }> {
    try {
      const attempt = await this.mongoAccessor.findById('assessment_attempts', attemptId);
      
      if (!attempt || attempt.tenantId !== tenantId) {
        throw new Error('Assessment attempt not found');
      }

      const assessment = await this.mongoAccessor.findById('assessments', attempt.assessmentId);
      if (!assessment) {
        throw new Error('Assessment not found');
      }

      // Calculate score
      const { score, passed, gradedAnswers } = await this.gradeAssessment(answers, assessment.questions, assessment.passingScore);
      
      // Update attempt
      const updatedAttempt: AssessmentAttempt = {
        ...attempt,
        answers: gradedAnswers,
        score,
        passed,
        completedAt: new Date(),
        timeSpent: Math.round((new Date().getTime() - new Date(attempt.startedAt).getTime()) / 1000 / 60) // minutes
      };

      await this.mongoAccessor.update('assessment_attempts', attemptId, updatedAttempt);

      let certification: Certification | undefined;

      // Generate certification if passed
      if (passed) {
        certification = await this.generateCertification(updatedAttempt, assessment, tenantId);
      }

      console.log(`✅ Assessment completed - Score: ${score}%, Passed: ${passed}`);
      
      return { attempt: updatedAttempt, certification };

    } catch (error) {
      console.error('❌ Error submitting assessment:', error);
      throw error;
    }
  }

  /**
   * Get user's certifications
   */
  async getUserCertifications(userId: string, tenantId: string): Promise<Certification[]> {
    try {
      const certifications = await this.mongoAccessor.find('certifications', {
        userId,
        tenantId,
        isValid: true
      });

      return certifications.map(this.mapToCertification);
    } catch (error) {
      console.error('❌ Error fetching user certifications:', error);
      return [];
    }
  }

  /**
   * Get specific certification
   */
  async getCertification(certificationId: string, tenantId: string): Promise<Certification | null> {
    try {
      const certification = await this.mongoAccessor.findById('certifications', certificationId);
      
      if (!certification || certification.tenantId !== tenantId) {
        return null;
      }

      return this.mapToCertification(certification);
    } catch (error) {
      console.error('❌ Error fetching certification:', error);
      return null;
    }
  }

  /**
   * Get assessment attempts for a user
   */
  async getUserAssessmentAttempts(
    userId: string, 
    moduleId: string, 
    tenantId: string
  ): Promise<AssessmentAttempt[]> {
    try {
      const attempts = await this.mongoAccessor.find('assessment_attempts', {
        userId,
        moduleId,
        tenantId
      });

      return attempts.map(this.mapToAssessmentAttempt).sort((a, b) => 
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
    } catch (error) {
      console.error('❌ Error fetching assessment attempts:', error);
      return [];
    }
  }

  /**
   * Check if certification is still valid
   */
  async validateCertification(certificationId: string, tenantId: string): Promise<boolean> {
    try {
      const certification = await this.getCertification(certificationId, tenantId);
      
      if (!certification || !certification.isValid) {
        return false;
      }

      // Check expiration
      if (certification.expiresAt && new Date() > certification.expiresAt) {
        // Mark as expired
        await this.mongoAccessor.update('certifications', certificationId, {
          isValid: false
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Error validating certification:', error);
      return false;
    }
  }

  // Private helper methods

  private async gradeAssessment(
    answers: QuestionAnswer[], 
    questions: Question[], 
    passingScore: number
  ): Promise<{ score: number; passed: boolean; gradedAnswers: QuestionAnswer[] }> {
    
    const gradedAnswers: QuestionAnswer[] = [];
    let totalPoints = 0;
    let earnedPoints = 0;

    for (const question of questions) {
      const userAnswer = answers.find(a => a.questionId === question.id);
      totalPoints += question.points;

      if (userAnswer) {
        const isCorrect = this.checkAnswer(userAnswer.answer, question.correctAnswer, question.type);
        const points = isCorrect ? question.points : 0;
        earnedPoints += points;

        gradedAnswers.push({
          questionId: question.id,
          answer: userAnswer.answer,
          isCorrect,
          points,
          timeSpent: userAnswer.timeSpent || 0
        });
      } else {
        // No answer provided
        gradedAnswers.push({
          questionId: question.id,
          answer: '',
          isCorrect: false,
          points: 0,
          timeSpent: 0
        });
      }
    }

    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const passed = score >= passingScore;

    return { score, passed, gradedAnswers };
  }

  private checkAnswer(userAnswer: string | string[], correctAnswer: string | string[], questionType: string): boolean {
    if (questionType === 'multiple-choice' || questionType === 'true-false') {
      return userAnswer === correctAnswer;
    }
    
    if (questionType === 'drag-drop' && Array.isArray(userAnswer) && Array.isArray(correctAnswer)) {
      return JSON.stringify(userAnswer.sort()) === JSON.stringify(correctAnswer.sort());
    }
    
    if (questionType === 'short-answer') {
      const userText = (userAnswer as string).toLowerCase().trim();
      const correctText = (correctAnswer as string).toLowerCase().trim();
      return userText === correctText || userText.includes(correctText);
    }

    return false;
  }

  private async generateCertification(
    attempt: AssessmentAttempt, 
    assessment: Assessment, 
    tenantId: string
  ): Promise<Certification> {
    
    const certificateNumber = this.generateCertificateNumber();
    const certificateUrl = await this.generateCertificateUrl(attempt, assessment, certificateNumber);
    
    const certification: Certification = {
      id: this.generateId(),
      userId: attempt.userId,
      moduleId: attempt.moduleId,
      assessmentId: attempt.assessmentId,
      title: `${assessment.title} - Certification`,
      description: `Certification of completion for ${assessment.title}`,
      score: attempt.score,
      completedAt: attempt.completedAt,
      expiresAt: this.calculateExpirationDate(),
      certificateUrl,
      certificateNumber,
      isValid: true,
      tenantId,
      metadata: {
        attemptNumber: attempt.attemptNumber,
        timeSpent: attempt.timeSpent
      }
    };

    await this.mongoAccessor.create('certifications', certification);
    
    console.log(`🏆 Certification generated: ${certificateNumber}`);
    return certification;
  }

  private async generateCertificateUrl(
    attempt: AssessmentAttempt, 
    assessment: Assessment, 
    certificateNumber: string
  ): Promise<string> {
    // In a real implementation, this would generate a PDF certificate
    // For now, return a placeholder URL
    return `/api/certificates/${attempt.id}/download`;
  }

  private calculateExpirationDate(): Date {
    // Certificates expire in 2 years
    const expiration = new Date();
    expiration.setFullYear(expiration.getFullYear() + 2);
    return expiration;
  }

  private generateCertificateNumber(): string {
    const prefix = 'CERT';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private mapToAssessment(doc: any): Assessment {
    return {
      id: doc._id?.toString() || doc.id,
      moduleId: doc.moduleId,
      title: doc.title,
      description: doc.description,
      questions: doc.questions || [],
      passingScore: doc.passingScore || 75,
      timeLimit: doc.timeLimit,
      maxAttempts: doc.maxAttempts || 3,
      randomizeQuestions: doc.randomizeQuestions !== false,
      showCorrectAnswers: doc.showCorrectAnswers !== false,
      createdAt: doc.createdAt || new Date(),
      updatedAt: doc.updatedAt || new Date(),
      tenantId: doc.tenantId,
      accessLevel: doc.accessLevel || 'PUBLIC',
      isActive: doc.isActive !== false
    };
  }

  private mapToAssessmentAttempt(doc: any): AssessmentAttempt {
    return {
      id: doc._id?.toString() || doc.id,
      userId: doc.userId,
      assessmentId: doc.assessmentId,
      moduleId: doc.moduleId,
      answers: doc.answers || [],
      score: doc.score || 0,
      passed: doc.passed || false,
      startedAt: doc.startedAt || new Date(),
      completedAt: doc.completedAt || new Date(),
      timeSpent: doc.timeSpent || 0,
      attemptNumber: doc.attemptNumber || 1,
      tenantId: doc.tenantId
    };
  }

  private mapToCertification(doc: any): Certification {
    return {
      id: doc._id?.toString() || doc.id,
      userId: doc.userId,
      moduleId: doc.moduleId,
      assessmentId: doc.assessmentId,
      title: doc.title,
      description: doc.description,
      score: doc.score,
      completedAt: doc.completedAt || new Date(),
      expiresAt: doc.expiresAt,
      certificateUrl: doc.certificateUrl,
      certificateNumber: doc.certificateNumber,
      isValid: doc.isValid !== false,
      tenantId: doc.tenantId,
      metadata: doc.metadata || {}
    };
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

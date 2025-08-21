/**
 * MongoDBAccessor - VBD Accessor Layer
 * 
 * Handles all MongoDB database operations - stable, technology-specific
 * Provides clean interface for data access with no business logic
 */

import { MongoClient, Db, Collection, ObjectId } from 'mongodb';

export interface User {
  _id?: ObjectId;
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string;
  accessLevel: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  _id?: ObjectId;
  tenantId: string;
  userId: string;
  accessLevel: string;
  s3Key: string;
  metadata: any;
  aiAnalysis?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessingJob {
  _id?: ObjectId;
  jobId: string;
  status: string;
  progress: number;
  result?: any;
  error?: string;
  statusMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantLimits {
  tenantId: string;
  maxDocuments: number;
  maxStorageGB: number;
  maxUsersPerMonth: number;
  maxChatMessages: number;
}

export interface TenantUsage {
  tenantId: string;
  documentsProcessed: number;
  storageUsedGB: number;
  activeUsers: number;
  chatMessagesThisMonth: number;
  lastUpdated: Date;
}

export class MongoDBAccessor {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  constructor(private connectionString: string, private databaseName: string) {}

  /**
   * Initialize database connection
   */
  async connect(): Promise<void> {
    try {
      this.client = new MongoClient(this.connectionString, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 15000,
        ssl: true,
        tlsAllowInvalidCertificates: true,
        tlsAllowInvalidHostnames: true,
      });

      await this.client.connect();
      this.db = this.client.db(this.databaseName);
      
      // Create indexes for performance
      await this.createIndexes();
    } catch (error) {
      throw new Error(`Failed to connect to MongoDB: ${error}`);
    }
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }

  /**
   * Create database indexes
   */
  private async createIndexes(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');

    const users = this.db.collection('users');
    const documents = this.db.collection('documents');
    const jobs = this.db.collection('processing_jobs');
    const tenantLimits = this.db.collection('tenant_limits');
    const tenantUsage = this.db.collection('tenant_usage');

    // User indexes
    await users.createIndex({ email: 1 }, { unique: true });
    await users.createIndex({ tenantId: 1 });
    await users.createIndex({ role: 1 });

    // Document indexes
    await documents.createIndex({ tenantId: 1 });
    await documents.createIndex({ userId: 1 });
    await documents.createIndex({ accessLevel: 1 });
    await documents.createIndex({ createdAt: -1 });
    await documents.createIndex({ 'metadata.tags': 1 });

    // Job indexes
    await jobs.createIndex({ jobId: 1 }, { unique: true });
    await jobs.createIndex({ status: 1 });
    await jobs.createIndex({ createdAt: -1 });

    // Tenant indexes
    await tenantLimits.createIndex({ tenantId: 1 }, { unique: true });
    await tenantUsage.createIndex({ tenantId: 1 }, { unique: true });
  }

  // USER OPERATIONS

  /**
   * Find user by ID
   */
  async findUser(userId: string): Promise<User | null> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<User>('users');
    return await collection.findOne({ id: userId });
  }

  /**
   * Find user by email
   */
  async findUserByEmail(email: string): Promise<User | null> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<User>('users');
    return await collection.findOne({ email });
  }

  /**
   * Create new user
   */
  async createUser(user: Omit<User, '_id'>): Promise<string> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<User>('users');
    const result = await collection.insertOne(user);
    return result.insertedId.toString();
  }

  /**
   * Update user
   */
  async updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<User>('users');
    const result = await collection.findOneAndUpdate(
      { id: userId },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    
    return result.value;
  }

  // DOCUMENT OPERATIONS

  /**
   * Create new document
   */
  async createDocument(document: Omit<Document, '_id'>): Promise<string> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<Document>('documents');
    const result = await collection.insertOne(document);
    return result.insertedId.toString();
  }

  /**
   * Find documents by tenant with pagination
   */
  async findDocumentsByTenant(
    tenantId: string, 
    options: { skip?: number; limit?: number; accessLevel?: string } = {}
  ): Promise<Document[]> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<Document>('documents');
    const filter: any = { tenantId };
    
    if (options.accessLevel) {
      filter.accessLevel = options.accessLevel;
    }

    return await collection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(options.skip || 0)
      .limit(options.limit || 50)
      .toArray();
  }

  /**
   * Find documents by user
   */
  async findDocumentsByUser(userId: string, tenantId: string): Promise<Document[]> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<Document>('documents');
    return await collection
      .find({ userId, tenantId })
      .sort({ createdAt: -1 })
      .toArray();
  }

  /**
   * Search documents by content/metadata
   */
  async searchDocuments(
    tenantId: string,
    query: string,
    options: { accessLevel?: string; limit?: number } = {}
  ): Promise<Document[]> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<Document>('documents');
    const filter: any = {
      tenantId,
      $or: [
        { 'metadata.title': { $regex: query, $options: 'i' } },
        { 'metadata.tags': { $regex: query, $options: 'i' } },
        { 'aiAnalysis.keywords': { $regex: query, $options: 'i' } }
      ]
    };

    if (options.accessLevel) {
      filter.accessLevel = options.accessLevel;
    }

    return await collection
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(options.limit || 20)
      .toArray();
  }

  // PROCESSING JOB OPERATIONS

  /**
   * Create processing job
   */
  async createProcessingJob(job: Omit<ProcessingJob, '_id'>): Promise<string> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<ProcessingJob>('processing_jobs');
    const result = await collection.insertOne(job);
    return result.insertedId.toString();
  }

  /**
   * Update processing job
   */
  async updateProcessingJob(jobId: string, updates: Partial<ProcessingJob>): Promise<ProcessingJob> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<ProcessingJob>('processing_jobs');
    const result = await collection.findOneAndUpdate(
      { jobId },
      { $set: updates },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      throw new Error(`Processing job not found: ${jobId}`);
    }
    
    return result.value;
  }

  /**
   * Find processing job by ID
   */
  async findProcessingJob(jobId: string): Promise<ProcessingJob | null> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<ProcessingJob>('processing_jobs');
    return await collection.findOne({ jobId });
  }

  /**
   * Find active processing jobs
   */
  async findActiveJobs(): Promise<ProcessingJob[]> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<ProcessingJob>('processing_jobs');
    return await collection
      .find({ status: { $in: ['pending', 'processing'] } })
      .sort({ createdAt: 1 })
      .toArray();
  }

  // TENANT OPERATIONS

  /**
   * Get tenant limits
   */
  async getTenantLimits(tenantId: string): Promise<TenantLimits> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<TenantLimits>('tenant_limits');
    const limits = await collection.findOne({ tenantId });
    
    // Return default limits if not found
    return limits || {
      tenantId,
      maxDocuments: 1000,
      maxStorageGB: 10,
      maxUsersPerMonth: 100,
      maxChatMessages: 10000
    };
  }

  /**
   * Get tenant usage
   */
  async getTenantUsage(tenantId: string): Promise<TenantUsage> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<TenantUsage>('tenant_usage');
    const usage = await collection.findOne({ tenantId });
    
    // Return default usage if not found
    return usage || {
      tenantId,
      documentsProcessed: 0,
      storageUsedGB: 0,
      activeUsers: 0,
      chatMessagesThisMonth: 0,
      lastUpdated: new Date()
    };
  }

  /**
   * Update tenant usage
   */
  async updateTenantUsage(tenantId: string, updates: Partial<TenantUsage>): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<TenantUsage>('tenant_usage');
    await collection.updateOne(
      { tenantId },
      { 
        $set: { ...updates, lastUpdated: new Date() },
        $setOnInsert: { tenantId }
      },
      { upsert: true }
    );
  }

  // ANALYTICS OPERATIONS

  /**
   * Get document processing statistics
   */
  async getProcessingStats(tenantId: string, days: number = 30): Promise<any> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection('processing_jobs');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const pipeline = [
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgProgress: { $avg: '$progress' }
        }
      }
    ];

    return await collection.aggregate(pipeline).toArray();
  }

  /**
   * Get user activity statistics
   */
  async getUserActivityStats(tenantId: string, days: number = 30): Promise<any> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection('documents');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const pipeline = [
      {
        $match: {
          tenantId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$userId',
          documentCount: { $sum: 1 },
          lastActivity: { $max: '$createdAt' }
        }
      },
      {
        $sort: { documentCount: -1 }
      }
    ];

    return await collection.aggregate(pipeline).toArray();
  }

  // CONVERSATION OPERATIONS

  /**
   * Create conversation session
   */
  async createConversationSession(session: any): Promise<string> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection('conversation_sessions');
    const result = await collection.insertOne(session);
    return result.insertedId.toString();
  }

  /**
   * Find conversation session by ID
   */
  async findConversationSession(sessionId: string): Promise<any | null> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection('conversation_sessions');
    return await collection.findOne({ sessionId });
  }

  /**
   * Find conversation sessions by user
   */
  async findConversationSessions(userId: string, tenantId: string, sessionId?: string): Promise<any[]> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection('conversation_sessions');
    const filter: any = { userId, tenantId };
    
    if (sessionId) {
      filter.sessionId = sessionId;
    }

    return await collection
      .find(filter)
      .sort({ updatedAt: -1 })
      .toArray();
  }

  /**
   * Update conversation session
   */
  async updateConversationSession(sessionId: string, updates: any): Promise<any> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection('conversation_sessions');
    const result = await collection.findOneAndUpdate(
      { sessionId },
      { $set: updates },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      throw new Error(`Conversation session not found: ${sessionId}`);
    }
    
    return result.value;
  }

  /**
   * Add message to session
   */
  async addMessageToSession(sessionId: string, message: any): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection('conversation_sessions');
    await collection.updateOne(
      { sessionId },
      { 
        $push: { messages: message },
        $set: { updatedAt: new Date() }
      }
    );
  }

  /**
   * Find documents by IDs
   */
  async findDocumentsByIds(documentIds: string[], tenantId: string): Promise<any[]> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection('documents');
    const objectIds = documentIds.map(id => new ObjectId(id));
    
    return await collection
      .find({ 
        _id: { $in: objectIds },
        tenantId 
      })
      .toArray();
  }

  // AUDIT AND SECURITY OPERATIONS

  /**
   * Create audit log entry for security and compliance tracking
   */
  async createAuditLog(auditRecord: any): Promise<{ id: string }> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection('audit_logs');
    const record = {
      ...auditRecord,
      _id: new ObjectId(),
      createdAt: new Date()
    };
    
    const result = await collection.insertOne(record);
    return { id: result.insertedId.toString() };
  }

  /**
   * Find audit logs by criteria
   */
  async findAuditLogs(
    tenantId: string,
    filters: {
      userId?: string;
      action?: string;
      startDate?: Date;
      endDate?: Date;
      riskLevel?: string;
    } = {},
    limit: number = 100
  ): Promise<any[]> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection('audit_logs');
    const query: any = { tenantId };
    
    if (filters.userId) query.userId = filters.userId;
    if (filters.action) query.action = filters.action;
    if (filters.riskLevel) query.riskLevel = filters.riskLevel;
    
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = filters.startDate;
      if (filters.endDate) query.createdAt.$lte = filters.endDate;
    }
    
    return await collection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * Get security statistics for compliance reporting
   */
  async getSecurityStats(tenantId: string, days: number = 30): Promise<any> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection('audit_logs');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const pipeline = [
      {
        $match: {
          tenantId,
          createdAt: { $gte: startDate },
          action: { $in: ['SECURITY_SCAN', 'SECURITY_ERROR'] }
        }
      },
      {
        $group: {
          _id: {
            result: '$result',
            riskLevel: '$riskLevel'
          },
          count: { $sum: 1 },
          avgViolations: { $avg: '$violationCount' }
        }
      },
      {
        $sort: { '_id.riskLevel': -1, count: -1 }
      }
    ];

    return await collection.aggregate(pipeline).toArray();
  }

  // GENERIC CRUD OPERATIONS - VBD Accessor Layer
  // These methods provide generic database operations while maintaining clean separation

  /**
   * Generic create operation for any collection
   */
  async create<T>(collectionName: string, document: Omit<T, '_id'>): Promise<string> {
    if (!this.db) {
      await this.connect();
    }
    
    const collection = this.db!.collection(collectionName);
    const result = await collection.insertOne(document as any);
    return result.insertedId.toString();
  }

  /**
   * Generic findById operation for any collection
   */
  async findById<T = any>(collectionName: string, id: string): Promise<T | null> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection(collectionName);
    return await collection.findOne({ _id: new ObjectId(id) }) as T | null;
  }

  /**
   * Generic find operation for any collection
   */
  async find<T = any>(collectionName: string, filter: any = {}, options: {
    sort?: any;
    skip?: number;
    limit?: number;
  } = {}): Promise<T[]> {
    if (!this.db) {
      await this.connect();
    }

    const collection = this.db!.collection(collectionName);
    const cursor = collection.find(filter);

    if (options.sort) {
      cursor.sort(options.sort);
    }
    if (options.skip) {
      cursor.skip(options.skip);
    }
    if (options.limit) {
      cursor.limit(options.limit);
    }

    return await cursor.toArray() as T[];
  }

  /**
   * Generic findOne operation for any collection
   */
  async findOne<T = any>(collectionName: string, filter: any = {}): Promise<T | null> {
    if (!this.db) {
      await this.connect();
    }

    const collection = this.db!.collection(collectionName);
    return await collection.findOne(filter) as T | null;
  }

  /**
   * Generic update operation for any collection
   */
  async update<T = any>(collectionName: string, id: string, updates: Partial<T>): Promise<T | null> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection(collectionName);
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    
    return result.value as T | null;
  }

  /**
   * Generic delete operation for any collection
   */
  async delete(collectionName: string, id: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection(collectionName);
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }

  /**
   * Update documents with custom filter (for non-ObjectId queries)
   */
  async updateWithFilter<T = any>(collectionName: string, filter: any, updates: any): Promise<any> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection(collectionName);
    return await collection.updateOne(filter, updates);
  }

  /**
   * Update multiple documents with custom filter
   */
  async updateManyWithFilter<T = any>(collectionName: string, filter: any, updates: any): Promise<any> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection(collectionName);
    return await collection.updateMany(filter, updates);
  }

  /**
   * Delete documents with custom filter (for non-ObjectId queries)
   */
  async deleteWithFilter(collectionName: string, filter: any): Promise<boolean> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection(collectionName);
    const result = await collection.deleteOne(filter);
    return result.deletedCount > 0;
  }

  /**
   * Generic deleteMany operation for any collection
   */
  async deleteMany(collectionName: string, filter: any): Promise<number> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection(collectionName);
    const result = await collection.deleteMany(filter);
    return result.deletedCount;
  }

  /**
   * Generic count operation for any collection
   */
  async count(collectionName: string, filter: any = {}): Promise<number> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection(collectionName);
    return await collection.countDocuments(filter);
  }

  /**
   * Generic aggregate operation for any collection
   */
  async aggregate<T = any>(collectionName: string, pipeline: any[]): Promise<T[]> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection(collectionName);
    return await collection.aggregate(pipeline).toArray() as T[];
  }
}

import { MongoClient, Db, Collection } from 'mongodb';
import { 
  DocumentMetadata, 
  ProcessingLog, 
  ChatMessage, 
  ConversationMetadata, 
  User, 
  ProcessingJob,
  AccessLevel 
} from '@/types';

class MongoDBService {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private isConnected = false;

  constructor() {
    this.connect();
  }

  private async connect(): Promise<void> {
    try {
      if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI environment variable is not set');
      }

      this.client = new MongoClient(process.env.MONGODB_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      await this.client.connect();
      this.db = this.client.db();
      this.isConnected = true;

      console.log('Connected to MongoDB Atlas');
      
      // Create indexes for better performance
      await this.createIndexes();
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  private async createIndexes(): Promise<void> {
    if (!this.db) return;

    try {
      // Document metadata indexes
      await this.db.collection('documents').createIndexes([
        { key: { accessLevel: 1, accessId: 1 } },
        { key: { status: 1 } },
        { key: { uploadedBy: 1 } },
        { key: { createdAt: -1 } },
        { key: { 'ai_analysis.keywords': 1 } },
        { key: { fileType: 1 } },
        { key: { contentHash: 1 }, unique: true, sparse: true }
      ]);

      // Chat messages indexes
      await this.db.collection('chat_messages').createIndexes([
        { key: { conversationId: 1, timestamp: -1 } },
        { key: { userId: 1 } },
        { key: { accessLevel: 1, accessId: 1 } }
      ]);

      // Conversations indexes
      await this.db.collection('conversations').createIndexes([
        { key: { userId: 1, lastUpdatedAt: -1 } },
        { key: { accessLevel: 1, accessId: 1 } }
      ]);

      // Users indexes
      await this.db.collection('users').createIndexes([
        { key: { email: 1 }, unique: true },
        { key: { accessLevel: 1, accessId: 1 } }
      ]);

      // Processing jobs indexes
      await this.db.collection('processing_jobs').createIndexes([
        { key: { status: 1, priority: -1 } },
        { key: { createdAt: -1 } },
        { key: { type: 1 } }
      ]);

      console.log('Database indexes created successfully');
    } catch (error) {
      console.error('Failed to create indexes:', error);
    }
  }

  async ensureConnection(): Promise<void> {
    if (!this.isConnected || !this.client) {
      await this.connect();
    }
  }

  private getCollection<T = any>(name: string): Collection<T> {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    return this.db.collection<T>(name);
  }

  // Document Management Methods
  async createDocument(document: Omit<DocumentMetadata, 'id'>): Promise<string> {
    await this.ensureConnection();
    const collection = this.getCollection<DocumentMetadata>('documents');
    
    const result = await collection.insertOne({
      ...document,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
    } as DocumentMetadata);

    return result.insertedId.toString();
  }

  async getDocument(id: string, userAccessLevel: AccessLevel, userAccessId: string): Promise<DocumentMetadata | null> {
    await this.ensureConnection();
    const collection = this.getCollection<DocumentMetadata>('documents');
    
    const query: any = { id };
    
    // Enforce access control
    if (userAccessLevel !== AccessLevel.PUBLIC) {
      query.$or = [
        { accessLevel: AccessLevel.PUBLIC },
        { accessLevel: userAccessLevel, accessId: userAccessId }
      ];
    }

    return await collection.findOne(query);
  }

  async updateDocument(id: string, updates: Partial<DocumentMetadata>): Promise<boolean> {
    await this.ensureConnection();
    const collection = this.getCollection<DocumentMetadata>('documents');
    
    const result = await collection.updateOne(
      { id },
      { 
        $set: { 
          ...updates, 
          lastUpdatedAt: new Date() 
        } 
      }
    );

    return result.modifiedCount > 0;
  }

  async deleteDocument(id: string): Promise<boolean> {
    await this.ensureConnection();
    const collection = this.getCollection<DocumentMetadata>('documents');
    
    const result = await collection.deleteOne({ id });
    return result.deletedCount > 0;
  }

  async getDocuments(
    userAccessLevel: AccessLevel, 
    userAccessId: string,
    filters: any = {},
    page = 1,
    limit = 20
  ): Promise<{ documents: DocumentMetadata[], total: number }> {
    await this.ensureConnection();
    const collection = this.getCollection<DocumentMetadata>('documents');
    
    const query: any = { ...filters };
    
    // Enforce access control
    if (userAccessLevel !== AccessLevel.PUBLIC) {
      query.$or = [
        { accessLevel: AccessLevel.PUBLIC },
        { accessLevel: userAccessLevel, accessId: userAccessId }
      ];
    }

    const skip = (page - 1) * limit;
    
    const [documents, total] = await Promise.all([
      collection.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(query)
    ]);

    return { documents, total };
  }

  async addProcessingLog(documentId: string, log: ProcessingLog): Promise<boolean> {
    await this.ensureConnection();
    const collection = this.getCollection<DocumentMetadata>('documents');
    
    const result = await collection.updateOne(
      { id: documentId },
      { 
        $push: { processingLogs: log },
        $set: { lastUpdatedAt: new Date() }
      }
    );

    return result.modifiedCount > 0;
  }

  // Chat and Conversation Methods
  async createConversation(conversation: Omit<ConversationMetadata, 'id'>): Promise<string> {
    await this.ensureConnection();
    const collection = this.getCollection<ConversationMetadata>('conversations');
    
    const result = await collection.insertOne({
      ...conversation,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      messageCount: 0,
    } as ConversationMetadata);

    return result.insertedId.toString();
  }

  async addChatMessage(message: Omit<ChatMessage, 'id'>): Promise<string> {
    await this.ensureConnection();
    const messagesCollection = this.getCollection<ChatMessage>('chat_messages');
    const conversationsCollection = this.getCollection<ConversationMetadata>('conversations');
    
    const messageId = crypto.randomUUID();
    
    // Insert message
    await messagesCollection.insertOne({
      ...message,
      id: messageId,
      timestamp: new Date(),
    } as ChatMessage);

    // Update conversation metadata
    await conversationsCollection.updateOne(
      { id: message.conversationId },
      { 
        $inc: { messageCount: 1 },
        $set: { lastUpdatedAt: new Date() }
      }
    );

    return messageId;
  }

  async getChatMessages(
    conversationId: string, 
    limit = 50
  ): Promise<ChatMessage[]> {
    await this.ensureConnection();
    const collection = this.getCollection<ChatMessage>('chat_messages');
    
    return await collection.find({ conversationId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  async getUserConversations(
    userId: string,
    userAccessLevel: AccessLevel,
    userAccessId: string,
    page = 1,
    limit = 20
  ): Promise<{ conversations: ConversationMetadata[], total: number }> {
    await this.ensureConnection();
    const collection = this.getCollection<ConversationMetadata>('conversations');
    
    const query: any = { userId };
    
    // Enforce access control
    if (userAccessLevel !== AccessLevel.PUBLIC) {
      query.$or = [
        { accessLevel: AccessLevel.PUBLIC },
        { accessLevel: userAccessLevel, accessId: userAccessId }
      ];
    }

    const skip = (page - 1) * limit;
    
    const [conversations, total] = await Promise.all([
      collection.find(query)
        .sort({ lastUpdatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(query)
    ]);

    return { conversations, total };
  }

  // User Management Methods
  async createUser(user: Omit<User, 'id'>): Promise<string> {
    await this.ensureConnection();
    const collection = this.getCollection<User>('users');
    
    const result = await collection.insertOne({
      ...user,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      isActive: true,
    } as User);

    return result.insertedId.toString();
  }

  async getUserByEmail(email: string): Promise<User | null> {
    await this.ensureConnection();
    const collection = this.getCollection<User>('users');
    
    return await collection.findOne({ email });
  }

  async getUserById(id: string): Promise<User | null> {
    await this.ensureConnection();
    const collection = this.getCollection<User>('users');
    
    return await collection.findOne({ id });
  }

  async updateUser(id: string, updates: Partial<User>): Promise<boolean> {
    await this.ensureConnection();
    const collection = this.getCollection<User>('users');
    
    const result = await collection.updateOne(
      { id },
      { $set: updates }
    );

    return result.modifiedCount > 0;
  }

  // Processing Jobs Methods
  async createProcessingJob(job: Omit<ProcessingJob, 'id'>): Promise<string> {
    await this.ensureConnection();
    const collection = this.getCollection<ProcessingJob>('processing_jobs');
    
    const result = await collection.insertOne({
      ...job,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      retryCount: 0,
    } as ProcessingJob);

    return result.insertedId.toString();
  }

  async getNextProcessingJob(): Promise<ProcessingJob | null> {
    await this.ensureConnection();
    const collection = this.getCollection<ProcessingJob>('processing_jobs');
    
    return await collection.findOneAndUpdate(
      { status: 'queued' },
      { 
        $set: { 
          status: 'processing', 
          startedAt: new Date() 
        } 
      },
      { 
        sort: { priority: -1, createdAt: 1 },
        returnDocument: 'after'
      }
    );
  }

  async updateProcessingJob(id: string, updates: Partial<ProcessingJob>): Promise<boolean> {
    await this.ensureConnection();
    const collection = this.getCollection<ProcessingJob>('processing_jobs');
    
    const result = await collection.updateOne(
      { id },
      { $set: updates }
    );

    return result.modifiedCount > 0;
  }

  // Search Methods
  async searchDocuments(
    query: string,
    userAccessLevel: AccessLevel,
    userAccessId: string,
    filters: any = {},
    limit = 20
  ): Promise<DocumentMetadata[]> {
    await this.ensureConnection();
    const collection = this.getCollection<DocumentMetadata>('documents');
    
    const searchQuery: any = {
      $and: [
        {
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { 'ai_analysis.summary': { $regex: query, $options: 'i' } },
            { 'ai_analysis.keywords': { $in: [new RegExp(query, 'i')] } },
            { extractedText: { $regex: query, $options: 'i' } }
          ]
        },
        filters
      ]
    };

    // Enforce access control
    if (userAccessLevel !== AccessLevel.PUBLIC) {
      searchQuery.$and.push({
        $or: [
          { accessLevel: AccessLevel.PUBLIC },
          { accessLevel: userAccessLevel, accessId: userAccessId }
        ]
      });
    }

    return await collection.find(searchQuery)
      .limit(limit)
      .toArray();
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      this.client = null;
      this.db = null;
    }
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      await this.ensureConnection();
      await this.db?.admin().ping();
      return true;
    } catch (error) {
      console.error('MongoDB health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const mongoService = new MongoDBService();
export default mongoService;

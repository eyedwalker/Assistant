// Local vector store for testing RAG functionality without OpenSearch
import { VectorSearchResult } from '@/types';

export interface Document {
  id: string;
  content: string;
  metadata: {
    title: string;
    source: string;
    contentType: 'video' | 'document' | 'url' | 'training';
    accessLevel: string;
  };
  embedding?: number[];
}

export class LocalVectorStore {
  private documents: Document[] = [];
  
  constructor() {
    // Initialize with some sample eyecare content
    this.initializeSampleData();
  }

  private initializeSampleData() {
    const sampleDocs: Document[] = [
      {
        id: '1',
        content: 'Contact lens care involves daily cleaning with approved solution, proper storage in fresh solution, and regular replacement according to the prescribed schedule.',
        metadata: {
          title: 'Contact Lens Care Basics',
          source: 'https://eyefinity.com/contact-care',
          contentType: 'training',
          accessLevel: 'PUBLIC'
        }
      },
      {
        id: '2', 
        content: 'Eyefinity Practice Management System allows you to schedule appointments, manage patient records, process insurance claims, and track inventory seamlessly.',
        metadata: {
          title: 'Eyefinity Practice Management Overview',
          source: 'https://eyefinity.com/practice-management',
          contentType: 'training',
          accessLevel: 'PUBLIC'
        }
      },
      {
        id: '3',
        content: 'When fitting contact lenses, consider patient lifestyle, tear film quality, and corneal curvature. Always follow manufacturer guidelines for base curve and diameter selection.',
        metadata: {
          title: 'Contact Lens Fitting Guide',
          source: 'https://eyefinity.com/fitting-guide',
          contentType: 'training',
          accessLevel: 'PUBLIC'
        }
      }
    ];
    
    this.documents = sampleDocs;
  }

  async addDocument(doc: Document): Promise<void> {
    this.documents.push(doc);
  }

  async search(query: string, limit: number = 5): Promise<VectorSearchResult[]> {
    // Simple keyword matching for demo (in production, use proper vector similarity)
    const queryLower = query.toLowerCase();
    
    const results = this.documents
      .map(doc => {
        const contentLower = doc.content.toLowerCase();
        const titleLower = doc.metadata.title.toLowerCase();
        
        // Calculate simple relevance score based on keyword matches
        let score = 0;
        const queryWords = queryLower.split(' ');
        
        queryWords.forEach(word => {
          if (contentLower.includes(word)) score += 0.3;
          if (titleLower.includes(word)) score += 0.5;
        });
        
        return {
          id: doc.id,
          content: doc.content,
          score: Math.min(score, 1.0),
          metadata: doc.metadata
        };
      })
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    return results;
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<void> {
    const index = this.documents.findIndex(doc => doc.id === id);
    if (index !== -1) {
      this.documents[index] = { ...this.documents[index], ...updates };
    }
  }

  async deleteDocument(id: string): Promise<void> {
    this.documents = this.documents.filter(doc => doc.id !== id);
  }

  async getDocumentCount(): Promise<number> {
    return this.documents.length;
  }
}

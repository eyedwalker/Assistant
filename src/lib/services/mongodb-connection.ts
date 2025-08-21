import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectToDatabase() {
  if (client && db) {
    return { client, db };
  }

  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    client = new MongoClient(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 15000,
      ssl: true,
      tlsAllowInvalidCertificates: true,
      tlsAllowInvalidHostnames: true,
    });

    await client.connect();
    db = client.db();
    
    console.log('Connected to MongoDB Atlas successfully');
    return { client, db };
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    // Don't throw error, return null to allow app to continue
    return { client: null, db: null };
  }
}

export async function disconnectFromDatabase() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

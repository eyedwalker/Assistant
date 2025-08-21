const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
console.log('Testing MongoDB connection...');
console.log('URI exists:', !!uri);

// Try with minimal options first
const client = new MongoClient(uri);

async function test() {
  try {
    await client.connect();
    console.log('✅ Connected successfully');
    const db = client.db();
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    
    // Test documents collection for RAG
    const documents = await db.collection('documents').find({}).limit(3).toArray();
    console.log('Sample documents found:', documents.length);
    if (documents.length > 0) {
      console.log('First document fields:', Object.keys(documents[0]));
      console.log('Title:', documents[0].title);
      console.log('ContentType:', documents[0].contentType);
      console.log('Has extractedText:', !!documents[0].extractedText);
      console.log('Has aiAnalysis:', !!documents[0].aiAnalysis);
    }
    
    await client.close();
    console.log('Connection test complete');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error details:', error.name, error.code);
  }
}

test();

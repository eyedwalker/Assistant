const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

async function createTextIndex() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(process.env.MONGODB_DB_NAME || 'ai-assistant-platform');
    const collection = db.collection('processed_content');
    
    // Create text index on content-related fields
    console.log('📚 Creating text index on processed_content collection...');
    await collection.createIndex(
      {
        title: 'text',
        content: 'text',
        summary: 'text',
        'metadata.description': 'text',
        'metadata.keywords': 'text'
      },
      {
        name: 'content_text_index',
        weights: {
          title: 10,
          summary: 5,
          content: 3,
          'metadata.keywords': 2,
          'metadata.description': 1
        }
      }
    );
    
    console.log('✅ Text index created successfully!');
    
    // List all indexes to verify
    const indexes = await collection.indexes();
    console.log('\n📑 Current indexes on processed_content:');
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    // Check for daily closing content
    console.log('\n🔍 Checking for daily closing content...');
    const dailyClosingContent = await collection.find({
      $or: [
        { title: { $regex: 'daily closing', $options: 'i' } },
        { content: { $regex: 'daily closing', $options: 'i' } }
      ]
    }).limit(5).toArray();
    
    if (dailyClosingContent.length > 0) {
      console.log(`✅ Found ${dailyClosingContent.length} document(s) about daily closing:`);
      dailyClosingContent.forEach(doc => {
        console.log(`  - ${doc.title || 'Untitled'} (${doc.contentType})`);
        if (doc.embedding) {
          console.log(`    ✓ Has embedding (length: ${doc.embedding.length})`);
        } else {
          console.log('    ⚠️ Missing embedding');
        }
      });
    } else {
      console.log('⚠️ No daily closing content found in database');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

createTextIndex();

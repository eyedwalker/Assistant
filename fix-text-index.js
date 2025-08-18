const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Read .env file manually
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
});

async function createTextIndex() {
  const client = new MongoClient(envVars.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(envVars.MONGODB_DB_NAME || 'ai-assistant-platform');
    const collection = db.collection('processed_content');
    
    // Drop existing text index if any
    try {
      await collection.dropIndex('content_text_index');
      console.log('🗑️ Dropped existing text index');
    } catch (e) {
      // Index doesn't exist, that's fine
    }
    
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
        { content: { $regex: 'daily closing', $options: 'i' } },
        { summary: { $regex: 'daily closing', $options: 'i' } }
      ]
    }).limit(5).toArray();
    
    if (dailyClosingContent.length > 0) {
      console.log(`✅ Found ${dailyClosingContent.length} document(s) about daily closing:`);
      dailyClosingContent.forEach(doc => {
        console.log(`\n  📄 ${doc.title || 'Untitled'}`);
        console.log(`     Type: ${doc.contentType}`);
        console.log(`     Source: ${doc.sourceUrl || 'N/A'}`);
        if (doc.embedding && doc.embedding.length > 0) {
          console.log(`     ✓ Has embedding (dimensions: ${doc.embedding.length})`);
        } else {
          console.log('     ⚠️ Missing embedding');
        }
        if (doc.summary) {
          console.log(`     Summary: ${doc.summary.substring(0, 100)}...`);
        }
      });
      
      // Test text search
      console.log('\n🧪 Testing text search for "daily closing"...');
      const textSearchResults = await collection.find(
        { $text: { $search: 'daily closing' } },
        { projection: { score: { $meta: 'textScore' } } }
      ).sort({ score: { $meta: 'textScore' } }).limit(3).toArray();
      
      if (textSearchResults.length > 0) {
        console.log(`✅ Text search working! Found ${textSearchResults.length} results:`);
        textSearchResults.forEach(doc => {
          console.log(`  - ${doc.title || 'Untitled'} (score: ${doc.score.toFixed(2)})`);
        });
      }
    } else {
      console.log('⚠️ No daily closing content found in database');
      console.log('   You may need to re-upload or re-process the daily closing document');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

createTextIndex();

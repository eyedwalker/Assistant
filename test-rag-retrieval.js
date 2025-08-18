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

async function testRAGRetrieval() {
  const client = new MongoClient(envVars.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(envVars.MONGODB_DB_NAME || 'ai-assistant-platform');
    const collection = db.collection('processed_content');
    
    // Test 1: Text search for daily closing
    console.log('\n🔍 Testing text search for "daily closing keyboard shortcut"...');
    const textResults = await collection.find(
      { $text: { $search: 'daily closing keyboard shortcut' } },
      { 
        projection: { 
          score: { $meta: 'textScore' },
          title: 1,
          content: 1
        }
      }
    ).sort({ score: { $meta: 'textScore' } }).limit(5).toArray();
    
    console.log(`Found ${textResults.length} results via text search`);
    textResults.forEach((doc, i) => {
      console.log(`\n  Result ${i + 1}:`);
      console.log(`    Title: ${doc.title}`);
      console.log(`    Score: ${doc.score}`);
      
      // Search for keyboard shortcut in content
      const content = doc.content || '';
      const shortcutMatch = content.match(/keyboard shortcut[^.]*Ctrl[^.\n]*/i);
      if (shortcutMatch) {
        console.log(`    Keyboard shortcut found: "${shortcutMatch[0]}"`);
      }
      
      // Also look for the specific line
      const lines = content.split('\n');
      const shortcutLine = lines.find(line => line.toLowerCase().includes('ctrl') && line.toLowerCase().includes('shift'));
      if (shortcutLine) {
        console.log(`    Actual shortcut line: "${shortcutLine.trim()}"`);
      }
    });
    
    // Test 2: Direct regex search
    console.log('\n🔍 Direct regex search for Ctrl+Shift+D...');
    const regexResults = await collection.find({
      content: { $regex: 'Ctrl\\+Shift\\+D', $options: 'i' }
    }).toArray();
    
    console.log(`Found ${regexResults.length} documents containing "Ctrl+Shift+D"`);
    regexResults.forEach(doc => {
      console.log(`  - ${doc.title}`);
    });
    
    // Test 3: Check conversations collection for recent RAG context
    console.log('\n💬 Checking recent conversations for RAG context...');
    const conversationsCollection = db.collection('conversations');
    const recentConversation = await conversationsCollection.findOne(
      {},
      { sort: { updatedAt: -1 } }
    );
    
    if (recentConversation) {
      console.log('  Latest conversation ID:', recentConversation._id);
      console.log('  Updated:', recentConversation.updatedAt);
      
      // Check if messages contain RAG context
      if (recentConversation.messages && recentConversation.messages.length > 0) {
        const lastMessage = recentConversation.messages[recentConversation.messages.length - 1];
        if (lastMessage.ragContext) {
          console.log('  RAG Context present:', lastMessage.ragContext ? '✅' : '❌');
          if (lastMessage.ragContext) {
            console.log('  RAG Context preview:', JSON.stringify(lastMessage.ragContext).substring(0, 200));
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

testRAGRetrieval();

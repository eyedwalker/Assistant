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

async function checkAllContent() {
  const client = new MongoClient(envVars.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(envVars.MONGODB_DB_NAME || 'ai-assistant-platform');
    const collection = db.collection('processed_content');
    
    // Count all documents
    const totalCount = await collection.countDocuments();
    console.log(`\n📊 Total documents in processed_content: ${totalCount}`);
    
    if (totalCount > 0) {
      // Get document types
      const types = await collection.distinct('contentType');
      console.log('\n📁 Content types:', types);
      
      // Get recent documents
      console.log('\n📄 Recent documents (last 10):');
      const recentDocs = await collection.find({})
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();
      
      recentDocs.forEach(doc => {
        console.log(`\n  📄 ${doc.title || 'Untitled'}`);
        console.log(`     ID: ${doc._id}`);
        console.log(`     Type: ${doc.contentType}`);
        console.log(`     Source: ${doc.sourceUrl || 'N/A'}`);
        console.log(`     Created: ${doc.createdAt}`);
        console.log(`     Has embedding: ${doc.embedding && doc.embedding.length > 0 ? '✅' : '❌'}`);
        if (doc.content) {
          console.log(`     Content preview: ${doc.content.substring(0, 100)}...`);
        }
      });
      
      // Check for documents with "daily" or "closing" keywords
      console.log('\n🔍 Searching for daily/closing related content...');
      const relatedDocs = await collection.find({
        $or: [
          { title: { $regex: 'daily|closing', $options: 'i' } },
          { content: { $regex: 'daily|closing', $options: 'i' } },
          { summary: { $regex: 'daily|closing', $options: 'i' } }
        ]
      }).toArray();
      
      if (relatedDocs.length > 0) {
        console.log(`✅ Found ${relatedDocs.length} documents with daily/closing keywords:`);
        relatedDocs.forEach(doc => {
          console.log(`  - ${doc.title || 'Untitled'} (${doc.contentType})`);
        });
      } else {
        console.log('❌ No documents found with daily/closing keywords');
      }
      
      // Check for embeddings
      const docsWithEmbeddings = await collection.countDocuments({ 
        embedding: { $exists: true, $ne: [] } 
      });
      console.log(`\n🧠 Documents with embeddings: ${docsWithEmbeddings}/${totalCount}`);
      
    } else {
      console.log('\n⚠️ No documents found in processed_content collection');
      console.log('   The database appears to be empty. You need to upload and process documents.');
    }
    
    // Check processing_jobs collection
    const jobsCollection = db.collection('processing_jobs');
    const recentJobs = await jobsCollection.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();
    
    if (recentJobs.length > 0) {
      console.log('\n📋 Recent processing jobs:');
      recentJobs.forEach(job => {
        console.log(`  - ${job._id}: ${job.status} (${job.sourceType || 'N/A'}) - ${job.createdAt}`);
        if (job.error) {
          console.log(`    Error: ${job.error}`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

checkAllContent();

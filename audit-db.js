const { MongoClient } = require('mongodb');

async function auditDatabase() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://daviwa2:yj6RqTuSoRyyOL2u@cluster0.ekccbhk.mongodb.net/ai-assistant-platform?retryWrites=true&w=majority&appName=Cluster0';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('🔗 Connected to MongoDB Atlas');
    
    const db = client.db('ai-assistant-platform');
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log('\n📊 DATABASE AUDIT REPORT');
    console.log('========================');
    console.log('Database:', db.databaseName);
    console.log('Collections found:', collections.length);
    
    for (const collection of collections) {
      console.log(`\n🗂️  Collection: ${collection.name}`);
      
      const coll = db.collection(collection.name);
      const count = await coll.countDocuments();
      console.log(`   📄 Document count: ${count}`);
      
      if (count > 0) {
        // Get sample document to check schema
        const sample = await coll.findOne();
        console.log(`   🔍 Sample document keys:`, Object.keys(sample));
        
        // Check for specific RAG-related fields
        if (sample.vector) {
          console.log(`   🎯 Vector field found (length: ${sample.vector.length})`);
        }
        if (sample.metadata) {
          console.log(`   📋 Metadata keys:`, Object.keys(sample.metadata));
        }
        if (sample.content) {
          console.log(`   📝 Content field found (length: ${sample.content.length})`);
        }
        if (sample.userId || sample.tenantId) {
          console.log(`   👤 User/Tenant fields: userId=${!!sample.userId}, tenantId=${!!sample.tenantId}`);
        }
        if (sample.jobId) {
          console.log(`   🔧 Job tracking: jobId=${!!sample.jobId}, status=${sample.status}`);
        }
      }
    }
    
    // Check vector search index
    console.log('\n🔍 VECTOR SEARCH INDEX AUDIT');
    console.log('=============================');
    try {
      const vectorColl = db.collection('vectors');
      const indexes = await vectorColl.listSearchIndexes().toArray();
      console.log('Vector search indexes:', indexes.length);
      
      for (const index of indexes) {
        console.log(`   📊 Index: ${index.name} (${index.type}) - Status: ${index.status}`);
        if (index.latestDefinition) {
          console.log(`   🎯 Vector dimensions: ${index.latestDefinition.fields.find(f => f.type === 'vector')?.numDimensions || 'N/A'}`);
        }
      }
    } catch (error) {
      console.log('   ❌ Vector search index check failed:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Database audit failed:', error);
  } finally {
    await client.close();
  }
}

auditDatabase();

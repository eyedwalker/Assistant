const { MongoClient } = require('mongodb');

async function fixDatabaseSchema() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://daviwa2:yj6RqTuSoRyyOL2u@cluster0.ekccbhk.mongodb.net/ai-assistant-platform?retryWrites=true&w=majority&appName=Cluster0';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('🔗 Connected to MongoDB Atlas');
    
    const db = client.db('ai-assistant-platform');
    
    console.log('\n🔧 FIXING DATABASE SCHEMA INCONSISTENCIES');
    console.log('==========================================');
    
    // Step 1: Check current state
    const documentsCount = await db.collection('documents').countDocuments();
    const contentsCount = await db.collection('contents').countDocuments();
    const vectorsCount = await db.collection('vectors').countDocuments();
    
    console.log(`📊 Current state:`);
    console.log(`   - documents: ${documentsCount}`);
    console.log(`   - contents: ${contentsCount}`);
    console.log(`   - vectors: ${vectorsCount}`);
    
    // Step 2: Ensure all content documents have proper user/tenant fields
    console.log('\n🔄 Step 1: Fixing user/tenant fields in contents...');
    const contentsWithoutUser = await db.collection('contents').find({
      $or: [
        { userId: { $exists: false } },
        { tenantId: { $exists: false } },
        { userId: null },
        { tenantId: null }
      ]
    }).toArray();
    
    console.log(`   Found ${contentsWithoutUser.length} contents without proper user/tenant fields`);
    
    for (const content of contentsWithoutUser) {
      await db.collection('contents').updateOne(
        { _id: content._id },
        {
          $set: {
            userId: content.userId || 'demo-user',
            tenantId: content.tenantId || 'demo-tenant',
            accessLevel: content.accessLevel || 'ACCOUNT'
          }
        }
      );
    }
    
    // Step 3: Ensure all vectors have proper metadata
    console.log('\n🔄 Step 2: Fixing vector metadata...');
    const vectorsWithoutMetadata = await db.collection('vectors').find({
      $or: [
        { 'metadata.userId': { $exists: false } },
        { 'metadata.tenantId': { $exists: false } }
      ]
    }).toArray();
    
    console.log(`   Found ${vectorsWithoutMetadata.length} vectors without proper metadata`);
    
    for (const vector of vectorsWithoutMetadata) {
      await db.collection('vectors').updateOne(
        { _id: vector._id },
        {
          $set: {
            'metadata.userId': vector.metadata?.userId || 'demo-user',
            'metadata.tenantId': vector.metadata?.tenantId || 'demo-tenant',
            'metadata.accessLevel': vector.metadata?.accessLevel || 'ACCOUNT'
          }
        }
      );
    }
    
    // Step 4: Create index on contents for RAG retrieval
    console.log('\n🔄 Step 3: Creating indexes for RAG retrieval...');
    try {
      await db.collection('contents').createIndex({ 
        userId: 1, 
        tenantId: 1, 
        accessLevel: 1 
      });
      console.log('   ✅ Created index on contents collection');
    } catch (error) {
      console.log('   ⚠️ Index already exists or creation failed:', error.message);
    }
    
    // Step 5: Verify data consistency
    console.log('\n🔍 Step 4: Verifying data consistency...');
    
    // Check for content-vector pairs
    const contentsWithVectors = await db.collection('contents').aggregate([
      {
        $lookup: {
          from: 'vectors',
          localField: '_id',
          foreignField: 'metadata.documentId',
          as: 'vectors'
        }
      },
      {
        $project: {
          _id: 1,
          title: 1,
          userId: 1,
          tenantId: 1,
          hasVectors: { $gt: [{ $size: '$vectors' }, 0] }
        }
      }
    ]).toArray();
    
    const withVectors = contentsWithVectors.filter(c => c.hasVectors).length;
    const withoutVectors = contentsWithVectors.filter(c => !c.hasVectors).length;
    
    console.log(`   📊 Content-Vector consistency:`);
    console.log(`      - Contents with vectors: ${withVectors}`);
    console.log(`      - Contents without vectors: ${withoutVectors}`);
    
    // Step 6: Test RAG retrieval query
    console.log('\n🧪 Step 5: Testing RAG retrieval query...');
    const testQuery = await db.collection('contents').find({
      userId: 'demo-user',
      tenantId: 'demo-tenant',
      content: { $regex: 'Administration', $options: 'i' }
    }).limit(3).toArray();
    
    console.log(`   Found ${testQuery.length} Administration-related documents`);
    for (const doc of testQuery) {
      console.log(`      - ${doc.title}: ${doc.content?.substring(0, 100)}...`);
    }
    
    console.log('\n✅ DATABASE SCHEMA FIX COMPLETED');
    console.log('==================================');
    console.log('Next steps:');
    console.log('1. Test RAG retrieval endpoints');
    console.log('2. Verify AI chat can access processed content');
    console.log('3. Process new documents to test end-to-end pipeline');
    
  } catch (error) {
    console.error('❌ Database schema fix failed:', error);
  } finally {
    await client.close();
  }
}

fixDatabaseSchema();

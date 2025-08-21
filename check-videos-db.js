const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://daviwa2:yj6RqTuSoRyyOL2u@cluster0.ekccbhk.mongodb.net/ai-assistant-platform?retryWrites=true&w=majority&appName=Cluster0';

async function checkVideos() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('ai-assistant-platform');
  
  // Check documents collection
  console.log('=== DOCUMENTS COLLECTION ===');
  const docs = await db.collection('documents').find({ contentType: 'video' }).limit(5).toArray();
  console.log(`Total video documents: ${await db.collection('documents').countDocuments({ contentType: 'video' })}`);
  console.log('\nSample video document:');
  if (docs.length > 0) {
    console.log(JSON.stringify(docs[0], null, 2));
  }
  
  // Check processedVideos collection
  console.log('\n=== PROCESSED VIDEOS COLLECTION ===');
  const processedVideos = await db.collection('processedVideos').find({}).limit(5).toArray();
  console.log(`Total processed videos: ${await db.collection('processedVideos').countDocuments()}`);
  console.log('\nSample processed video:');
  if (processedVideos.length > 0) {
    console.log(JSON.stringify(processedVideos[0], null, 2));
  }
  
  // Check all collections
  console.log('\n=== ALL COLLECTIONS ===');
  const collections = await db.listCollections().toArray();
  for (const coll of collections) {
    const count = await db.collection(coll.name).countDocuments();
    console.log(`${coll.name}: ${count} documents`);
  }
  
  await client.close();
}

checkVideos().catch(console.error);

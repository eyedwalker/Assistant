const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://daviwa2:yj6RqTuSoRyyOL2u@cluster0.ekccbhk.mongodb.net/ai-assistant-platform?retryWrites=true&w=majority&appName=Cluster0';

async function checkVideoStructure() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('ai-assistant-platform');
  
  // Get sample videos with specific fields we need
  const videoSamples = await db.collection('documents')
    .find({ contentType: 'video' })
    .limit(3)
    .project({
      title: 1,
      url: 1,
      contentType: 1,
      source: 1,
      extractedText: 1,
      aiAnalysis: 1,
      accessLevel: 1
    })
    .toArray();
  
  console.log('=== SAMPLE VIDEOS FOR RAG ===');
  videoSamples.forEach((video, i) => {
    console.log(`\n${i + 1}. ${video.title}`);
    console.log(`   URL: ${video.url}`);
    console.log(`   Source: ${video.source}`);
    console.log(`   Has Transcript: ${video.extractedText ? 'Yes' : 'No'} (${video.extractedText?.length || 0} chars)`);
    console.log(`   Has AI Analysis: ${video.aiAnalysis ? 'Yes' : 'No'}`);
    console.log(`   Access Level: ${video.accessLevel}`);
  });
  
  await client.close();
}

checkVideoStructure().catch(console.error);

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function checkNewVideos() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME);
  
  // Find the newly processed videos
  const videos = await db.collection('documents').find(
    { vimeoId: { $in: ['886978226', '886938400'] } },
    { projection: { title: 1, extractedText: 1, vimeoId: 1, aiAnalysis: 1 } }
  ).toArray();
  
  videos.forEach(video => {
    console.log('=== Video:', video.title);
    console.log('Vimeo ID:', video.vimeoId);
    console.log('Transcript Type:', typeof video.extractedText);
    console.log('Transcript Length:', video.extractedText?.length || 0);
    console.log('Has AI Analysis:', !!video.aiAnalysis);
    
    if (video.extractedText && typeof video.extractedText === 'string') {
      console.log('✅ Transcript is STRING (good!)');
      console.log('Preview:', video.extractedText.substring(0, 100) + '...');
    } else if (video.extractedText && typeof video.extractedText === 'object') {
      console.log('❌ Transcript is OBJECT (bad!)');
    } else {
      console.log('⚠️ No transcript found');
    }
    console.log('---\n');
  });
  
  await client.close();
}

checkNewVideos().catch(console.error);

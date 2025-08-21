const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://daviwa2:yj6RqTuSoRyyOL2u@cluster0.ekccbhk.mongodb.net/ai-assistant-platform?retryWrites=true&w=majority&appName=Cluster0';

async function monitorLearningProgress() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('ai-assistant-platform');
  
  console.log('📊 === LEARNING PROGRESS DASHBOARD ===\n');
  
  // Processing statistics
  const totalVideos = await db.collection('documents').countDocuments({ contentType: 'video' });
  const enhancedVideos = await db.collection('documents').countDocuments({ 
    contentType: 'video',
    optimizedForAI: true 
  });
  
  console.log(`🎬 PROCESSING STATUS:`);
  console.log(`   Total Videos: ${totalVideos}`);
  console.log(`   Enhanced: ${enhancedVideos}`);
  console.log(`   Pending: ${totalVideos - enhancedVideos}`);
  console.log(`   Progress: ${Math.round((enhancedVideos / totalVideos) * 100)}%\n`);
  
  // Topic analysis
  const videos = await db.collection('documents')
    .find({ contentType: 'video', optimizedForAI: true })
    .toArray();
  
  console.log(`📚 KNOWLEDGE AREAS LEARNED:`);
  const topics = new Map();
  
  videos.forEach(video => {
    if (video.aiAnalysis) {
      // Extract topics from titles
      const title = video.title.toLowerCase();
      if (title.includes('ehr')) topics.set('EHR Systems', (topics.get('EHR Systems') || 0) + 1);
      if (title.includes('practice management') || title.includes('pm')) topics.set('Practice Management', (topics.get('Practice Management') || 0) + 1);
      if (title.includes('contact lens') || title.includes('cl')) topics.set('Contact Lens', (topics.get('Contact Lens') || 0) + 1);
      if (title.includes('analytics') || title.includes('insights')) topics.set('Analytics & Insights', (topics.get('Analytics & Insights') || 0) + 1);
      if (title.includes('billing') || title.includes('claim')) topics.set('Billing & Claims', (topics.get('Billing & Claims') || 0) + 1);
      if (title.includes('patient')) topics.set('Patient Management', (topics.get('Patient Management') || 0) + 1);
      if (title.includes('vsp')) topics.set('VSP Integration', (topics.get('VSP Integration') || 0) + 1);
    }
  });
  
  [...topics.entries()].sort((a, b) => b[1] - a[1]).forEach(([topic, count]) => {
    console.log(`   ✓ ${topic}: ${count} videos`);
  });
  
  console.log(`\n🧠 RECENT LEARNING (Last 5 Enhanced):`);
  const recentVideos = await db.collection('documents')
    .find({ contentType: 'video', optimizedForAI: true })
    .sort({ reprocessedAt: -1 })
    .limit(5)
    .toArray();
  
  recentVideos.forEach((video, i) => {
    console.log(`   ${i + 1}. ${video.title}`);
    console.log(`      Model: ${video.aiModel}`);
    console.log(`      Enhanced: ${new Date(video.reprocessedAt).toLocaleString()}\n`);
  });
  
  console.log(`💡 AI ASSISTANT CAPABILITIES GAINED:`);
  console.log(`   ✓ Can explain ${enhancedVideos} specific eyecare procedures`);
  console.log(`   ✓ Provides step-by-step software instructions`);
  console.log(`   ✓ Answers common user questions about procedures`);
  console.log(`   ✓ Suggests implementation tips for practice settings`);
  console.log(`   ✓ Links related topics for comprehensive learning`);
  
  await client.close();
}

// Run monitoring
setInterval(() => {
  console.clear();
  monitorLearningProgress().catch(console.error);
}, 30000); // Update every 30 seconds

// Initial run
monitorLearningProgress().catch(console.error);

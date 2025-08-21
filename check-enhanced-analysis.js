const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://daviwa2:yj6RqTuSoRyyOL2u@cluster0.ekccbhk.mongodb.net/ai-assistant-platform?retryWrites=true&w=majority&appName=Cluster0';

async function checkEnhancedAnalysis() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('ai-assistant-platform');
  
  // Check for enhanced videos
  const enhancedVideos = await db.collection('documents')
    .find({ 
      contentType: 'video',
      optimizedForAI: true,
      analysisVersion: '2.0' 
    })
    .toArray();
  
  console.log(`🎬 Enhanced Videos: ${enhancedVideos.length} total`);
  
  // Show sample enhanced analysis
  if (enhancedVideos.length > 0) {
    const sample = enhancedVideos[0];
    
    console.log('\n=== SAMPLE ENHANCED ANALYSIS ===');
    console.log(`Title: ${sample.title}`);
    console.log(`Model Used: ${sample.aiModel}`);
    console.log(`Reprocessed: ${sample.reprocessedAt}`);
    console.log(`Analysis Version: ${sample.analysisVersion}`);
    console.log('\n--- AI ANALYSIS CONTENT ---');
    console.log(sample.aiAnalysis.substring(0, 1000) + '...');
    
    console.log('\n=== DATA STRUCTURE ===');
    console.log('Fields stored for each video:');
    console.log('- title: Video title');
    console.log('- url: Vimeo URL for watching');
    console.log('- extractedText: Full transcript');
    console.log('- aiAnalysis: Enhanced analysis (learning objectives, procedures, Q&As)');
    console.log('- aiModel: claude-3-5-sonnet-20241022');
    console.log('- optimizedForAI: true');
    console.log('- analysisVersion: 2.0');
    console.log('- reprocessedAt: timestamp');
  }
  
  // Check processing status
  const totalVideos = await db.collection('documents').countDocuments({ contentType: 'video' });
  const pendingVideos = totalVideos - enhancedVideos.length;
  
  console.log('\n=== PROCESSING STATUS ===');
  console.log(`✅ Enhanced: ${enhancedVideos.length}`);
  console.log(`⏳ Pending: ${pendingVideos}`);
  console.log(`📊 Progress: ${Math.round((enhancedVideos.length / totalVideos) * 100)}%`);
  
  await client.close();
}

checkEnhancedAnalysis().catch(console.error);

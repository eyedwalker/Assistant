const { MongoClient } = require('mongodb');

async function processAndTestVideo() {
  const mongoUri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME;
  
  console.log('📹 Starting test video processing...\n');
  
  // Step 1: Process a single video
  console.log('Step 1: Processing one video from Vimeo...');
  const processResponse = await globalThis.fetch('http://localhost:3002/api/videos/vimeo-bulk-process', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': process.env.TEST_COOKIE || ''
    },
    body: JSON.stringify({
      limit: 1,  // Process just one video
      processTranscripts: true,
      analyzeContent: true,
      autoCategorizize: true
    })
  });
  
  const processResult = await processResponse.json();
  console.log('Processing Result:', JSON.stringify(processResult, null, 2));
  
  if (!processResult.success || processResult.summary?.successful === 0) {
    console.error('❌ Failed to process video');
    return;
  }
  
  // Wait a moment for processing to complete
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Step 2: Fetch the processed video from MongoDB
  console.log('\n📊 Step 2: Fetching processed video data...');
  const client = new MongoClient(mongoUri);
  await client.connect();
  
  const db = client.db(dbName);
  const processedVideo = await db.collection('processedVideos').findOne({}, {
    sort: { processedAt: -1 }  // Get the most recently processed video
  });
  
  if (!processedVideo) {
    console.error('❌ No processed video found in database');
    await client.close();
    return;
  }
  
  console.log('\n=== VIDEO SUMMARY ===');
  console.log('Title:', processedVideo.name);
  console.log('Duration:', Math.round(processedVideo.duration / 60), 'minutes');
  console.log('Category:', processedVideo.category);
  console.log('Confidence:', processedVideo.confidence);
  console.log('\nAI Summary:');
  console.log(processedVideo.aiSummary || 'No summary available');
  console.log('\nKey Insights:');
  (processedVideo.keyInsights || []).forEach((insight, i) => {
    console.log(`${i + 1}. ${insight}`);
  });
  console.log('\nTopics:', (processedVideo.topics || []).join(', '));
  
  console.log('\n=== TRANSCRIPT (First 500 chars) ===');
  if (processedVideo.transcript) {
    console.log(processedVideo.transcript.substring(0, 500) + '...');
  } else {
    console.log('No transcript available');
  }
  
  // Step 3: Test AI Q&A
  console.log('\n🤖 Step 3: Testing AI Q&A about the video...');
  
  const question = `Based on the video "${processedVideo.name}", what are the main points discussed?`;
  console.log('Question:', question);
  
  const qaResponse = await globalThis.fetch('http://localhost:3002/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': process.env.TEST_COOKIE || ''
    },
    body: JSON.stringify({
      message: question,
      context: {
        videoData: {
          title: processedVideo.name,
          transcript: processedVideo.transcript,
          summary: processedVideo.aiSummary,
          insights: processedVideo.keyInsights
        }
      }
    })
  });
  
  if (qaResponse.ok) {
    const qaResult = await qaResponse.json();
    console.log('\nAI Response:');
    console.log(qaResult.response || qaResult.message || 'No response');
  } else {
    console.log('\n❌ AI Q&A test failed:', qaResponse.status);
  }
  
  await client.close();
  console.log('\n✅ Test complete!');
}

// Load environment variables
require('dotenv').config();

processAndTestVideo().catch(console.error);

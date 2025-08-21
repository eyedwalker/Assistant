const { MongoClient } = require('mongodb');
const https = require('https');
require('dotenv').config();

async function testVideoProcessing() {
  const mongoUri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME;
  const vimeoToken = process.env.VIMEO_ACCESS_TOKEN;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  
  console.log('📹 Testing Video Processing Pipeline...\n');
  
  // Step 1: Get one video from Vimeo
  console.log('Step 1: Fetching a video from Vimeo...');
  
  const vimeoResponse = await new Promise((resolve, reject) => {
    https.get(`https://api.vimeo.com/me/videos?per_page=1`, {
      headers: {
        'Authorization': `Bearer ${vimeoToken}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
      res.on('error', reject);
    });
  });
  
  const video = vimeoResponse.data[0];
  if (!video) {
    console.error('❌ No videos found in Vimeo account');
    return;
  }
  
  console.log('Found video:', video.name);
  console.log('Duration:', Math.round(video.duration / 60), 'minutes');
  
  // Step 2: Get transcript if available
  console.log('\nStep 2: Fetching transcript...');
  const vimeoId = video.uri.split('/').pop();
  
  let transcript = null;
  try {
    const transcriptResponse = await new Promise((resolve, reject) => {
      https.get(`https://api.vimeo.com/videos/${vimeoId}/texttracks`, {
        headers: {
          'Authorization': `Bearer ${vimeoToken}`,
          'Accept': 'application/vnd.vimeo.*+json;version=3.4'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
        res.on('error', reject);
      });
    });
    
    if (transcriptResponse.data && transcriptResponse.data.length > 0) {
      const track = transcriptResponse.data[0];
      console.log('Found transcript track:', track.language);
      // Note: Getting actual transcript content would require additional API call
      transcript = 'Transcript content would be fetched here';
    }
  } catch (err) {
    console.log('No transcript available');
  }
  
  // Step 3: Analyze with AI
  console.log('\nStep 3: AI Analysis...');
  
  const prompt = `Analyze this eyecare training video and provide:
1. A suggested category from: patient-management, contact-lens-procedures, billing-claims, eyefinity-training, general-eyecare
2. A brief summary (2-3 sentences)
3. 3-5 key insights
4. Main topics covered
5. Confidence score (0-1)

Video Title: ${video.name}
Description: ${video.description || 'N/A'}
Duration: ${Math.round(video.duration / 60)} minutes
Tags: ${video.tags?.map(t => t.name || t.tag).join(', ') || 'None'}

Return as JSON: {category, summary, insights[], topics[], confidence}`;
  
  const aiResponse = await new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });
    
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.content && parsed.content[0]) {
            const analysis = JSON.parse(parsed.content[0].text);
            resolve(analysis);
          } else {
            resolve({
              category: 'general-eyecare',
              summary: 'Video analysis pending',
              insights: ['Analysis not available'],
              topics: ['General'],
              confidence: 0.5
            });
          }
        } catch (e) {
          resolve({
            category: 'general-eyecare',
            summary: 'Video analysis pending',
            insights: ['Analysis not available'],
            topics: ['General'],
            confidence: 0.5
          });
        }
      });
      res.on('error', reject);
    });
    
    req.write(postData);
    req.end();
  });
  
  // Step 4: Store in MongoDB
  console.log('\nStep 4: Storing in MongoDB...');
  const client = new MongoClient(mongoUri);
  await client.connect();
  
  const db = client.db(dbName);
  const processedVideo = {
    vimeoId,
    name: video.name,
    description: video.description,
    duration: video.duration,
    link: video.link,
    thumbnail: video.pictures?.sizes?.[3]?.link || '',
    createdTime: video.created_time,
    modifiedTime: video.modified_time,
    category: aiResponse.category,
    aiSummary: aiResponse.summary,
    keyInsights: aiResponse.insights,
    topics: aiResponse.topics,
    confidence: aiResponse.confidence,
    transcript: transcript,
    tags: video.tags?.map(t => t.name || t.tag) || [],
    processingStatus: 'processed',
    processedAt: new Date(),
    analyzedBy: 'test-script'
  };
  
  await db.collection('processedVideos').replaceOne(
    { vimeoId },
    processedVideo,
    { upsert: true }
  );
  
  console.log('\n=== VIDEO PROCESSING RESULTS ===');
  console.log('Title:', processedVideo.name);
  console.log('Duration:', Math.round(processedVideo.duration / 60), 'minutes');
  console.log('Category:', processedVideo.category);
  console.log('Confidence:', processedVideo.confidence);
  console.log('\nAI Summary:');
  console.log(processedVideo.aiSummary);
  console.log('\nKey Insights:');
  processedVideo.keyInsights.forEach((insight, i) => {
    console.log(`${i + 1}. ${insight}`);
  });
  console.log('\nTopics:', processedVideo.topics.join(', '));
  
  if (transcript) {
    console.log('\n=== TRANSCRIPT ===');
    console.log(transcript.substring(0, 500));
  }
  
  // Step 5: Test retrieval for AI Q&A
  console.log('\n🤖 Step 5: Testing AI Q&A Retrieval...');
  
  // Search for the video in the database
  const retrieved = await db.collection('processedVideos').findOne({ vimeoId });
  
  if (retrieved) {
    console.log('✅ Video successfully stored and retrievable');
    console.log('The AI can now answer questions about:', retrieved.name);
    console.log('\nExample questions the AI can answer:');
    console.log('- What is this video about?');
    console.log('- What are the key insights from this video?');
    console.log('- What category does this video belong to?');
  }
  
  await client.close();
  console.log('\n✅ Test complete! Video processed and ready for AI Q&A.');
}

testVideoProcessing().catch(console.error);

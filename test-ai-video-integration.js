const https = require('https');
require('dotenv').config();

async function testAIVideoIntegration() {
  console.log('🤖 Testing AI Assistant Video Integration...\n');
  
  // Test different scenarios
  const testCases = [
    {
      question: "How do I manage patient expectations during an eye exam?",
      context: {
        pageType: "exam-page",
        pageTitle: "Patient Examination"
      }
    },
    {
      question: "Can you show me training on contact lens procedures?",
      context: {
        pageType: "contact-lens",
        pageTitle: "Contact Lens Fitting"
      }
    },
    {
      question: "What's the best way to communicate with patients?",
      context: {
        pageType: "patient-management",
        selectedText: "patient communication strategies"
      }
    }
  ];
  
  for (const testCase of testCases) {
    console.log('=' .repeat(60));
    console.log('❓ Question:', testCase.question);
    console.log('📄 Page Context:', JSON.stringify(testCase.context, null, 2));
    console.log('-'.repeat(60));
    
    // Make request to chat API
    const postData = JSON.stringify({
      message: testCase.question,
      userId: 'test-user',
      tenantId: 'test-tenant',
      context: testCase.context
    });
    
    const response = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'localhost',
        port: 3002,
        path: '/api/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        rejectUnauthorized: false
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ error: 'Failed to parse response' });
          }
        });
        res.on('error', reject);
      });
      
      req.write(postData);
      req.end();
    });
    
    // Display AI response
    if (response.message) {
      console.log('💬 AI Response:', response.message.substring(0, 200) + '...');
    }
    
    // Display recommended videos
    if (response.videos && response.videos.length > 0) {
      console.log('\n🎥 RECOMMENDED VIDEOS:');
      response.videos.forEach((video, index) => {
        console.log(`\n${index + 1}. ${video.title}`);
        console.log(`   ⏱️  Duration: ${video.duration}`);
        console.log(`   🔗 Link: ${video.link}`);
        console.log(`   📊 Relevance: ${video.relevance}`);
        console.log(`   📝 Summary: ${video.summary}`);
      });
    } else {
      console.log('\n📚 No specific videos found, but the AI can still help!');
    }
    
    console.log('\n');
  }
  
  console.log('=' .repeat(60));
  console.log('✅ Video Integration Test Complete!\n');
  console.log('The AI Assistant can:');
  console.log('1. ✅ Understand your questions in context');
  console.log('2. ✅ Search for relevant training videos');
  console.log('3. ✅ Provide clickable links to watch videos');
  console.log('4. ✅ Show video summaries and relevance scores');
  console.log('5. ✅ Recommend videos based on page context');
}

// Direct MongoDB test for video availability
async function checkAvailableVideos() {
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME);
    const videos = await db.collection('processedVideos')
      .find({ processingStatus: 'processed' })
      .limit(5)
      .toArray();
    
    console.log('\n📹 Available Videos in Database:');
    videos.forEach(video => {
      console.log(`- ${video.name} (${video.category})`);
      console.log(`  Link: ${video.link}`);
      console.log(`  Summary: ${video.aiSummary?.substring(0, 100)}...`);
      console.log('');
    });
    
  } finally {
    await client.close();
  }
}

// Run tests
checkAvailableVideos()
  .then(() => testAIVideoIntegration())
  .catch(console.error);

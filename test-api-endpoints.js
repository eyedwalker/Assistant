/**
 * Test script for API endpoints
 * Tests the fixed content management and training API routes
 */

async function testEndpoints() {
  const baseUrl = 'http://localhost:3001/api';
  
  console.log('🧪 Testing API Endpoints...\n');
  
  // Test 1: Site Crawler (requires auth, will fail as expected)
  console.log('1️⃣ Testing Site Crawler API...');
  try {
    const crawlerResponse = await fetch(`${baseUrl}/content/site-crawler`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com',
        depth: 1,
        maxPages: 5
      })
    });
    const crawlerData = await crawlerResponse.json();
    console.log('   Status:', crawlerResponse.status);
    console.log('   Response:', JSON.stringify(crawlerData, null, 2));
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
  
  // Test 2: Test Complete RAG (no auth required for test endpoint)
  console.log('\n2️⃣ Testing Complete RAG API...');
  try {
    const ragResponse = await fetch(`${baseUrl}/test-complete-rag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'What is glaucoma and how is it treated?'
      })
    });
    const ragData = await ragResponse.json();
    console.log('   Status:', ragResponse.status);
    console.log('   Response preview:', {
      message: ragData.message?.substring(0, 100) + '...',
      sources: ragData.sources?.length || 0,
      sessionId: ragData.sessionId
    });
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
  
  // Test 3: Bulk Ingest (requires auth)
  console.log('\n3️⃣ Testing Bulk Ingest API...');
  try {
    const ingestResponse = await fetch(`${baseUrl}/training/bulk-ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        urls: [
          'https://www.aao.org/eye-health/diseases/what-is-glaucoma',
          'https://www.nei.nih.gov/learn-about-eye-health/eye-conditions-and-diseases/cataracts'
        ],
        processingConfig: {
          extractImages: true,
          generateSummary: true
        }
      })
    });
    const ingestData = await ingestResponse.json();
    console.log('   Status:', ingestResponse.status);
    console.log('   Response:', JSON.stringify(ingestData, null, 2));
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
  
  // Test 4: Video Bulk Upload (requires auth)
  console.log('\n4️⃣ Testing Video Bulk Upload API...');
  try {
    const videoResponse = await fetch(`${baseUrl}/training/videos/bulk-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videos: [
          {
            name: 'test-video.mp4',
            url: 'https://example.com/video.mp4'
          }
        ]
      })
    });
    const videoData = await videoResponse.json();
    console.log('   Status:', videoResponse.status);
    console.log('   Response:', JSON.stringify(videoData, null, 2));
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
  
  console.log('\n✅ API Endpoint Testing Complete!');
  console.log('Note: Auth-required endpoints will return 401 as expected when not authenticated.');
}

// Run tests
testEndpoints().catch(console.error);

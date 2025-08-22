// Test script to simulate video upload and processing pipeline
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testVideoPipeline() {
  console.log('🎬 Testing Video Processing Pipeline');
  console.log('=====================================\n');

  const serverUrl = 'http://localhost:3001';

  // Test 1: Simulate video upload by creating a dummy file
  console.log('📹 Step 1: Simulating video upload...');
  
  // Create a dummy video file for testing
  const dummyVideoPath = path.join(__dirname, 'temp', 'test-video.mp4');
  const uploadDir = path.dirname(dummyVideoPath);
  
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  // Create a small dummy file (would be actual video in real scenario)
  fs.writeFileSync(dummyVideoPath, Buffer.from('dummy video content for testing'));
  
  try {
    // Test upload endpoint
    const form = new FormData();
    form.append('video', fs.createReadStream(dummyVideoPath), {
      filename: 'contact-lens-care-training.mp4',
      contentType: 'video/mp4'
    });
    form.append('title', 'Contact Lens Care Training');
    form.append('category', 'training');
    form.append('accessLevel', 'PUBLIC');
    form.append('tenantId', 'demo-tenant');

    console.log('📤 Uploading video to /api/upload-video...');
    
    const uploadResponse = await fetch(`${serverUrl}/api/upload-video`, {
      method: 'POST',
      body: form
    });

    const uploadResult = await uploadResponse.json();
    console.log('📊 Upload Result:', JSON.stringify(uploadResult, null, 2));

    if (uploadResult.success) {
      console.log('\n✅ Video processing successful!');
      console.log(`   - Video ID: ${uploadResult.videoId}`);
      console.log(`   - Duration: ${uploadResult.processing.duration}s`);
      console.log(`   - Transcript: ${uploadResult.processing.transcriptLength} chars`);
      console.log(`   - Topics: ${uploadResult.processing.keyTopics.join(', ')}`);
      console.log(`   - Vector Store: ${uploadResult.ragIntegration.vectorStoreType}`);

      // Test 2: Query AI with uploaded content
      console.log('\n🤖 Step 2: Testing AI with new video content...');
      
      const testQueries = [
        'How do I care for contact lenses?',
        'What is the proper way to clean contact lenses?',
        'How often should I replace my contact lens case?'
      ];

      for (const query of testQueries) {
        console.log(`\n📝 Query: "${query}"`);
        
        try {
          const aiResponse = await fetch(`${serverUrl}/api/test-bedrock-rag`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: query })
          });

          const aiResult = await aiResponse.json();
          
          if (aiResult.success) {
            console.log('✅ AI Response received');
            console.log(`   - Sources found: ${aiResult.ragDetails.documentsFound}`);
            console.log(`   - Response length: ${aiResult.message.length} chars`);
            console.log(`   - Vector store: ${aiResult.ragDetails.vectorStoreType}`);
            
            if (aiResult.sources.length > 0) {
              console.log('   - Sources:');
              aiResult.sources.forEach(source => {
                console.log(`     * ${source.title} (${source.relevance})`);
              });
            }
          } else {
            console.log('❌ AI query failed:', aiResult.error);
          }
        } catch (error) {
          console.log('❌ AI query error:', error.message);
        }
      }

    } else {
      console.log('\n❌ Video processing failed:', uploadResult.error);
    }

  } catch (error) {
    console.log('\n❌ Upload failed:', error.message);
  } finally {
    // Cleanup
    if (fs.existsSync(dummyVideoPath)) {
      fs.unlinkSync(dummyVideoPath);
      console.log('\n🗑️ Cleanup: Removed test file');
    }
  }

  console.log('\n🎯 Pipeline Test Complete');
  console.log('=====================================');
}

// Check if fetch is available (Node 18+)
if (typeof fetch === 'undefined') {
  console.log('Installing node-fetch for testing...');
  try {
    global.fetch = require('node-fetch');
  } catch (e) {
    console.log('❌ node-fetch not available. Install with: npm install node-fetch');
    process.exit(1);
  }
}

// Run the test
testVideoPipeline().catch(console.error);

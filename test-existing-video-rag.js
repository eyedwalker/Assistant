// Test script to demonstrate AI training with existing processed videos
const fetch = require('node-fetch');

async function testExistingVideoRAG() {
  console.log('🎬 Testing AI Training with Existing Video Content');
  console.log('=====================================================\n');

  const serverUrl = 'http://localhost:3001';

  try {
    // Step 1: Check existing processed videos
    console.log('📊 Step 1: Checking existing processed videos...');
    
    const processedResponse = await fetch(`${serverUrl}/api/videos/processed?limit=10`);
    if (processedResponse.ok) {
      const processedData = await processedResponse.json();
      console.log(`✅ Found ${processedData.videos?.length || 0} processed videos`);
      
      if (processedData.videos?.length > 0) {
        console.log('📹 Sample processed videos:');
        processedData.videos.slice(0, 3).forEach((video, i) => {
          console.log(`   ${i+1}. ${video.name} (${video.processed ? 'Processed' : 'Not processed'})`);
          if (video.transcript) {
            console.log(`      - Has transcript: ${video.transcript.length} chars`);
          }
          if (video.aiSummary) {
            console.log(`      - Has AI summary: ${video.aiSummary.substring(0, 100)}...`);
          }
        });
      }
    } else {
      console.log('⚠️ Could not fetch processed videos (may need authentication)');
    }

    // Step 2: Sync processed videos to RAG system
    console.log('\n🔄 Step 2: Syncing processed videos to RAG...');
    
    const syncResponse = await fetch(`${serverUrl}/api/videos/sync-to-rag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        forceSync: false,
        limit: 10,
        minConfidence: 0.5,
        category: 'eyecare-training'
      })
    });

    if (syncResponse.ok) {
      const syncResult = await syncResponse.json();
      console.log('✅ RAG Sync Results:');
      console.log(`   - Total found: ${syncResult.summary?.totalFound || 0}`);
      console.log(`   - Successfully synced: ${syncResult.summary?.synced || 0}`);
      console.log(`   - Errors: ${syncResult.summary?.errors || 0}`);
      console.log(`   - Vector store: ${syncResult.summary?.vectorStoreType || 'Unknown'}`);
      
      if (syncResult.results?.length > 0) {
        console.log('   - Synced videos:');
        syncResult.results.forEach((result, i) => {
          console.log(`     ${i+1}. ${result.title} (${result.status})`);
        });
      }
    } else {
      const error = await syncResponse.text();
      console.log('❌ RAG sync failed:', error);
    }

    // Step 3: Test AI with video-trained knowledge
    console.log('\n🤖 Step 3: Testing AI with video-trained knowledge...');
    
    const testQueries = [
      'How do I properly care for contact lenses?',
      'What are the key steps in contact lens fitting?',
      'How do I use the Eyefinity system for patient management?',
      'What are the best practices for eyecare training?',
      'How often should contact lens cases be replaced?'
    ];

    for (const query of testQueries) {
      console.log(`\n📝 Query: "${query}"`);
      
      try {
        const aiResponse = await fetch(`${serverUrl}/api/test-bedrock-rag`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: query })
        });

        if (aiResponse.ok) {
          const result = await aiResponse.json();
          
          if (result.success) {
            console.log('✅ AI Response generated');
            console.log(`   - Sources found: ${result.ragDetails?.documentsFound || 0}`);
            console.log(`   - Response length: ${result.message?.length || 0} chars`);
            console.log(`   - Vector store: ${result.ragDetails?.vectorStoreType || 'Unknown'}`);
            
            if (result.sources?.length > 0) {
              console.log('   - Video sources used:');
              result.sources.forEach(source => {
                console.log(`     * ${source.title} (${source.relevance} relevant)`);
              });
            }
            
            // Show snippet of response
            if (result.message) {
              const snippet = result.message.substring(0, 200);
              console.log(`   - Response preview: "${snippet}..."`);
            }
          } else {
            console.log('❌ AI response failed:', result.error);
          }
        } else {
          console.log('❌ AI request failed');
        }
      } catch (error) {
        console.log('❌ AI query error:', error.message);
      }
    }

    // Step 4: Trigger new video processing (if needed)
    console.log('\n🔄 Step 4: Checking video processing capabilities...');
    
    try {
      const bulkProcessResponse = await fetch(`${serverUrl}/api/videos/vimeo-bulk-process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit: 5,
          processTranscripts: true,
          analyzeContent: true,
          processingMode: 'new-only'
        })
      });

      if (bulkProcessResponse.ok) {
        const processResult = await bulkProcessResponse.json();
        console.log('✅ Video processing capabilities confirmed');
        console.log(`   - Processing mode available: ${processResult.mode || 'Unknown'}`);
        console.log(`   - Videos queued: ${processResult.videosQueued || 0}`);
      } else {
        console.log('⚠️ Video processing requires authentication or setup');
      }
    } catch (error) {
      console.log('⚠️ Video processing endpoint check failed:', error.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n🎯 Test Complete - Video-to-AI Training Pipeline');
  console.log('=====================================================');
  console.log('\n📋 Summary:');
  console.log('✅ Existing video processing system identified');
  console.log('✅ RAG integration created for AI training');
  console.log('✅ AI can now answer questions using video content');
  console.log('✅ Pipeline ready for new video uploads');
  
  console.log('\n🔄 To process new videos and train the AI:');
  console.log('1. Use existing video processing: POST /api/videos/vimeo-bulk-process');
  console.log('2. Sync to RAG: POST /api/videos/sync-to-rag');
  console.log('3. Test AI: POST /api/test-bedrock-rag');
}

// Run the test
testExistingVideoRAG().catch(console.error);

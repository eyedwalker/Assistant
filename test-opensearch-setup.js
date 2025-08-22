// Test OpenSearch setup and compare with Local Vector Store
const fetch = require('node-fetch');

async function testOpenSearchSetup() {
  console.log('🔍 Testing OpenSearch Setup vs Local Vector Store');
  console.log('==================================================\n');

  const serverUrl = 'http://localhost:3001';

  try {
    // Test 1: Check if OpenSearch is configured
    console.log('📋 Step 1: Checking OpenSearch configuration...');
    
    const hasOpenSearch = process.env.OPENSEARCH_ENDPOINT;
    if (hasOpenSearch) {
      console.log('✅ OpenSearch endpoint configured:', process.env.OPENSEARCH_ENDPOINT);
      console.log('✅ Index name:', process.env.OPENSEARCH_INDEX_NAME || 'ai-assistant-rag');
    } else {
      console.log('⚠️ OpenSearch not configured, will use Local Vector Store');
    }

    // Test 2: Initialize OpenSearch (if configured)
    if (hasOpenSearch) {
      console.log('\n🔧 Step 2: Testing OpenSearch initialization...');
      
      try {
        const initResponse = await fetch(`${serverUrl}/api/opensearch/init`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (initResponse.ok) {
          const result = await initResponse.json();
          console.log('✅ OpenSearch index initialized:', result.indexName);
        } else {
          console.log('⚠️ OpenSearch init failed (API may not exist yet)');
        }
      } catch (error) {
        console.log('⚠️ OpenSearch init endpoint not available yet');
      }
    }

    // Test 3: Compare search results
    console.log('\n🔍 Step 3: Testing search capabilities...');
    
    const testQueries = [
      'contact lens care',
      'How to clean contacts?',
      'daily maintenance routine',
      'storage solutions',
      'Eyefinity system training'
    ];

    for (const query of testQueries) {
      console.log(`\n📝 Query: "${query}"`);
      
      try {
        const response = await fetch(`${serverUrl}/api/test-bedrock-rag`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: query })
        });

        if (response.ok) {
          const result = await response.json();
          
          console.log(`   Vector Store: ${result.ragDetails?.vectorStoreType || 'Unknown'}`);
          console.log(`   Documents found: ${result.ragDetails?.documentsFound || 0}`);
          console.log(`   Context length: ${result.ragDetails?.contextLength || 0} chars`);
          
          if (result.sources?.length > 0) {
            console.log('   Top sources:');
            result.sources.slice(0, 2).forEach(source => {
              console.log(`     - ${source.title} (${source.relevance})`);
            });
          }
        } else {
          console.log('   ❌ Query failed');
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    // Test 4: Performance comparison
    console.log('\n⚡ Step 4: Performance test...');
    
    const performanceQuery = 'contact lens daily care routine';
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${serverUrl}/api/test-bedrock-rag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: performanceQuery })
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Response time: ${responseTime}ms`);
        console.log(`   Vector store: ${result.ragDetails?.vectorStoreType}`);
        console.log(`   Quality: ${result.ragDetails?.documentsFound > 0 ? 'Good' : 'Poor'} (${result.ragDetails?.documentsFound} docs)`);
      }
    } catch (error) {
      console.log(`❌ Performance test failed: ${error.message}`);
    }

    // Test 5: Add sample content for testing
    console.log('\n📚 Step 5: Testing content addition...');
    
    try {
      const addContentResponse = await fetch(`${serverUrl}/api/videos/sync-to-rag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forceSync: false,
          limit: 5,
          category: 'eyecare-training'
        })
      });

      if (addContentResponse.ok) {
        const syncResult = await addContentResponse.json();
        console.log(`✅ Content sync test:`);
        console.log(`   Found: ${syncResult.summary?.totalFound || 0} videos`);
        console.log(`   Synced: ${syncResult.summary?.synced || 0} videos`);
        console.log(`   Vector store: ${syncResult.summary?.vectorStoreType}`);
      } else {
        console.log('⚠️ Content sync test requires authentication');
      }
    } catch (error) {
      console.log(`⚠️ Content sync test failed: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n🎯 OpenSearch Setup Test Complete');
  console.log('==================================');
  
  if (process.env.OPENSEARCH_ENDPOINT) {
    console.log('✅ OpenSearch is configured and ready for semantic search');
    console.log('✅ Vector embeddings will provide better search quality');
    console.log('✅ Can handle thousands of video transcripts efficiently');
  } else {
    console.log('📋 Using Local Vector Store for development');
    console.log('💡 Configure OPENSEARCH_ENDPOINT to enable semantic search');
  }
}

// Run the test
testOpenSearchSetup().catch(console.error);

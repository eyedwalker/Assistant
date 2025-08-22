#!/usr/bin/env node

// Simple OpenSearch health check without complex vector operations
const { Client } = require('@opensearch-project/opensearch');
const { defaultProvider } = require('@aws-sdk/credential-provider-node');
const { AwsSigv4Signer } = require('@opensearch-project/opensearch/aws');

async function testOpenSearchSimple() {
  console.log('🔍 Simple OpenSearch Health Check');
  console.log('==================================\n');

  const endpoint = 'https://search-ai-assistant-dev-z5hmote2jeh4ginihdjmti4fhm.us-east-1.es.amazonaws.com';
  const region = 'us-east-1';

  try {
    // Create client with minimal configuration
    const client = new Client({
      ...AwsSigv4Signer({
        region,
        service: 'es',
        getCredentials: () => {
          const credentialsProvider = defaultProvider();
          return credentialsProvider();
        },
      }),
      node: endpoint,
    });

    console.log('📡 Testing basic connectivity...');
    
    // Test 1: Cluster info
    const info = await client.info();
    console.log('✅ OpenSearch connection successful!');
    console.log(`   Cluster: ${info.body.cluster_name}`);
    console.log(`   Version: ${info.body.version.number}`);
    
    // Test 2: Cluster health
    const health = await client.cluster.health();
    console.log(`   Health Status: ${health.body.status}`);
    console.log(`   Active Nodes: ${health.body.number_of_nodes}`);
    
    // Test 3: List existing indices
    const indices = await client.cat.indices({ format: 'json' });
    console.log(`   Existing Indices: ${indices.body.length}`);
    
    return {
      success: true,
      endpoint,
      cluster: info.body.cluster_name,
      version: info.body.version.number,
      health: health.body.status
    };

  } catch (error) {
    console.error('❌ OpenSearch connection failed:', error.message);
    
    if (error.message.includes('403')) {
      console.log('   Issue: Access denied - checking access policy...');
    } else if (error.message.includes('timeout')) {
      console.log('   Issue: Connection timeout - domain may be starting...');
    }
    
    return { success: false, error: error.message };
  }
}

testOpenSearchSimple().then(result => {
  if (result.success) {
    console.log('\n🎉 OpenSearch is ready for RAG integration!');
  } else {
    console.log('\n⚠️  Using Local Vector Store fallback');
  }
  process.exit(result.success ? 0 : 1);
});

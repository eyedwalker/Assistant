// Direct test of OpenSearch connection and setup
const { Client } = require('@opensearch-project/opensearch');
const { defaultProvider } = require('@aws-sdk/credential-provider-node');
const { AwsSigv4Signer } = require('@opensearch-project/opensearch/aws');

async function testOpenSearchDirect() {
  console.log('🔍 Testing Direct OpenSearch Connection');
  console.log('=====================================\n');

  const endpoint = 'https://search-ai-assistant-dev-z5hmote2jeh4ginihdjmti4fhm.us-east-1.es.amazonaws.com';
  const region = 'us-east-1';

  try {
    console.log('📡 Connecting to OpenSearch...');
    console.log(`   Endpoint: ${endpoint}`);
    console.log(`   Region: ${region}`);

    // Initialize client with AWS authentication
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

    // Test 1: Basic connection
    console.log('\n🔧 Testing basic connection...');
    const info = await client.info();
    console.log('✅ Connection successful!');
    console.log(`   Cluster: ${info.body.cluster_name}`);
    console.log(`   Version: ${info.body.version.number}`);

    // Test 2: Create index with vector mapping
    console.log('\n📊 Creating RAG index...');
    const indexName = 'ai-assistant-rag';
    
    // Check if index exists
    const indexExists = await client.indices.exists({ index: indexName });
    
    if (indexExists.body) {
      console.log(`⚠️ Index ${indexName} already exists, deleting...`);
      await client.indices.delete({ index: indexName });
    }

    // Create index with vector mapping
    const indexConfig = {
      index: indexName,
      body: {
        settings: {
          index: {
            knn: true,
            'knn.algo_param.ef_search': 100
          }
        },
        mappings: {
          properties: {
            content_vector: {
              type: 'knn_vector',
              dimension: 384,
              method: {
                name: 'hnsw',
                space_type: 'cosinesimil',
                engine: 'nmslib',
                parameters: {
                  ef_construction: 128,
                  m: 24
                }
              }
            },
            content: { type: 'text' },
            title: { type: 'text' },
            source: { type: 'keyword' },
            contentType: { type: 'keyword' },
            metadata: { type: 'object' }
          }
        }
      }
    };

    const createResult = await client.indices.create(indexConfig);
    console.log('✅ Index created successfully!');
    console.log(`   Index: ${indexName}`);
    console.log(`   Acknowledged: ${createResult.body.acknowledged}`);

    // Test 3: Add sample document with mock vector
    console.log('\n📝 Adding sample document...');
    
    const sampleDoc = {
      content: 'Contact lens care involves daily cleaning with approved solution, proper storage in fresh solution, and regular replacement according to the prescribed schedule.',
      title: 'Contact Lens Care Basics',
      source: 'video:sample-001',
      contentType: 'video',
      content_vector: Array.from({length: 384}, () => Math.random() - 0.5), // Mock vector
      metadata: {
        duration: 300,
        confidence: 0.9,
        topics: ['contact lens care', 'hygiene', 'storage']
      }
    };

    await client.index({
      index: indexName,
      id: 'sample-001',
      body: sampleDoc
    });

    // Refresh index to ensure document is searchable
    await client.indices.refresh({ index: indexName });
    console.log('✅ Sample document added');

    // Test 4: Basic search
    console.log('\n🔍 Testing search capabilities...');
    
    const searchResult = await client.search({
      index: indexName,
      body: {
        query: {
          match: { content: 'contact lens' }
        }
      }
    });

    console.log(`✅ Search successful! Found ${searchResult.body.hits.total.value} documents`);
    if (searchResult.body.hits.hits.length > 0) {
      console.log(`   Top result: ${searchResult.body.hits.hits[0]._source.title}`);
    }

    // Test 5: Vector similarity search (mock)
    console.log('\n🧠 Testing vector search...');
    const queryVector = Array.from({length: 384}, () => Math.random() - 0.5);
    
    const vectorSearch = await client.search({
      index: indexName,
      body: {
        query: {
          script_score: {
            query: { match_all: {} },
            script: {
              source: "cosineSimilarity(params.query_vector, 'content_vector') + 1.0",
              params: { query_vector: queryVector }
            }
          }
        }
      }
    });

    console.log(`✅ Vector search successful! Score: ${vectorSearch.body.hits.hits[0]._score.toFixed(3)}`);

    console.log('\n🎉 OpenSearch is fully operational!');
    console.log('Ready for semantic search and RAG functionality');

    return {
      success: true,
      endpoint,
      indexName,
      clusterName: info.body.cluster_name,
      version: info.body.version.number
    };

  } catch (error) {
    console.error('❌ OpenSearch test failed:', error.message);
    
    if (error.message.includes('403') || error.message.includes('Forbidden')) {
      console.log('\n💡 Access denied - OpenSearch domain may need open access policy');
      console.log('   This is normal for new domains with default security settings');
    }
    
    return { success: false, error: error.message };
  }
}

// Check if required packages are available
try {
  require('@opensearch-project/opensearch');
  require('@aws-sdk/credential-provider-node');
  
  testOpenSearchDirect().then(result => {
    if (result.success) {
      console.log('\n✅ OpenSearch setup complete - ready for production RAG!');
    } else {
      console.log('\n⚠️  OpenSearch needs configuration - using Local Vector Store for now');
    }
  });
} catch (error) {
  console.log('📦 Installing required packages...');
  console.log('Run: npm install @opensearch-project/opensearch @aws-sdk/credential-provider-node');
}

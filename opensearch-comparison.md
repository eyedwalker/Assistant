# OpenSearch vs Local Vector Store Comparison

## Current Setup (Local Vector Store)
- Simple keyword matching
- In-memory storage
- Good for development/testing
- Limited to ~1000 documents

## OpenSearch Advantages

### 1. True Vector Search
```bash
# Create OpenSearch domain
./setup-opensearch.sh

# Vector mapping
PUT /ai-assistant-rag
{
  "mappings": {
    "properties": {
      "content_vector": {
        "type": "knn_vector",
        "dimension": 1536,
        "method": {
          "name": "hnsw",
          "space_type": "cosinesimil"
        }
      },
      "content": {"type": "text"},
      "metadata": {"type": "object"}
    }
  }
}
```

### 2. Advanced Query Features
```json
{
  "size": 10,
  "query": {
    "bool": {
      "must": {
        "knn": {
          "content_vector": {
            "vector": [0.2, -0.1, 0.8, ...],
            "k": 50
          }
        }
      },
      "filter": [
        {"term": {"metadata.contentType": "video"}},
        {"range": {"metadata.confidence": {"gte": 0.7}}},
        {"terms": {"metadata.accessLevel": ["PUBLIC", "ACCOUNT"]}}
      ]
    }
  },
  "highlight": {
    "fields": {"content": {}}
  },
  "aggregations": {
    "topics": {"terms": {"field": "metadata.topics"}},
    "products": {"terms": {"field": "metadata.vspProduct"}}
  }
}
```

### 3. Performance Benefits
- **Semantic Search**: Understanding meaning, not just keywords
- **Scalability**: Handle millions of documents
- **Real-time**: Updates reflected immediately
- **Distributed**: Auto-scaling across nodes
- **Relevance**: Much better ranking and scoring

### 4. Migration Path
```bash
# 1. Create OpenSearch domain
aws opensearch create-domain --domain-name ai-assistant-rag

# 2. Update environment
export OPENSEARCH_ENDPOINT=https://your-domain.us-east-1.es.amazonaws.com

# 3. Re-sync data
curl -X POST /api/videos/sync-to-rag -d '{"forceSync": true}'
```

## When to Use Each

### Local Vector Store (Current)
- ✅ Development & testing
- ✅ Small datasets (<1000 docs)
- ✅ Quick prototyping
- ✅ No AWS costs

### OpenSearch (Production)
- ✅ Production workloads
- ✅ Large datasets (>1000 docs)
- ✅ Semantic search required
- ✅ Advanced filtering needed
- ✅ Multiple languages
- ✅ Real-time updates

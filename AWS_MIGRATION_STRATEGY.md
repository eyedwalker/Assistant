# MongoDB to AWS Migration Strategy

## 🔄 Current MongoDB Usage → AWS Replacements

### 1. **User Authentication & Profiles**
**Current**: MongoDB `users` collection  
**AWS Solution**: **Amazon Cognito + DynamoDB**
- **Cognito**: Handle authentication, MFA, password management
- **DynamoDB**: Store user profiles, roles, permissions
```javascript
// Before (MongoDB)
await mongoAccessor.create('users', userData);

// After (AWS)
await cognitoClient.adminCreateUser(params);
await dynamoClient.putItem({ TableName: 'UserProfiles', Item: userData });
```

### 2. **Document Metadata Storage**
**Current**: MongoDB `documents` collection  
**AWS Solution**: **DynamoDB**
- Partition key: `userId`
- Sort key: `documentId`
- Global Secondary Index on `tenantId`
```javascript
// DynamoDB schema
{
  TableName: 'Documents',
  KeySchema: [
    { AttributeName: 'userId', KeyType: 'HASH' },
    { AttributeName: 'documentId', KeyType: 'RANGE' }
  ],
  GlobalSecondaryIndexes: [{
    IndexName: 'TenantIndex',
    Keys: { tenantId: 'HASH', createdAt: 'RANGE' }
  }]
}
```

### 3. **Vector Search & Embeddings**
**Current**: MongoDB Atlas Vector Search  
**AWS Solution**: **Amazon OpenSearch Service**
- k-NN plugin for vector similarity search
- Store embeddings with metadata
```javascript
// OpenSearch mapping
{
  "mappings": {
    "properties": {
      "embedding": {
        "type": "knn_vector",
        "dimension": 384,
        "method": {
          "name": "hnsw",
          "space_type": "cosinesimil"
        }
      },
      "content": { "type": "text" },
      "documentId": { "type": "keyword" }
    }
  }
}
```

### 4. **Content Chunks Storage**
**Current**: MongoDB `contents` collection  
**AWS Solution**: **S3 + DynamoDB**
- **S3**: Store actual content chunks
- **DynamoDB**: Store metadata and S3 references
```javascript
// S3 structure
s3://your-bucket/
  └── content-chunks/
      └── {tenantId}/
          └── {documentId}/
              └── chunk-{index}.json

// DynamoDB metadata
{
  documentId: "doc123",
  chunkIndex: 1,
  s3Key: "content-chunks/tenant1/doc123/chunk-1.json",
  embedding: [...], // Store in OpenSearch instead
  metadata: { ... }
}
```

### 5. **Processed Videos**
**Current**: MongoDB `processedVideos` collection  
**AWS Solution**: **DynamoDB + S3**
- **DynamoDB**: Video metadata, categories, links
- **S3**: Transcripts, thumbnails, AI summaries
```javascript
// DynamoDB structure
{
  TableName: 'ProcessedVideos',
  Item: {
    vimeoId: "123456",
    metadata: {
      name: "Training Video",
      duration: 480,
      category: "patient-management"
    },
    s3Keys: {
      transcript: "videos/123456/transcript.txt",
      summary: "videos/123456/summary.json",
      thumbnail: "videos/123456/thumbnail.jpg"
    }
  }
}
```

### 6. **Processing Jobs & Queues**
**Current**: MongoDB `processing_jobs` collection  
**AWS Solution**: **SQS + DynamoDB + Step Functions**
- **SQS**: Job queue management
- **DynamoDB**: Job status tracking
- **Step Functions**: Orchestrate complex workflows
```javascript
// SQS message
{
  jobId: "job-123",
  type: "document-processing",
  payload: { documentId: "doc456", userId: "user789" }
}

// Step Functions state machine
{
  "ProcessDocument": {
    "Type": "Task",
    "Resource": "arn:aws:lambda:DocumentProcessor",
    "Next": "GenerateEmbeddings"
  },
  "GenerateEmbeddings": {
    "Type": "Task",
    "Resource": "arn:aws:lambda:EmbeddingGenerator",
    "End": true
  }
}
```

### 7. **Chat Conversations & History**
**Current**: MongoDB conversations  
**AWS Solution**: **DynamoDB Streams + S3**
- **DynamoDB**: Recent conversations (hot data)
- **S3**: Archived conversations (cold data)
- **DynamoDB Streams**: Real-time updates
```javascript
// DynamoDB schema
{
  TableName: 'Conversations',
  KeySchema: [
    { AttributeName: 'sessionId', KeyType: 'HASH' },
    { AttributeName: 'timestamp', KeyType: 'RANGE' }
  ],
  StreamSpecification: {
    StreamEnabled: true,
    StreamViewType: 'NEW_AND_OLD_IMAGES'
  }
}
```

## 🏗️ Architecture Changes

### **Data Access Layer Modifications**

Create new AWS-specific accessors:
```typescript
// lib/accessors/DynamoDBAccessor.ts
export class DynamoDBAccessor {
  private client: DynamoDBClient;
  
  async create(table: string, item: any) {
    return this.client.putItem({
      TableName: table,
      Item: marshall(item)
    });
  }
  
  async query(params: QueryParams) {
    return this.client.query(params);
  }
}

// lib/accessors/OpenSearchAccessor.ts
export class OpenSearchAccessor {
  private client: Client;
  
  async indexDocument(doc: any) {
    return this.client.index({
      index: 'documents',
      body: doc
    });
  }
  
  async vectorSearch(embedding: number[], k: number) {
    return this.client.search({
      index: 'documents',
      body: {
        query: {
          knn: {
            embedding: {
              vector: embedding,
              k: k
            }
          }
        }
      }
    });
  }
}
```

## 📊 Service Mapping

| Component | MongoDB | AWS Service | Benefits |
|-----------|---------|-------------|----------|
| User Auth | users collection | Cognito + DynamoDB | Managed auth, MFA, OAuth |
| Documents | documents collection | DynamoDB | Auto-scaling, serverless |
| Vectors | Atlas Vector Search | OpenSearch | Dedicated vector search |
| Content | contents collection | S3 + DynamoDB | Unlimited storage |
| Videos | processedVideos | DynamoDB + S3 | Cost-effective storage |
| Jobs | processing_jobs | SQS + Step Functions | Reliable queuing |
| Chat | conversations | DynamoDB + S3 | TTL, archiving |

## 💰 Cost Comparison

### **MongoDB Atlas (Current)**
- M10 Cluster: ~$100/month
- Storage: ~$0.25/GB/month
- Data Transfer: ~$0.15/GB

### **AWS Services (Proposed)**
- DynamoDB: ~$0.25 per million requests
- OpenSearch: ~$100/month (t3.small.search)
- S3: ~$0.023/GB/month
- SQS: ~$0.40 per million requests
- Cognito: ~$0.0055 per MAU

**Estimated Monthly Cost**: $150-200 (varies with usage)

## 🚀 Migration Steps

### **Phase 1: Parallel Implementation (2-3 weeks)**
1. Set up AWS services (DynamoDB, OpenSearch, Cognito)
2. Create new accessor classes
3. Implement dual-write to both MongoDB and AWS
4. Test AWS services in staging

### **Phase 2: Gradual Migration (2-3 weeks)**
1. Migrate authentication to Cognito
2. Move document metadata to DynamoDB
3. Migrate vector search to OpenSearch
4. Transfer content storage to S3

### **Phase 3: Cutover (1 week)**
1. Stop writes to MongoDB
2. Final data sync
3. Update all accessors to use AWS only
4. Monitor and optimize

### **Phase 4: Cleanup (1 week)**
1. Archive MongoDB data
2. Decommission MongoDB cluster
3. Performance tuning
4. Cost optimization

## 🔧 Code Changes Required

### **Environment Variables**
```bash
# Remove
MONGODB_URI=...
MONGODB_DB_NAME=...

# Add
AWS_REGION=us-east-1
DYNAMODB_ENDPOINT=...
OPENSEARCH_ENDPOINT=...
COGNITO_USER_POOL_ID=...
COGNITO_CLIENT_ID=...
```

### **Package Dependencies**
```json
{
  "dependencies": {
    // Remove
    "mongodb": "^5.9.0",
    "@next-auth/mongodb-adapter": "^1.1.0",
    
    // Add
    "@aws-sdk/client-dynamodb": "^3.x",
    "@aws-sdk/client-opensearch": "^3.x",
    "@aws-sdk/client-cognito-identity-provider": "^3.x",
    "@aws-sdk/lib-dynamodb": "^3.x",
    "@opensearch-project/opensearch": "^2.x",
    "aws-amplify": "^5.x"
  }
}
```

### **API Route Updates**
```typescript
// Before
const mongoAccessor = new MongoDBAccessor(uri, dbName);
await mongoAccessor.connect();

// After
const dynamoAccessor = new DynamoDBAccessor();
const openSearchAccessor = new OpenSearchAccessor();
// No connection needed - serverless
```

## ✅ Advantages of AWS Migration

1. **Serverless & Auto-scaling**: No server management
2. **Pay-per-use**: Only pay for what you use
3. **Native AWS Integration**: Better integration with Amplify, Lambda
4. **Specialized Services**: Purpose-built databases for each use case
5. **Global Distribution**: Multi-region support built-in
6. **Managed Security**: AWS handles encryption, compliance

## ⚠️ Considerations

1. **Vendor Lock-in**: Harder to migrate away from AWS
2. **Learning Curve**: Team needs AWS expertise
3. **Complexity**: More services to manage
4. **Cold Starts**: DynamoDB/Lambda may have latency
5. **Cost Variability**: Usage-based pricing can fluctuate

## 🎯 Recommendation

**Hybrid Approach for Initial Migration:**
1. Keep MongoDB for user data and simple queries
2. Use OpenSearch for vector search (better than MongoDB)
3. Use S3 for content storage (already implemented)
4. Use SQS for job processing (more reliable)

This allows gradual migration while maintaining stability.

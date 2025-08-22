# AWS Knowledge Base Architecture for Video-to-AI Training

## Overview
Full AWS-managed solution replacing custom OpenSearch with AWS Knowledge Base for Bedrock.

## Architecture Components

### 1. Data Storage Layer
- **S3 Bucket**: `eyecare-video-knowledge-{account-id}`
  - Path structure: `/videos/{video-id}/{type}.txt`
  - Types: transcript, summary, insights, metadata
  - Auto-sync to Knowledge Base

### 2. Knowledge Management
- **AWS Knowledge Base for Bedrock**
  - Data source: S3 bucket
  - Vector store: OpenSearch Serverless
  - Embedding model: Amazon Titan Embeddings G1
  - Auto-chunking: 1000 tokens with 200 overlap
  - Sync schedule: Real-time via S3 events

### 3. Processing Pipeline
- **Lambda: Video Processor**
  - Triggered by: API Gateway or SQS
  - Process: Vimeo → Transcript → AI Analysis → S3
  - Runtime: Node.js 20
  - Memory: 1GB, Timeout: 15min

- **Lambda: Knowledge Base Sync**
  - Triggered by: S3 events
  - Process: New S3 objects → Knowledge Base sync
  - Runtime: Python 3.11
  - Memory: 512MB, Timeout: 5min

### 4. API Layer
- **API Gateway REST API**
  - Endpoints: /videos/process, /chat/rag
  - Authentication: Cognito or API Key
  - Rate limiting: 1000/hour per key
  - CORS enabled for Next.js app

- **Lambda: RAG Handler**
  - Integration: Knowledge Base RetrieveAndGenerate API
  - Model: Claude 3.5 Sonnet
  - Context: Top 5 relevant chunks
  - Runtime: Node.js 20

### 5. Frontend Integration
- **Next.js App**
  - AWS SDK v3 for API calls
  - Cognito authentication
  - Real-time processing status
  - Chat interface with RAG responses

## Implementation Benefits

### Fully Managed
- No infrastructure maintenance
- Auto-scaling
- Built-in monitoring (CloudWatch)
- Automatic backups

### Cost Optimized
- Pay-per-use pricing
- Serverless architecture
- No idle resources
- OpenSearch Serverless (vs domain)

### Enterprise Features
- VPC support
- IAM integration
- CloudTrail auditing
- Encryption at rest/transit

## Migration Strategy

### Phase 1: Knowledge Base Setup
1. Create S3 bucket with proper structure
2. Set up Knowledge Base with S3 data source
3. Configure OpenSearch Serverless collection
4. Test with sample video data

### Phase 2: Lambda Functions
1. Deploy video processing Lambda
2. Deploy Knowledge Base sync Lambda  
3. Deploy RAG handler Lambda
4. Set up API Gateway endpoints

### Phase 3: Frontend Integration
1. Update Next.js app to use new APIs
2. Replace current RAG calls
3. Add processing status monitoring
4. Test end-to-end workflow

### Phase 4: Data Migration
1. Export existing video data from MongoDB
2. Transform to S3 structure
3. Sync to Knowledge Base
4. Validate RAG responses

## Cost Estimation (Monthly)

**Development Environment:**
- Knowledge Base: ~$50/month (1000 docs)
- OpenSearch Serverless: ~$30/month  
- Lambda: ~$20/month (1M requests)
- S3: ~$10/month (100GB)
- **Total: ~$110/month**

**Production Environment:**
- Knowledge Base: ~$200/month (5000 docs)
- OpenSearch Serverless: ~$100/month
- Lambda: ~$50/month (5M requests)  
- S3: ~$50/month (500GB)
- **Total: ~$400/month**

## Implementation Timeline

- **Week 1**: Knowledge Base + S3 setup
- **Week 2**: Lambda functions development  
- **Week 3**: API Gateway + frontend integration
- **Week 4**: Testing + data migration
- **Week 5**: Production deployment

## Next Steps

1. Create AWS Knowledge Base via console
2. Set up S3 bucket structure
3. Deploy Lambda functions
4. Update Next.js integration
5. Migrate existing video data

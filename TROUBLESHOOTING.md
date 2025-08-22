# Troubleshooting Guide for AI Assistant Hybrid AWS Integration

## Environment Setup Issues

### AWS Credentials

**Issue**: AWS credentials not loading correctly
- Error: `Could not load credentials from any providers`
- Warning: `Multiple credential sources detected`

**Resolution**:
1. Use only one AWS credential source (either profile or direct environment variables)
2. For direct environment variables:
   ```bash
   export AWS_ACCESS_KEY_ID=your-access-key
   export AWS_SECRET_ACCESS_KEY=your-secret-key
   unset AWS_PROFILE  # Important: remove profile if using direct keys
   ```
3. For AWS profile:
   ```bash
   export AWS_PROFILE=your-profile-name
   unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY  # Remove direct keys
   ```
4. Verify credentials:
   ```bash
   aws sts get-caller-identity
   ```

### MongoDB Connection

**Issue**: MongoDB connection fails
- Error: `Failed to connect to MongoDB`

**Resolution**:
1. Check MONGODB_URI in .env file
2. Ensure MongoDB Atlas (or local MongoDB) is running
3. Verify IP address is whitelisted in MongoDB Atlas
4. Test connection:
   ```bash
   node -e "require('mongodb').MongoClient.connect(process.env.MONGODB_URI).then(() => console.log('Connected!')).catch(err => console.error('Failed:', err))"
   ```

### Anthropic API

**Issue**: Anthropic API key has insufficient credit
- Error: `Your credit balance is too low to access the Anthropic API`

**Resolution**:
1. Check credit balance at https://console.anthropic.com/
2. Purchase additional credits or switch to a paid plan
3. Use AWS Bedrock with Claude models as alternative

## AWS Infrastructure Issues

### OpenSearch Connectivity

**Issue**: OpenSearch domain not accessible
- Error: `OpenSearch not healthy`

**Resolution**:
1. Check AWS_OPENSEARCH_ENDPOINT in .env
2. Ensure domain is active in AWS Console
3. Verify VPC access settings if using private domain
4. Test connection:
   ```bash
   curl -X GET https://your-opensearch-endpoint.region.es.amazonaws.com/_cluster/health
   ```

### AWS Lambda Access

**Issue**: Lambda functions not accessible via API Gateway
- Error: `Cannot connect to API endpoint`

**Resolution**:
1. Check AWS_API_ENDPOINT in .env
2. Deploy CloudFormation stack:
   ```bash
   cd aws
   ./deploy.sh
   ```
3. Verify API Gateway deployment in AWS Console
4. Test API:
   ```bash
   curl -X GET https://your-api-endpoint.execute-api.region.amazonaws.com/dev/health
   ```

## Application Hybrid Mode Issues

### AWS Fallback Detection

**Issue**: Application not detecting when AWS is unavailable
- Error: `AWSBridgeAccessor failures not handled correctly`

**Resolution**:
1. Ensure proper error handling in ConversationManager
2. Set environment variable for testing:
   ```bash
   export AWS_FORCE_FALLBACK=true  # Force MongoDB/Anthropic fallback
   ```
3. Verify using system status endpoint:
   ```bash
   curl http://localhost:3001/api/system/status
   ```

### Vector Search Failures

**Issue**: Vector search failing in both AWS and MongoDB
- Error: `Vector search connection failed`

**Resolution**:
1. For MongoDB, ensure vector index exists:
   ```javascript
   // Create index if not exists
   db.collection('documents').createIndex({ contentVector: "text" })
   ```
2. For OpenSearch, check domain status and index:
   ```bash
   curl https://your-opensearch-endpoint.region.es.amazonaws.com/_cat/indices
   ```

## Development Testing

### Local Testing Without AWS

To test the application without AWS dependencies:
```bash
# Set environment variables
export USE_BEDROCK=false
export AWS_FORCE_FALLBACK=true

# Start development server
npm run dev
```

### Testing with AWS

To test with AWS integration:
```bash
# Set AWS credentials (use only one method)
# Method 1: Profile
export AWS_PROFILE=your-profile
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY

# Method 2: Direct credentials
unset AWS_PROFILE
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key

# Set AWS configuration
export AWS_REGION=us-east-1
export USE_BEDROCK=true
export AWS_FORCE_FALLBACK=false

# Start development server
npm run dev
```

## Deployment to Production

Before deploying to production:

1. Deploy AWS infrastructure:
   ```bash
   cd aws
   ./deploy.sh
   ```

2. Copy the generated `aws-config.env` to your application .env

3. Verify system status:
   ```bash
   curl https://your-app-domain.com/api/system/status
   ```

4. Monitor logs:
   - AWS CloudWatch Logs for Lambda functions
   - Application logs for hybrid integration issues

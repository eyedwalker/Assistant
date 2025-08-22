#!/bin/bash

# Manual AWS Knowledge Base Setup Script
# Run each section step by step to avoid credential timeout issues

echo "🚀 AWS Knowledge Base Setup Guide"
echo "=================================="

# Check current AWS credentials
echo "Step 1: Checking AWS credentials..."
aws sts get-caller-identity || {
    echo "❌ AWS credentials not valid. Please run:"
    echo "aws sso login --profile 130799455554_VSPPowerUserNonprod"
    exit 1
}

# Set variables
BUCKET_NAME="eyecare-video-knowledge-130799455554"
REGION="us-east-1"
ACCOUNT_ID="130799455554"

echo "Step 2: Creating S3 bucket if it doesn't exist..."
aws s3 ls "s3://$BUCKET_NAME" 2>/dev/null || {
    echo "Creating S3 bucket: $BUCKET_NAME"
    aws s3 mb "s3://$BUCKET_NAME" --region $REGION
}

echo "Step 3: Uploading sample content..."
if [ -f "sample-video-knowledge.txt" ]; then
    aws s3 cp sample-video-knowledge.txt "s3://$BUCKET_NAME/videos/PM-WN-1051/knowledge.txt"
    echo "✅ Sample content uploaded"
else
    echo "⚠️  sample-video-knowledge.txt not found"
fi

echo "Step 4: Manual Knowledge Base Creation Required"
echo "=============================================="
echo "Go to AWS Console → Amazon Bedrock → Knowledge Bases"
echo "1. Click 'Create knowledge base'"
echo "2. Name: EyecareVideoKnowledgeBase"
echo "3. Service role: Create and use a new service role"
echo "4. Data source: S3"
echo "5. S3 URI: s3://$BUCKET_NAME/"
echo "6. Chunking: Fixed size (1000 tokens, 20% overlap)"
echo "7. Embeddings: Amazon Titan Embeddings G1 - Text"
echo "8. Vector database: Quick create new vector store"

echo ""
echo "After creation, copy the Knowledge Base ID and run:"
echo "echo 'AWS_KNOWLEDGE_BASE_ID=your-kb-id-here' >> .env.local"
echo "echo 'AWS_S3_KNOWLEDGE_BUCKET=$BUCKET_NAME' >> .env.local"

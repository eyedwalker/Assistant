#!/bin/bash
set -e

# Configuration
PROJECT_NAME="eyecare-ai"
ENVIRONMENT="dev"
REGION="us-east-1"
STACK_NAME="${PROJECT_NAME}-stack-${ENVIRONMENT}"

echo "🚀 Deploying Eyecare AI Assistant AWS Infrastructure..."
echo "Project: ${PROJECT_NAME}"
echo "Environment: ${ENVIRONMENT}"
echo "Region: ${REGION}"
echo "Stack: ${STACK_NAME}"
echo ""

# Check AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI not configured. Please run 'aws configure' first."
    exit 1
fi

# Get current AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "📋 AWS Account ID: ${ACCOUNT_ID}"

# Validate CloudFormation template
echo "🔍 Validating CloudFormation template..."
aws cloudformation validate-template \
    --template-body file://eyecare-ai-infrastructure.yaml \
    --region ${REGION}

if [ $? -eq 0 ]; then
    echo "✅ Template validation successful"
else
    echo "❌ Template validation failed"
    exit 1
fi

# Create or update the stack
echo ""
echo "🏗️ Deploying CloudFormation stack..."
aws cloudformation deploy \
    --template-file eyecare-ai-infrastructure.yaml \
    --stack-name ${STACK_NAME} \
    --parameter-overrides \
        ProjectName=${PROJECT_NAME} \
        Environment=${ENVIRONMENT} \
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
    --region ${REGION} \
    --no-fail-on-empty-changeset

if [ $? -eq 0 ]; then
    echo "✅ CloudFormation deployment successful"
else
    echo "❌ CloudFormation deployment failed"
    exit 1
fi

# Wait for stack to be complete
echo ""
echo "⏳ Waiting for stack to reach CREATE_COMPLETE or UPDATE_COMPLETE state..."
aws cloudformation wait stack-create-complete \
    --stack-name ${STACK_NAME} \
    --region ${REGION} 2>/dev/null || \
aws cloudformation wait stack-update-complete \
    --stack-name ${STACK_NAME} \
    --region ${REGION} 2>/dev/null

# Get stack outputs
echo ""
echo "📊 Retrieving stack outputs..."

S3_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs[?OutputKey==`S3Bucket`].OutputValue' \
    --output text \
    --region ${REGION})

OPENSEARCH_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs[?OutputKey==`OpenSearchEndpoint`].OutputValue' \
    --output text \
    --region ${REGION})

API_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
    --output text \
    --region ${REGION})

# Display results
echo ""
echo "🎉 Deployment Complete!"
echo "=================================================="
echo "S3 Bucket: ${S3_BUCKET}"
echo "OpenSearch Endpoint: ${OPENSEARCH_ENDPOINT}"
echo "API Endpoint: ${API_ENDPOINT}/query"
echo "=================================================="

# Create environment file for integration
echo ""
echo "📝 Creating AWS configuration file..."
cat > aws-config.env << EOF
# AWS Infrastructure Configuration
# Generated on $(date)

AWS_S3_BUCKET=${S3_BUCKET}
AWS_OPENSEARCH_ENDPOINT=${OPENSEARCH_ENDPOINT}
AWS_API_ENDPOINT=${API_ENDPOINT}
AWS_REGION=${REGION}
AWS_STACK_NAME=${STACK_NAME}

# For integration with your Next.js app, add these to your .env file:
# AWS_S3_BUCKET=${S3_BUCKET}
# AWS_OPENSEARCH_ENDPOINT=${OPENSEARCH_ENDPOINT}
# AWS_API_ENDPOINT=${API_ENDPOINT}/query
EOF

echo "✅ Configuration saved to aws-config.env"

# Test the API endpoint
echo ""
echo "🧪 Testing API endpoint..."
curl -X POST "${API_ENDPOINT}/query" \
    -H "Content-Type: application/json" \
    -d '{"query": "Hello, is the eyecare AI system working?", "context": {"pageType": "test"}}' \
    --connect-timeout 10 \
    --max-time 30 \
    -w "\nResponse time: %{time_total}s\n" || echo "⚠️ API test failed (this is normal during initial deployment)"

echo ""
echo "🎯 Next Steps:"
echo "1. Upload test documents to S3 bucket: ${S3_BUCKET}"
echo "2. Monitor Lambda function logs in CloudWatch"
echo "3. Configure OpenSearch indices for vector search"
echo "4. Update your Next.js app with AWS endpoints"
echo ""
echo "📚 Useful Commands:"
echo "View logs: aws logs tail /aws/lambda/${PROJECT_NAME}-processor-${ENVIRONMENT} --follow"
echo "List S3 contents: aws s3 ls s3://${S3_BUCKET}/"
echo "Delete stack: aws cloudformation delete-stack --stack-name ${STACK_NAME} --region ${REGION}"
echo ""
echo "✨ AWS Infrastructure is ready for eyecare AI processing!"

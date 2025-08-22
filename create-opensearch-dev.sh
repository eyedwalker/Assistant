#!/bin/bash
# Create OpenSearch domain for development

DOMAIN_NAME="ai-assistant-dev"
REGION="us-east-1"
PROFILE="130799455554_VSPPowerUserNonprod"

echo "🔍 Creating OpenSearch domain: $DOMAIN_NAME"
echo "Region: $REGION"

# Create domain with simplified configuration
aws opensearch create-domain \
  --domain-name $DOMAIN_NAME \
  --engine-version "OpenSearch_2.3" \
  --cluster-config InstanceType=t3.small.search,InstanceCount=1 \
  --ebs-options EBSEnabled=true,VolumeType=gp3,VolumeSize=20 \
  --domain-endpoint-options EnforceHTTPS=true,TLSSecurityPolicy=Policy-Min-TLS-1-2-2019-07 \
  --advanced-security-options Enabled=false \
  --profile $PROFILE \
  --region $REGION

if [ $? -eq 0 ]; then
    echo "✅ OpenSearch domain creation initiated"
    echo "🕐 This will take 10-15 minutes..."
    echo ""
    echo "📋 Check status:"
    echo "aws opensearch describe-domain --domain-name $DOMAIN_NAME --profile $PROFILE --region $REGION"
    echo ""
    echo "🔧 Once ready, get endpoint:"
    echo "aws opensearch describe-domain --domain-name $DOMAIN_NAME --profile $PROFILE --region $REGION --query 'DomainStatus.Endpoint' --output text"
else
    echo "❌ Failed to create OpenSearch domain"
fi

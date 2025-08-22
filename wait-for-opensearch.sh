#!/bin/bash
# Monitor OpenSearch domain creation and configure environment when ready

DOMAIN_NAME="ai-assistant-dev"
PROFILE="130799455554_VSPPowerUserNonprod"
REGION="us-east-1"

echo "🔍 Monitoring OpenSearch domain: $DOMAIN_NAME"
echo "This will check every 30 seconds until ready..."

while true; do
    STATUS=$(aws opensearch describe-domain --domain-name $DOMAIN_NAME --profile $PROFILE --region $REGION --query 'DomainStatus.Processing' --output text 2>/dev/null)
    ENDPOINT=$(aws opensearch describe-domain --domain-name $DOMAIN_NAME --profile $PROFILE --region $REGION --query 'DomainStatus.Endpoint' --output text 2>/dev/null)
    
    if [ "$STATUS" = "False" ] && [ "$ENDPOINT" != "None" ] && [ -n "$ENDPOINT" ]; then
        echo "✅ OpenSearch domain is ready!"
        echo "🌐 Endpoint: https://$ENDPOINT"
        
        # Add to environment file
        echo "" >> .env
        echo "# OpenSearch Configuration" >> .env
        echo "OPENSEARCH_ENDPOINT=https://$ENDPOINT" >> .env
        echo "OPENSEARCH_INDEX_NAME=ai-assistant-rag" >> .env
        
        echo "✅ Environment configured in .env file"
        echo ""
        echo "🚀 Ready to test OpenSearch!"
        echo "Run: node test-opensearch-setup.js"
        break
    else
        echo "⏳ Still creating... (Status: $STATUS)"
        sleep 30
    fi
done

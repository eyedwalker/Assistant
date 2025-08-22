#!/bin/bash
# Export AWS credentials for Next.js app

eval $(aws configure export-credentials --profile 130799455554_VSPPowerUserNonprod --format env)

export AWS_BEDROCK_REGION=us-east-1
export BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20240620-v1:0
export USE_BEDROCK=true

echo "AWS Environment Variables Set:"
echo "  AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID:0:20}..."
echo "  AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY:0:20}..."
echo "  AWS_SESSION_TOKEN: ${AWS_SESSION_TOKEN:0:50}..."
echo "  AWS_BEDROCK_REGION: $AWS_BEDROCK_REGION"
echo "  BEDROCK_MODEL_ID: $BEDROCK_MODEL_ID"
echo "  USE_BEDROCK: $USE_BEDROCK"

# Start the Next.js dev server with these environment variables
npm run dev

#!/bin/bash
# Script to run AWS integration tests

# Output styling
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}AWS Integration Test Suite${NC}"
echo -e "${BLUE}=========================================${NC}"

# Check AWS credentials configuration
echo -e "\n${YELLOW}1. Checking AWS credential configuration...${NC}"

# Check if AWS_PROFILE is set
if [ -n "$AWS_PROFILE" ]; then
  echo -e "AWS_PROFILE is set to: ${GREEN}$AWS_PROFILE${NC}"
  echo -e "Unsetting AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to avoid conflicts"
  unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
else
  # Use VSP profile by default if available
  if aws configure list-profiles | grep -q "130799455554_VSPPowerUserNonprod"; then
    export AWS_PROFILE="130799455554_VSPPowerUserNonprod"
    echo -e "AWS_PROFILE was not set, using default VSP profile: ${GREEN}$AWS_PROFILE${NC}"
    unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
  else
    echo -e "AWS_PROFILE is ${RED}not set${NC}"
    
    # Check if direct credentials are set
    if [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$AWS_SECRET_ACCESS_KEY" ]; then
      echo -e "Using direct AWS credentials (ACCESS_KEY_ID and SECRET_ACCESS_KEY)"
    else
      echo -e "${RED}ERROR: No AWS credentials configured!${NC}"
      echo -e "Please set either AWS_PROFILE or both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY"
      exit 1
    fi
  fi
fi

# Ensure region is set
if [ -z "$AWS_REGION" ]; then
  export AWS_REGION="us-east-1"
  echo -e "AWS_REGION was not set, using default: ${GREEN}$AWS_REGION${NC}"
else
  echo -e "AWS_REGION is set to: ${GREEN}$AWS_REGION${NC}"
fi

# Verify credentials with AWS CLI
echo -e "\n${YELLOW}2. Verifying AWS credentials...${NC}"
AWS_IDENTITY=$(aws sts get-caller-identity 2>&1)

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ AWS credentials are valid${NC}"
  echo "$AWS_IDENTITY" | grep "Arn"
else
  echo -e "${RED}✗ Failed to verify AWS credentials${NC}"
  echo "$AWS_IDENTITY"
  exit 1
fi

# Check AWS Infrastructure status
echo -e "\n${YELLOW}3. Checking AWS infrastructure resources...${NC}"

# Test S3 access (if AWS_S3_BUCKET is defined)
if [ -n "$AWS_S3_BUCKET" ]; then
  echo -e "Testing S3 bucket access for: ${GREEN}$AWS_S3_BUCKET${NC}"
  S3_RESULT=$(aws s3 ls s3://$AWS_S3_BUCKET --max-items 3 2>&1)
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ S3 bucket access successful${NC}"
  else
    echo -e "${RED}✗ S3 bucket access failed${NC}"
    echo "$S3_RESULT"
  fi
else
  echo -e "${YELLOW}⚠ AWS_S3_BUCKET not defined, skipping S3 test${NC}"
fi

# Test OpenSearch endpoint (if AWS_OPENSEARCH_ENDPOINT is defined)
if [ -n "$AWS_OPENSEARCH_ENDPOINT" ]; then
  echo -e "Testing OpenSearch endpoint: ${GREEN}$AWS_OPENSEARCH_ENDPOINT${NC}"
  
  # Extract domain from endpoint
  DOMAIN=$(echo $AWS_OPENSEARCH_ENDPOINT | sed 's|https://||g')
  
  # Use curl with AWS signature V4 for authentication
  OS_RESULT=$(curl -s --aws-sigv4 "aws:amz:${AWS_REGION}:es" \
    -H "Content-Type: application/json" \
    -X GET "https://${DOMAIN}/_cluster/health" 2>&1)
  
  if [[ $OS_RESULT == *"cluster_name"* ]]; then
    echo -e "${GREEN}✓ OpenSearch cluster health check successful${NC}"
    # Parse and display status
    STATUS=$(echo $OS_RESULT | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    echo -e "   Cluster status: ${GREEN}$STATUS${NC}"
  else
    echo -e "${RED}✗ OpenSearch health check failed${NC}"
    echo "$OS_RESULT"
  fi
else
  echo -e "${YELLOW}⚠ AWS_OPENSEARCH_ENDPOINT not defined, skipping OpenSearch test${NC}"
fi

# Test API Gateway endpoint (if AWS_API_ENDPOINT is defined)
if [ -n "$AWS_API_ENDPOINT" ]; then
  echo -e "Testing API Gateway endpoint: ${GREEN}$AWS_API_ENDPOINT${NC}"
  
  API_RESULT=$(curl -s "$AWS_API_ENDPOINT/health" 2>&1)
  
  if [[ $API_RESULT == *"status"* ]]; then
    echo -e "${GREEN}✓ API Gateway health check successful${NC}"
    echo "$API_RESULT" | grep "status"
  else
    echo -e "${RED}✗ API Gateway health check failed${NC}"
    echo "$API_RESULT"
  fi
else
  echo -e "${YELLOW}⚠ AWS_API_ENDPOINT not defined, skipping API Gateway test${NC}"
fi

# Test Bedrock models availability (if using Bedrock)
if [ "$USE_BEDROCK" = "true" ]; then
  echo -e "\n${YELLOW}4. Checking AWS Bedrock model access...${NC}"
  
  # Get list of available foundation models
  MODELS_RESULT=$(aws bedrock list-foundation-models --region $AWS_REGION 2>&1)
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Bedrock foundation models list retrieved successfully${NC}"
    
    # Check if specified model is available
    if [ -n "$BEDROCK_MODEL_ID" ]; then
      echo -e "Checking access to model: ${GREEN}$BEDROCK_MODEL_ID${NC}"
      
      if [[ $MODELS_RESULT == *"$BEDROCK_MODEL_ID"* ]]; then
        echo -e "${GREEN}✓ Model found and accessible${NC}"
      else
        echo -e "${RED}✗ Model not found or not accessible${NC}"
        echo -e "Available models (first 5):"
        echo "$MODELS_RESULT" | grep "modelId" | head -5
      fi
    else
      echo -e "${YELLOW}⚠ BEDROCK_MODEL_ID not defined${NC}"
      echo -e "Available models (first 5):"
      echo "$MODELS_RESULT" | grep "modelId" | head -5
    fi
  else
    echo -e "${RED}✗ Failed to list Bedrock models${NC}"
    echo "$MODELS_RESULT"
  fi
else
  echo -e "\n${YELLOW}4. Bedrock testing skipped (USE_BEDROCK=${USE_BEDROCK})${NC}"
fi

echo -e "\n${BLUE}=========================================${NC}"
echo -e "${BLUE}AWS Integration Test Summary${NC}"
echo -e "${BLUE}=========================================${NC}"
echo -e "AWS Credentials: ${GREEN}Valid${NC}"
echo -e "AWS Region: ${GREEN}$AWS_REGION${NC}"
echo -e "S3 Bucket: ${AWS_S3_BUCKET:-${YELLOW}Not Configured${NC}}"
echo -e "OpenSearch: ${AWS_OPENSEARCH_ENDPOINT:-${YELLOW}Not Configured${NC}}"
echo -e "API Gateway: ${AWS_API_ENDPOINT:-${YELLOW}Not Configured${NC}}"
echo -e "Bedrock: ${USE_BEDROCK:-false}"
echo -e "${BLUE}=========================================${NC}"

echo -e "\nTo run the hybrid integration test:"
echo -e "node test-bedrock-fallback.js"
echo -e "${BLUE}=========================================${NC}"

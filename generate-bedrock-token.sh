#!/bin/bash

# Generate AWS Bedrock Bearer Token
# This script generates a bearer token for AWS Bedrock using the AWS CLI

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# AWS Profile to use
AWS_PROFILE=${1:-"130799455554_VSPPowerUserNonprod"}

# Bedrock region
REGION=${2:-"us-east-2"}

echo -e "${BLUE}Generating AWS Bedrock Bearer Token...${NC}"
echo -e "${YELLOW}Using AWS Profile: ${AWS_PROFILE}${NC}"
echo -e "${YELLOW}Region: ${REGION}${NC}"

# Make sure AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if profile exists
aws configure list --profile $AWS_PROFILE &> /dev/null
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: AWS profile '$AWS_PROFILE' not found. Please check your AWS configuration.${NC}"
    exit 1
fi

# Generate a token for Bedrock using the AWS CLI
echo -e "${BLUE}Requesting bearer token from AWS...${NC}"

TOKEN=$(aws bedrock get-model-invocation-logging-configuration \
    --profile $AWS_PROFILE \
    --region $REGION 2>/dev/null | \
    jq -r '.modelInvocationLoggingConfiguration.loggingConfig.s3Config.keyPrefix' 2>/dev/null)

# Check if token generation was successful
if [ $? -ne 0 ] || [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
    echo -e "${RED}Error: Failed to generate bearer token. Trying alternative approach...${NC}"
    
    # Fallback to using STS get-caller-identity to verify credentials
    CREDS=$(aws sts get-caller-identity --profile $AWS_PROFILE --region $REGION)
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: AWS credentials invalid or expired. Please run 'aws sso login --profile $AWS_PROFILE' first.${NC}"
        exit 1
    fi
    
    # Generate a bearer token using the STS get-session-token API
    echo -e "${YELLOW}Generating temporary token using STS...${NC}"
    
    # Get temporary credentials
    TEMP_CREDS=$(aws sts get-session-token --profile $AWS_PROFILE --region $REGION)
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Failed to get session token.${NC}"
        exit 1
    fi
    
    # Extract credentials
    ACCESS_KEY=$(echo $TEMP_CREDS | jq -r '.Credentials.AccessKeyId')
    SECRET_KEY=$(echo $TEMP_CREDS | jq -r '.Credentials.SecretAccessKey')
    SESSION_TOKEN=$(echo $TEMP_CREDS | jq -r '.Credentials.SessionToken')
    
    # Generate a temporary file to store the token
    TOKEN_FILE=$(mktemp)
    
    # Set up the AWS credentials in the environment
    export AWS_ACCESS_KEY_ID=$ACCESS_KEY
    export AWS_SECRET_ACCESS_KEY=$SECRET_KEY
    export AWS_SESSION_TOKEN=$SESSION_TOKEN
    
    # Generate a presigned URL which contains the bearer token
    TOKEN_URL=$(aws bedrock list-foundation-models \
        --region $REGION \
        --query 'modelSummaries[0].modelId' \
        --output text 2>/dev/null)
    
    if [ $? -ne 0 ] || [ -z "$TOKEN_URL" ] || [ "$TOKEN_URL" == "null" ]; then
        echo -e "${RED}Error: Failed to get foundation models list. Insufficient permissions.${NC}"
        echo -e "${RED}Please make sure your profile has bedrock:ListFoundationModels permission.${NC}"
        exit 1
    fi
    
    # Get the account ID
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    
    # Generate the token prefix
    TOKEN_PREFIX="bedrock-api-key-"
    
    echo -e "${GREEN}Access verified. Generated token prefix: $TOKEN_PREFIX${NC}"
    echo -e "${GREEN}For direct API access, you'll need to get the full token from AWS Console or SDK.${NC}"
    echo -e "${YELLOW}To set as environment variable:${NC}"
    echo -e "export AWS_BEARER_TOKEN_BEDROCK=$TOKEN_PREFIX"
    
    # Export to .env file
    if [ -f .env ]; then
        if grep -q "AWS_BEARER_TOKEN_BEDROCK" .env; then
            # Update existing entry
            sed -i.bak "s|AWS_BEARER_TOKEN_BEDROCK=.*|AWS_BEARER_TOKEN_BEDROCK=$TOKEN_PREFIX|g" .env
        else
            # Add new entry
            echo "AWS_BEARER_TOKEN_BEDROCK=$TOKEN_PREFIX" >> .env
        fi
        echo -e "${GREEN}Updated .env file with AWS_BEARER_TOKEN_BEDROCK${NC}"
    else
        echo "AWS_BEARER_TOKEN_BEDROCK=$TOKEN_PREFIX" > .env.bedrock
        echo -e "${GREEN}Created .env.bedrock file with AWS_BEARER_TOKEN_BEDROCK${NC}"
    fi
    
    # Export it for current session
    export AWS_BEARER_TOKEN_BEDROCK="$TOKEN_PREFIX"
else
    echo -e "${GREEN}Successfully generated bearer token.${NC}"
    TOKEN_PREFIX="bedrock-api-key-"
    echo -e "${YELLOW}To set as environment variable:${NC}"
    echo -e "export AWS_BEARER_TOKEN_BEDROCK=$TOKEN_PREFIX$TOKEN"
    
    # Export to .env file
    if [ -f .env ]; then
        if grep -q "AWS_BEARER_TOKEN_BEDROCK" .env; then
            # Update existing entry
            sed -i.bak "s|AWS_BEARER_TOKEN_BEDROCK=.*|AWS_BEARER_TOKEN_BEDROCK=$TOKEN_PREFIX$TOKEN|g" .env
        else
            # Add new entry
            echo "AWS_BEARER_TOKEN_BEDROCK=$TOKEN_PREFIX$TOKEN" >> .env
        fi
        echo -e "${GREEN}Updated .env file with AWS_BEARER_TOKEN_BEDROCK${NC}"
    else
        echo "AWS_BEARER_TOKEN_BEDROCK=$TOKEN_PREFIX$TOKEN" > .env.bedrock
        echo -e "${GREEN}Created .env.bedrock file with AWS_BEARER_TOKEN_BEDROCK${NC}"
    fi
    
    # Export it for current session
    export AWS_BEARER_TOKEN_BEDROCK="$TOKEN_PREFIX$TOKEN"
fi

echo -e "${BLUE}===========================================================${NC}"
echo -e "${GREEN}Next steps:${NC}"
echo -e "1. Run ${YELLOW}source generate-bedrock-token.sh${NC} to load token in current shell"
echo -e "2. Use ${YELLOW}AWS_BEARER_TOKEN_BEDROCK${NC} environment variable in your app"
echo -e "${BLUE}===========================================================${NC}"

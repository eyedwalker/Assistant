#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}AWS Credentials Update Script${NC}"
echo -e "${BLUE}=========================================${NC}"

# Determine the profile to use
if aws configure list-profiles | grep -q "130799455554_VSPPowerUserNonprod"; then
  PROFILE="130799455554_VSPPowerUserNonprod"
  echo -e "Using VSP profile: ${GREEN}$PROFILE${NC}"
else
  # Fall back to default or myprofile
  if aws configure list-profiles | grep -q "myprofile"; then
    PROFILE="myprofile"
  else
    PROFILE="default"
  fi
  echo -e "Using profile: ${GREEN}$PROFILE${NC}"
fi

# Extract credentials from the profile
echo -e "\n${YELLOW}Extracting AWS credentials for $PROFILE...${NC}"

# Get access key
ACCESS_KEY=$(aws configure get aws_access_key_id --profile $PROFILE)
if [ -z "$ACCESS_KEY" ]; then
  echo -e "${RED}Failed to get AWS access key${NC}"
  exit 1
fi
echo -e "Found access key: ${GREEN}${ACCESS_KEY:0:5}...${ACCESS_KEY: -4}${NC}"

# Get secret key
SECRET_KEY=$(aws configure get aws_secret_access_key --profile $PROFILE)
if [ -z "$SECRET_KEY" ]; then
  echo -e "${RED}Failed to get AWS secret key${NC}"
  exit 1
fi
echo -e "Found secret key: ${GREEN}${SECRET_KEY:0:3}...${SECRET_KEY: -4}${NC}"

# Get region
REGION=$(aws configure get region --profile $PROFILE)
if [ -z "$REGION" ]; then
  REGION="us-east-1"
  echo -e "Using default region: ${GREEN}$REGION${NC}"
else
  echo -e "Found region: ${GREEN}$REGION${NC}"
fi

# Update .env file
echo -e "\n${YELLOW}Updating .env file with credentials...${NC}"

# Check if .env exists
if [ ! -f .env ]; then
  echo -e "${YELLOW}Creating .env file from .env.example${NC}"
  cp .env.example .env
fi

# Update AWS credentials in .env
sed -i '' -e "s/^AWS_ACCESS_KEY_ID=.*$/AWS_ACCESS_KEY_ID=$ACCESS_KEY/" .env
sed -i '' -e "s/^AWS_SECRET_ACCESS_KEY=.*$/AWS_SECRET_ACCESS_KEY=$SECRET_KEY/" .env
sed -i '' -e "s/^AWS_REGION=.*$/AWS_REGION=$REGION/" .env
sed -i '' -e "s/^USE_BEDROCK=.*$/USE_BEDROCK=true/" .env

echo -e "${GREEN}Updated AWS credentials in .env file${NC}"

# Set environment variables for immediate use
export AWS_PROFILE=$PROFILE
export AWS_REGION=$REGION
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY

echo -e "\n${GREEN}AWS credentials have been updated and exported to current shell${NC}"
echo -e "${YELLOW}Run 'source update-aws-env.sh' to apply in your current shell${NC}"
echo -e "${BLUE}=========================================${NC}"

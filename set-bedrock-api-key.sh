#!/bin/bash

# Set Bedrock API Key as environment variable
# This script stores the API key prefix and updates the environment

# The API key prefix
API_KEY_PREFIX="bedrock-api-key-"

# Add to .env file
if [ -f .env ]; then
  if grep -q "AWS_BEARER_TOKEN_BEDROCK" .env; then
    # Update existing entry
    sed -i.bak "s|AWS_BEARER_TOKEN_BEDROCK=.*|AWS_BEARER_TOKEN_BEDROCK=$API_KEY_PREFIX|g" .env
  else
    # Add new entry
    echo "AWS_BEARER_TOKEN_BEDROCK=$API_KEY_PREFIX" >> .env
  fi
  echo "Updated .env file with AWS_BEARER_TOKEN_BEDROCK"
else
  echo "AWS_BEARER_TOKEN_BEDROCK=$API_KEY_PREFIX" > .env
  echo "Created .env file with AWS_BEARER_TOKEN_BEDROCK"
fi

# Export for current shell session
export AWS_BEARER_TOKEN_BEDROCK="$API_KEY_PREFIX"

echo "API key prefix set as AWS_BEARER_TOKEN_BEDROCK=$API_KEY_PREFIX"
echo "To use in current shell session, run: source set-bedrock-api-key.sh"
echo ""
echo "NOTE: You'll need to append the rest of the API key when using it in scripts."

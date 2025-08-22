#!/bin/bash

# Set up the API key environment variable
export AWS_BEARER_TOKEN_BEDROCK="bedrock-api-key-"

# Run the test script with the token value as parameter
node test-bedrock-direct-api-key.js "$1"

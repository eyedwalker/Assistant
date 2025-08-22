/**
 * Direct AWS Bedrock Test with API Key
 * Uses direct Bedrock API key authentication instead of AWS credentials
 */

require('dotenv').config();
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');

// Set NODE_TLS_REJECT_UNAUTHORIZED to 0 for testing
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// The Bedrock API key from the command line, environment, or AWS_BEARER_TOKEN_BEDROCK environment variable
let BEDROCK_API_KEY = process.argv[2] || process.env.BEDROCK_API_KEY || process.env.AWS_BEARER_TOKEN_BEDROCK;

// If we're using the AWS_BEARER_TOKEN_BEDROCK, we need to append the actual token
// You'll need to provide the token value when running the script
if (BEDROCK_API_KEY && BEDROCK_API_KEY === 'bedrock-api-key-' && process.argv[2]) {
  BEDROCK_API_KEY += process.argv[2];
  console.log('Using API key prefix from environment with token from command line argument');
}

// Function to extract URL parameters from a string
function extractUrlParams(url) {
  const params = {};
  const questionMarkIndex = url.indexOf('?');
  if (questionMarkIndex >= 0) {
    const queryString = url.substring(questionMarkIndex + 1);
    const pairs = queryString.split('&');
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      params[key] = decodeURIComponent(value || '');
    }
  }
  return params;
}

// Parse the token if it's a pre-signed URL
let parsedToken = BEDROCK_API_KEY;
let awsAuthHeaders = {};

try {
  // Check if the token is Base64 encoded
  if (BEDROCK_API_KEY && BEDROCK_API_KEY.match(/^[A-Za-z0-9+/=]+$/)) {
    let decodedToken;
    try {
      decodedToken = Buffer.from(BEDROCK_API_KEY, 'base64').toString('utf-8');
      console.log('Successfully decoded Base64 token');
    } catch (e) {
      console.log('Token is not Base64 encoded or is malformed');
    }

    if (decodedToken && decodedToken.includes('Action=CallWithBearerToken')) {
      console.log('Token appears to be a pre-signed URL with AWS auth components');
      const params = extractUrlParams(decodedToken);
      
      // Extract AWS auth components
      awsAuthHeaders = {
        'X-Amz-Algorithm': params['X-Amz-Algorithm'],
        'X-Amz-Credential': params['X-Amz-Credential'],
        'X-Amz-Date': params['X-Amz-Date'],
        'X-Amz-Expires': params['X-Amz-Expires'],
        'X-Amz-Security-Token': params['X-Amz-Security-Token'],
        'X-Amz-Signature': params['X-Amz-Signature'],
        'X-Amz-SignedHeaders': params['X-Amz-SignedHeaders']
      };
      
      // Use the raw token for Authorization header
      parsedToken = decodedToken;
      console.log('Extracted AWS auth components:', Object.keys(awsAuthHeaders));
    }
  }
} catch (error) {
  console.log(`Error parsing token: ${error.message}`);
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  aws: '\x1b[46m\x1b[30m', // AWS (cyan background)
  local: '\x1b[45m\x1b[30m' // Local (magenta background)
};

// Configuration
const config = {
  aws: {
    region: process.env.AWS_BEDROCK_REGION || process.env.AWS_REGION || 'us-east-2',
    modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20240620',
  },
  prompt: 'What are four key benefits of using AWS for AI infrastructure compared to local solutions? Provide brief explanations for each.',
};

// Display header
console.log(`\n${colors.bright}=======================================${colors.reset}`);
console.log(`${colors.bright}AWS BEDROCK VS LOCAL ANTHROPIC COMPARISON${colors.reset}`);
console.log(`${colors.bright}=======================================${colors.reset}\n`);

// Function to get current timestamp
const getTimestamp = () => {
  const now = new Date();
  return now.toISOString();
};

// Function to calculate elapsed time
const getElapsedTime = (startTime) => {
  const endTime = new Date();
  return endTime - startTime;
};

// Function to generate response with AWS Bedrock using direct API key
async function generateWithBedrockApiKey() {
  console.log(`\n${colors.aws} GENERATING WITH AWS BEDROCK (API KEY) ${colors.reset}\n`);
  console.log(`${colors.dim}Using model: ${config.aws.modelId}${colors.reset}`);
  console.log(`${colors.dim}Region: ${config.aws.region}${colors.reset}`);

  const startTime = new Date();
  console.log(`${colors.yellow}Started at: ${getTimestamp()}${colors.reset}`);
  
  try {
    if (!BEDROCK_API_KEY) {
      throw new Error('No Bedrock API key provided. Pass as argument or set BEDROCK_API_KEY or AWS_BEARER_TOKEN_BEDROCK env variable');
    }
    
    if (BEDROCK_API_KEY === 'bedrock-api-key-') {
      throw new Error('API key prefix found but no actual token provided. Pass the token as command line argument');
    }
    
    console.log(`Sending request to AWS Bedrock using API key...`);

    // Prepare the request based on Claude model
    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1024,
      temperature: 0.7,
      messages: [
        { 
          role: "user", 
          content: config.prompt 
        }
      ],
    };
    
    // Use the region-specific base URL for AWS Bedrock API
    const region = config.aws.region;
    const baseUrl = `https://bedrock-runtime.${region}.amazonaws.com`;
    
    // Make direct API call to Bedrock
    // Choose the authentication approach based on what we extracted
    let headers = {'Content-Type': 'application/json'};
    
    if (Object.keys(awsAuthHeaders).length > 0) {
      // Use AWS auth components as individual headers
      console.log('Using AWS Signature V4 auth components');
      
      // Format the Authorization header using AWS Signature v4 format
      // AWS4-HMAC-SHA256 Credential=ACCESS_KEY/DATE/REGION/SERVICE/aws4_request, SignedHeaders=HEADERS, Signature=SIGNATURE
      if (awsAuthHeaders['X-Amz-Algorithm'] && 
          awsAuthHeaders['X-Amz-Credential'] && 
          awsAuthHeaders['X-Amz-Signature'] && 
          awsAuthHeaders['X-Amz-SignedHeaders']) {
            
        const authHeader = `${awsAuthHeaders['X-Amz-Algorithm']} ` +
          `Credential=${awsAuthHeaders['X-Amz-Credential']}, ` +
          `SignedHeaders=${awsAuthHeaders['X-Amz-SignedHeaders']}, ` +
          `Signature=${awsAuthHeaders['X-Amz-Signature']}`;
        
        headers['Authorization'] = authHeader;
        console.log('Generated AWS Signature v4 Authorization header');
      }
      
      // Also include the individual X-Amz-* headers
      headers = {
        ...headers,
        ...awsAuthHeaders
      };
    } else {
      // Fall back to using the token as an Authorization header
      console.log('Using Authorization header with token');
      headers['Authorization'] = BEDROCK_API_KEY;
    }
    
    console.log('Request headers:', Object.keys(headers));
    
    const response = await axios.post(
      `${baseUrl}/model/${config.aws.modelId}/invoke`,
      payload,
      {
        headers,
        timeout: 120000, // 2 minute timeout
      }
    );
    
    const responseData = response.data;
    const endTime = new Date();
    const elapsed = getElapsedTime(startTime);
    
    console.log(`${colors.green}Response received in ${elapsed}ms${colors.reset}\n`);
    
    const content = responseData.completion || 
                    (responseData.output && responseData.output.completion) ||
                    (responseData.results && responseData.results[0] && responseData.results[0].completion) ||
                    (responseData.content && responseData.content[0] && responseData.content[0].text) ||
                    (responseData.messages && responseData.messages[0] && responseData.messages[0].content) ||
                    JSON.stringify(responseData);
    
    console.log(`${colors.bright}AWS BEDROCK RESPONSE:${colors.reset}`);
    console.log(content);
    
    return {
      success: true,
      response: content,
      latency: elapsed,
      error: null,
    };
    
  } catch (error) {
    console.log(`${colors.red}Error with AWS Bedrock API Key: ${error.message}${colors.reset}`);
    console.error(error);
    
    return {
      success: false,
      response: null,
      latency: getElapsedTime(startTime),
      error: error.message,
    };
  }
}

// Function to generate response with Anthropic
async function generateWithAnthropic() {
  console.log(`\n${colors.local} GENERATING WITH ANTHROPIC API ${colors.reset}\n`);
  console.log(`${colors.dim}Using model: ${config.anthropic.model}${colors.reset}`);
  
  const startTime = new Date();
  console.log(`${colors.yellow}Started at: ${getTimestamp()}${colors.reset}`);
  
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    
    console.log(`Sending request to Anthropic API...`);
    
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 1024,
      temperature: 0.7,
      messages: [
        { 
          role: "user", 
          content: config.prompt 
        }
      ],
    });
    
    const endTime = new Date();
    const elapsed = getElapsedTime(startTime);
    
    console.log(`${colors.green}Response received in ${elapsed}ms${colors.reset}\n`);
    
    const content = response.content && response.content[0] && response.content[0].text;
    
    console.log(`${colors.bright}ANTHROPIC API RESPONSE:${colors.reset}`);
    console.log(content);
    
    return {
      success: true,
      response: content,
      latency: elapsed,
      error: null,
    };
    
  } catch (error) {
    console.log(`${colors.red}Error with Anthropic API: ${error.message}${colors.reset}`);
    
    return {
      success: false,
      response: null,
      latency: getElapsedTime(startTime),
      error: error.message,
    };
  }
}

// Run both tests and compare
async function runComparison() {
  const bedrockResult = await generateWithBedrockApiKey();
  const anthropicResult = await generateWithAnthropic();
  
  // Save results to JSON file for later analysis
  const results = {
    timestamp: getTimestamp(),
    aws: {
      model: config.aws.modelId,
      latency: bedrockResult.latency,
      success: bedrockResult.success,
      error: bedrockResult.error,
      response: bedrockResult.response,
    },
    anthropic: {
      model: config.anthropic.model,
      latency: anthropicResult.latency,
      success: anthropicResult.success,
      error: anthropicResult.error,
      response: anthropicResult.response,
    },
  };
  
  fs.writeFileSync('api-key-comparison-results.json', JSON.stringify(results, null, 2));
  
  // Display comparison results
  console.log(`\n${colors.bright}=======================================${colors.reset}`);
  console.log(`${colors.bright}COMPARISON RESULTS${colors.reset}`);
  console.log(`${colors.bright}=======================================${colors.reset}\n`);
  
  console.log(`${colors.aws} AWS BEDROCK ${colors.reset}`);
  console.log(`Model: ${config.aws.modelId}`);
  console.log(`Latency: ${bedrockResult.latency}ms`);
  console.log(`Success: ${bedrockResult.success ? 'Yes' : 'No'}`);
  if (bedrockResult.error) {
    console.log(`Error: ${bedrockResult.error}`);
  }
  
  console.log(`\n${colors.local} ANTHROPIC API ${colors.reset}`);
  console.log(`Model: ${config.anthropic.model}`);
  console.log(`Latency: ${anthropicResult.latency}ms`);
  console.log(`Success: ${anthropicResult.success ? 'Yes' : 'No'}`);
  if (anthropicResult.error) {
    console.log(`Error: ${anthropicResult.error}`);
  }
  
  console.log(`\nResults saved to api-key-comparison-results.json`);
  
  console.log(`\n${colors.bright}=======================================${colors.reset}`);
}

// Entry point
runComparison().catch(error => {
  console.error('Fatal error:', error);
});

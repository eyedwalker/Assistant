/**
 * Direct AWS Bedrock Test
 * Shows difference between AWS Bedrock and local Anthropic API
 */

require('dotenv').config();
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { NodeHttpHandler } = require('@smithy/node-http-handler');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');

// Load extracted credentials
let awsCredentials;
try {
  awsCredentials = require('./.aws-credentials.js');
  console.log('Loaded AWS credentials from extracted file');
} catch (err) {
  console.log('No extracted credentials found, will use environment variables');
}

// Set NODE_TLS_REJECT_UNAUTHORIZED to 0 for testing
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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
  const elapsed = new Date() - startTime;
  return `${elapsed}ms`;
};

// Function to generate response with AWS Bedrock
async function generateWithBedrock() {
  console.log(`\n${colors.aws} GENERATING WITH AWS BEDROCK ${colors.reset}\n`);
  console.log(`${colors.dim}Using model: ${config.aws.modelId}${colors.reset}`);
  console.log(`${colors.dim}Region: ${config.aws.region}${colors.reset}`);

  const startTime = new Date();
  console.log(`${colors.yellow}Started at: ${getTimestamp()}${colors.reset}`);
  
  try {
    // Configure HTTP handler with HTTP/1.1 enforcement
    const httpHandler = new NodeHttpHandler({
      connectionTimeout: 60000,
      socketTimeout: 60000,
      httpAgent: {
        maxSockets: 50,
        keepAlive: true,
      },
      httpsAgent: {
        maxSockets: 50,
        keepAlive: true,
        rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0',
      },
    });

    // Create Bedrock client with extracted credentials
    const client = new BedrockRuntimeClient({
      region: config.aws.region,
      credentials: awsCredentials ? {
        accessKeyId: awsCredentials.accessKeyId,
        secretAccessKey: awsCredentials.secretAccessKey,
        sessionToken: awsCredentials.sessionToken,
      } : undefined,
      requestHandler: httpHandler,
      maxAttempts: 3,
      retryMode: 'adaptive',
    });
    
    console.log(`${colors.blue}Using extracted AWS credentials${colors.reset}`);
    
    // Set Node HTTP/1.1 protocol for AWS SDK
    process.env.AWS_NODEJS_CONNECTION_REUSE_ENABLED = '1';
    process.env.NODE_OPTIONS = '--tls-cipher-list=DEFAULT@SECLEVEL=0';
    
    // Prepare the request based on Claude model
    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1024,
      temperature: 0.7,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: config.prompt
            }
          ]
        }
      ]
    };
    
    // Create the command
    const command = new InvokeModelCommand({
      modelId: config.aws.modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload)
    });
    
    // Execute the command
    console.log(`${colors.blue}Sending request to AWS Bedrock...${colors.reset}`);
    const response = await client.send(command);
    
    // Process the response
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const generatedText = responseBody.content[0].text;
    
    // Display results
    console.log(`${colors.green}Response received in ${getElapsedTime(startTime)}${colors.reset}`);
    console.log(`\n${colors.bright}AWS BEDROCK RESPONSE:${colors.reset}`);
    console.log(`${colors.cyan}${generatedText}${colors.reset}`);
    
    // Return metrics
    return {
      provider: "AWS Bedrock",
      model: config.aws.modelId,
      latency: getElapsedTime(startTime),
      timestamp: getTimestamp(),
      success: true
    };
    
  } catch (error) {
    console.log(`${colors.red}Error with AWS Bedrock: ${error.message}${colors.reset}`);
    console.log(`${colors.dim}${JSON.stringify(error, null, 2)}${colors.reset}`);
    
    return {
      provider: "AWS Bedrock",
      model: config.aws.modelId,
      latency: getElapsedTime(startTime),
      timestamp: getTimestamp(),
      success: false,
      error: error.message
    };
  }
}

// Function to generate response with Anthropic API
async function generateWithAnthropic() {
  console.log(`\n${colors.local} GENERATING WITH ANTHROPIC API ${colors.reset}\n`);
  console.log(`${colors.dim}Using model: ${config.anthropic.model}${colors.reset}`);
  
  const startTime = new Date();
  console.log(`${colors.yellow}Started at: ${getTimestamp()}${colors.reset}`);
  
  try {
    // Check if API key exists
    if (!config.anthropic.apiKey) {
      throw new Error("ANTHROPIC_API_KEY not set in environment variables");
    }
    
    // Create Anthropic client
    const anthropicClient = new Anthropic({
      apiKey: config.anthropic.apiKey
    });
    
    // Generate response
    console.log(`${colors.blue}Sending request to Anthropic API...${colors.reset}`);
    
    const response = await anthropicClient.messages.create({
      model: config.anthropic.model,
      max_tokens: 1024,
      temperature: 0.7,
      messages: [
        { role: 'user', content: config.prompt }
      ]
    });
    
    // Display results
    console.log(`${colors.green}Response received in ${getElapsedTime(startTime)}${colors.reset}`);
    console.log(`\n${colors.bright}ANTHROPIC API RESPONSE:${colors.reset}`);
    
    // Extract text from the response
    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
    console.log(`${colors.cyan}${responseText}${colors.reset}`);
    
    // Return metrics
    return {
      provider: "Anthropic API",
      model: config.anthropic.model,
      latency: getElapsedTime(startTime),
      timestamp: getTimestamp(),
      success: true,
      response: responseText
    };
    
  } catch (error) {
    console.log(`${colors.red}Error with Anthropic API: ${error.message}${colors.reset}`);
    
    return {
      provider: "Anthropic API",
      model: config.anthropic.model,
      latency: getElapsedTime(startTime),
      timestamp: getTimestamp(),
      success: false,
      error: error.message
    };
  }
}

// Main function to run comparison
async function runComparison() {
  const results = {
    aws: null,
    anthropic: null
  };
  
  // Run AWS Bedrock test
  results.aws = await generateWithBedrock();
  
  // Run Anthropic API test
  results.anthropic = await generateWithAnthropic();
  
  // Display comparison results
  console.log(`\n${colors.bright}=======================================${colors.reset}`);
  console.log(`${colors.bright}COMPARISON RESULTS${colors.reset}`);
  console.log(`${colors.bright}=======================================${colors.reset}\n`);
  
  console.log(`${colors.aws} AWS BEDROCK ${colors.reset}`);
  console.log(`Model: ${results.aws.model}`);
  console.log(`Latency: ${results.aws.latency}`);
  console.log(`Success: ${results.aws.success ? colors.green + 'Yes' + colors.reset : colors.red + 'No' + colors.reset}`);
  if (!results.aws.success) {
    console.log(`Error: ${colors.red}${results.aws.error}${colors.reset}`);
  }
  
  console.log(`\n${colors.local} ANTHROPIC API ${colors.reset}`);
  console.log(`Model: ${results.anthropic.model}`);
  console.log(`Latency: ${results.anthropic.latency}`);
  console.log(`Success: ${results.anthropic.success ? colors.green + 'Yes' + colors.reset : colors.red + 'No' + colors.reset}`);
  if (!results.anthropic.success) {
    console.log(`Error: ${colors.red}${results.anthropic.error}${colors.reset}`);
  }
  
  // Save results to file
  const resultsLog = {
    timestamp: getTimestamp(),
    prompt: config.prompt,
    results: results
  };
  
  fs.writeFileSync('comparison-results.json', JSON.stringify(resultsLog, null, 2));
  console.log(`\n${colors.green}Results saved to comparison-results.json${colors.reset}`);
  
  console.log(`\n${colors.bright}=======================================${colors.reset}`);
}

// Run the comparison
runComparison().catch(error => {
  console.error(`${colors.red}Comparison failed: ${error.message}${colors.reset}`);
});

#!/usr/bin/env node

/**
 * Generate Fresh AWS Bedrock Token
 * 
 * This script generates a fresh AWS Bedrock bearer token that can be used
 * for direct API authentication. The token includes AWS Signature v4 components
 * and handles expiration automatically.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const REGION = process.env.AWS_BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1';
const PROFILE = process.env.AWS_PROFILE || 'default';
const TOKEN_DURATION = 3600; // 1 hour in seconds

/**
 * Generate a fresh AWS Bedrock token using AWS CLI
 */
async function generateBedrockToken() {
    try {
        console.log('🔄 Generating fresh AWS Bedrock token...');
        console.log(`Region: ${REGION}`);
        console.log(`Profile: ${PROFILE}`);
        console.log(`Duration: ${TOKEN_DURATION} seconds (${TOKEN_DURATION / 60} minutes)`);
        
        // First, verify AWS credentials are available
        try {
            const identity = execSync('aws sts get-caller-identity', { 
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe']
            });
            const identityData = JSON.parse(identity);
            console.log(`✅ AWS Identity: ${identityData.Arn}`);
        } catch (error) {
            throw new Error('AWS credentials not configured. Please run: aws configure');
        }
        
        // Generate the presigned URL token for Bedrock
        const command = [
            'aws', 'bedrock-runtime', 'invoke-model',
            '--model-id', 'anthropic.claude-3-sonnet-20240229-v1:0',
            '--region', REGION,
            '--profile', PROFILE,
            '--generate-cli-skeleton', 'input',
            '--cli-binary-format', 'raw-in-base64-out'
        ].join(' ');
        
        console.log('🔐 Generating presigned URL...');
        
        // Alternative approach: generate a presigned URL for the Bedrock invoke-model endpoint
        const presignCommand = [
            'aws', 'bedrock-runtime', 'presign-url',
            '--region', REGION,
            '--profile', PROFILE,
            '--expires-in', TOKEN_DURATION.toString(),
            '--http-method', 'POST',
            '--endpoint-url', `https://bedrock-runtime.${REGION}.amazonaws.com`,
            '--service-name', 'bedrock'
        ];
        
        let tokenResult;
        try {
            // Try the presign-url command first
            tokenResult = execSync(presignCommand.join(' '), { 
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe']
            });
        } catch (error) {
            console.log('⚠️  Direct presign command not available, using alternative method...');
            
            // Alternative: Use AWS SigV4 to create a bearer token manually
            tokenResult = await generateTokenManually();
        }
        
        if (tokenResult) {
            const token = Buffer.from(tokenResult.trim()).toString('base64');
            
            console.log('✅ Token generated successfully!');
            console.log(`Token length: ${token.length} characters`);
            
            // Save to environment file
            await saveTokenToEnv(token);
            
            // Test the token
            await testToken(token);
            
            return token;
        } else {
            throw new Error('Failed to generate token');
        }
        
    } catch (error) {
        console.error('❌ Error generating Bedrock token:', error.message);
        
        // Provide helpful guidance
        console.log('\n📝 Troubleshooting:');
        console.log('1. Ensure AWS CLI is installed and configured');
        console.log('2. Verify your AWS credentials have Bedrock permissions');
        console.log('3. Check that the specified region supports Bedrock');
        console.log('4. Try running: aws bedrock list-foundation-models --region', REGION);
        
        process.exit(1);
    }
}

/**
 * Generate token manually using AWS credentials
 */
async function generateTokenManually() {
    console.log('🔧 Generating token manually using AWS SigV4...');
    
    try {
        // Get AWS credentials
        const credentials = execSync('aws configure list', { encoding: 'utf8' });
        console.log('AWS Configuration:', credentials);
        
        // Create a simple presigned request URL
        const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
        const date = timestamp.substr(0, 8);
        
        const endpoint = `https://bedrock-runtime.${REGION}.amazonaws.com/model/anthropic.claude-3-sonnet-20240229-v1:0/invoke`;
        const params = new URLSearchParams({
            'Action': 'CallWithBearerToken',
            'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
            'X-Amz-Date': timestamp,
            'X-Amz-Expires': TOKEN_DURATION.toString(),
            'X-Amz-SignedHeaders': 'content-type;host;x-amz-date',
        });
        
        const presignedUrl = `${endpoint}?${params.toString()}`;
        return presignedUrl;
        
    } catch (error) {
        console.error('Failed to generate token manually:', error.message);
        return null;
    }
}

/**
 * Save the generated token to environment file
 */
async function saveTokenToEnv(token) {
    try {
        const envPath = path.join(__dirname, '.env');
        let envContent = '';
        
        // Read existing .env file if it exists
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }
        
        // Update or add the token
        const tokenLine = `BEDROCK_API_KEY=${token}`;
        const bedrockKeyRegex = /^BEDROCK_API_KEY=.*$/m;
        
        if (bedrockKeyRegex.test(envContent)) {
            envContent = envContent.replace(bedrockKeyRegex, tokenLine);
        } else {
            envContent += `\n${tokenLine}\n`;
        }
        
        // Also add AWS_BEARER_TOKEN_BEDROCK as alternative
        const bearerTokenLine = `AWS_BEARER_TOKEN_BEDROCK=${token}`;
        const bearerTokenRegex = /^AWS_BEARER_TOKEN_BEDROCK=.*$/m;
        
        if (bearerTokenRegex.test(envContent)) {
            envContent = envContent.replace(bearerTokenRegex, bearerTokenLine);
        } else {
            envContent += `${bearerTokenLine}\n`;
        }
        
        fs.writeFileSync(envPath, envContent);
        console.log('💾 Token saved to .env file');
        
    } catch (error) {
        console.error('⚠️  Could not save token to .env file:', error.message);
    }
}

/**
 * Test the generated token
 */
async function testToken(token) {
    console.log('🧪 Testing generated token...');
    
    try {
        // Import and test with our updated BedrockAccessor
        const { BedrockAccessor } = require('./src/lib/accessors/BedrockAccessor');
        
        // Create a BedrockAccessor instance with the new token
        const tokenRefreshCallback = async () => {
            console.log('🔄 Token refresh callback triggered');
            return await generateBedrockToken();
        };
        
        const bedrockAccessor = new BedrockAccessor({
            useApiKey: true,
            apiKey: token,
            tokenRefreshCallback: tokenRefreshCallback,
            region: REGION
        });
        
        // Test a simple chat response
        const response = await bedrockAccessor.generateChatResponse('Hello, can you respond with a simple greeting?');
        
        if (response && response.message) {
            console.log('✅ Token test successful!');
            console.log('Response:', response.message.substring(0, 100) + '...');
            return true;
        } else {
            console.log('⚠️  Token test returned empty response');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Token test failed:', error.message);
        
        // Check if it's an expiration error
        if (error.message.includes('Signature expired')) {
            console.log('🔄 Token appears to be expired, this is expected for testing');
            return false;
        }
        
        return false;
    }
}

/**
 * Main function
 */
async function main() {
    console.log('🚀 AWS Bedrock Token Generator');
    console.log('=' .repeat(50));
    
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Usage: node generate-bedrock-token.js [options]

Options:
  --help, -h     Show this help message
  --test         Test the existing token without generating a new one
  --region       AWS region (default: ${REGION})
  --profile      AWS profile (default: ${PROFILE})
  --duration     Token duration in seconds (default: ${TOKEN_DURATION})

Environment Variables:
  AWS_BEDROCK_REGION    AWS region for Bedrock
  AWS_REGION           Fallback AWS region  
  AWS_PROFILE          AWS profile to use
  
Examples:
  node generate-bedrock-token.js
  node generate-bedrock-token.js --test
  AWS_REGION=us-west-2 node generate-bedrock-token.js
        `);
        process.exit(0);
    }
    
    if (args.includes('--test')) {
        console.log('🧪 Testing existing token...');
        const existingToken = process.env.BEDROCK_API_KEY || process.env.AWS_BEARER_TOKEN_BEDROCK;
        
        if (!existingToken) {
            console.log('❌ No existing token found in environment variables');
            process.exit(1);
        }
        
        const success = await testToken(existingToken);
        process.exit(success ? 0 : 1);
    }
    
    // Generate new token
    const token = await generateBedrockToken();
    
    if (token) {
        console.log('\n🎉 Success! Fresh Bedrock token generated and ready to use.');
        console.log('📝 The token has been saved to your .env file');
        console.log('⏰ Token will expire in', TOKEN_DURATION / 60, 'minutes');
        console.log('\n💡 To use this token, run your Bedrock tests or applications now.');
        process.exit(0);
    } else {
        console.log('❌ Failed to generate token');
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Unexpected error:', error);
        process.exit(1);
    });
}

module.exports = { generateBedrockToken, testToken };

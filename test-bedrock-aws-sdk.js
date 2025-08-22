#!/usr/bin/env node

/**
 * Test AWS Bedrock using AWS SDK with IAM credentials
 * This demonstrates the correct way to authenticate with AWS Bedrock
 */

const axios = require('axios');

// Test using AWS SDK approach (recommended)
async function testBedrockAWSSDK() {
    console.log('\n🧪 TESTING AWS BEDROCK WITH AWS SDK (RECOMMENDED)');
    console.log('=' .repeat(60));

    try {
        // Import AWS SDK v3 for Bedrock
        const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
        const { NodeHttpHandler } = require('@smithy/node-http-handler');

        // Configure HTTP handler to use HTTP/1.1 to avoid HTTP2 protocol errors
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
                rejectUnauthorized: true,
            },
        });

        const region = process.env.AWS_BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1';
        const modelId = 'anthropic.claude-3-5-sonnet-20240620-v1:0';

        console.log(`Region: ${region}`);
        console.log(`Model: ${modelId}`);
        console.log('Using AWS SDK with SSO credentials...');

        // Import the credential providers to explicitly handle SSO
        const { fromSSO, fromNodeProviderChain } = require('@aws-sdk/credential-providers');

        // Create credential chain that includes SSO
        let credentials;
        try {
            // Try SSO credentials first (for your setup)
            credentials = fromNodeProviderChain({
                profile: process.env.AWS_PROFILE || '130799455554_VSPPowerUserNonprod'
            });
        } catch (error) {
            console.log('SSO credential chain not available, using default...');
            credentials = undefined; // Let SDK auto-discover
        }

        // Create Bedrock client with proper credential chain
        const client = new BedrockRuntimeClient({
            region: region,
            requestHandler: httpHandler,
            maxAttempts: 3,
            credentials: credentials,
        });

        const requestBody = {
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 1024,
            temperature: 0.7,
            messages: [
                {
                    role: 'user',
                    content: 'What are the main advantages of using AWS Bedrock for AI applications? Please provide a brief response.'
                }
            ]
        };

        console.log('Sending request to AWS Bedrock...');
        const startTime = Date.now();

        const command = new InvokeModelCommand({
            modelId: modelId,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify(requestBody)
        });

        const response = await client.send(command);
        const endTime = Date.now();
        const latency = endTime - startTime;

        // Parse the response
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        const messageContent = responseBody.content?.[0]?.text || '';

        console.log(`✅ SUCCESS! Response received in ${latency}ms`);
        console.log('\nRESPONSE:');
        console.log(messageContent);

        if (responseBody.usage) {
            console.log('\nUSAGE STATISTICS:');
            console.log(`Input tokens: ${responseBody.usage.input_tokens}`);
            console.log(`Output tokens: ${responseBody.usage.output_tokens}`);
            console.log(`Total tokens: ${responseBody.usage.total_tokens}`);
        }

        return {
            success: true,
            latency: latency,
            response: messageContent,
            usage: responseBody.usage
        };

    } catch (error) {
        console.error('❌ AWS Bedrock error:', error.message);
        
        // Provide specific guidance based on error type
        if (error.name === 'UnrecognizedClientException') {
            console.log('\n💡 SOLUTION: Configure AWS credentials');
            console.log('Run: aws configure sso');
            console.log('Or set environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY');
        } else if (error.name === 'AccessDeniedException') {
            console.log('\n💡 SOLUTION: Check IAM permissions');
            console.log('Ensure your AWS user/role has bedrock:InvokeModel permissions');
        } else if (error.name === 'ResourceNotFoundException') {
            console.log('\n💡 SOLUTION: Check model availability');
            console.log('The model may not be enabled in your region');
        } else if (error.message.includes('HTTP2')) {
            console.log('\n💡 SOLUTION: HTTP/2 protocol issue');
            console.log('Our HTTP/1.1 handler should fix this, but check your network setup');
        }

        return {
            success: false,
            error: error.message,
            errorType: error.name
        };
    }
}

// Main execution
async function main() {
    console.log('🚀 AWS BEDROCK AUTHENTICATION TEST');
    console.log('Testing the correct way to authenticate with AWS Bedrock');
    
    // Check AWS credentials are available
    try {
        const { execSync } = require('child_process');
        const identity = execSync('aws sts get-caller-identity', { 
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        });
        const identityData = JSON.parse(identity);
        console.log(`✅ AWS Identity: ${identityData.Arn}`);
    } catch (error) {
        console.log('⚠️  AWS credentials not configured or AWS CLI not available');
        console.log('Please run: aws configure sso');
    }

    // Test AWS SDK approach
    const result = await testBedrockAWSSDK();
    
    console.log('\n' + '=' .repeat(60));
    console.log('FINAL RESULTS');
    console.log('=' .repeat(60));
    
    if (result.success) {
        console.log('✅ AWS Bedrock authentication: SUCCESS');
        console.log(`⚡ Response time: ${result.latency}ms`);
        console.log('🎯 Recommended approach: Use AWS SDK with IAM credentials');
    } else {
        console.log('❌ AWS Bedrock authentication: FAILED');
        console.log(`Error: ${result.error}`);
        console.log('\n📚 Key Findings:');
        console.log('- AWS Bedrock requires proper IAM authentication');
        console.log('- Custom API keys/bearer tokens are not supported');
        console.log('- Use AWS SDK with SSO or environment credentials');
    }
}

// Run the test
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Unexpected error:', error);
        process.exit(1);
    });
}

module.exports = { testBedrockAWSSDK };

#!/usr/bin/env node

/**
 * Test different AWS credential approaches for Bedrock
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { NodeHttpHandler } = require('@smithy/node-http-handler');
const { fromIni } = require('@aws-sdk/credential-provider-ini');

// Configure HTTP handler
const httpHandler = new NodeHttpHandler({
    connectionTimeout: 60000,
    socketTimeout: 60000,
    httpAgent: { maxSockets: 50, keepAlive: true },
    httpsAgent: { maxSockets: 50, keepAlive: true, rejectUnauthorized: true },
});

const region = 'us-east-1';
const modelId = 'anthropic.claude-3-5-sonnet-20240620-v1:0';

const requestBody = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 500,
    temperature: 0.7,
    messages: [{
        role: 'user',
        content: 'Hello! Please respond with a brief greeting to confirm AWS Bedrock is working.'
    }]
};

/**
 * Test Method 1: Environment Variables
 */
async function testEnvCredentials() {
    console.log('\n🧪 METHOD 1: Environment Variables');
    console.log('=' .repeat(50));
    
    try {
        // Set environment variables from current AWS profile
        process.env.AWS_ACCESS_KEY_ID = 'ASIAR45CBJVBIPC7M4VA';
        process.env.AWS_SECRET_ACCESS_KEY = 'Swv0pdShgiWti6m6JV2apQsQYb4PykjlUyiRi8Y8';
        process.env.AWS_SESSION_TOKEN = 'IQoJb3JpZ2luX2VjENX//////////wEaCXVzLXdlc3QtMiJHMEUCIAkRI6CpkqPRy9wkUUKyqbVWbepZ2KBpgc6wwnv4EBmhAiEA/MKG3Zj5AF24kh6azZ9TzyP8vwGpnMY3MlKqrl9OGWYqkQMI3v//////////ARAAGgwxMzA3OTk0NTU1NTQiDFkAS9ocoqiaqWZeeirlAjsDuCqTBPP/+uVvfPm4azmWe1I8ZTqyBHlCZAmGI7D2aIl40whb+O6ydDI5bR5HLoxHpChmvFha2kUs8ERyEF1UTKlYj6LQVMLmM+7eEBqhYfYHiiWWi/HfpwxeYDmHAh+7u1jVDp2p28OPcylSvLhILIK3P5ctJBa8q6wQNCe4ITFSQ/fqmW52PXOJLejbH3VqKV2GqRVBXPkeID6CEQWBKjntGb4ZHX5+HQemNrj7hSHuK92CygS4mr8uzisKO55EFeWonSQCZPEwzextEP5Rb4GI1NwX5PgLNa8franFTcDIVKY3/L3LRgg6PtFvHvfWEFrPXoqeoJRaVbxUDPGxPsFrlFX3Gyc3Bhy5IPPHx2GLOYdYyPoArn97PleXgJVhk/jUQO4zrX8Hez04qxugeryWrjAErDl7pBt+xvfDpV1+BPmaPIaxWAZUJhDyqy7Bm213HUDCs1Z4iMGql5+uWV0z/zC298XDBjqmATE/VO8ECSyx+c97O3jl38HopAulcRD5kqWtH4rYeeR2e4XcjcrbWku/s1I+YKqjXXt+KoEFqX373XTqwzmBEoDUKqL/ZLc6QdLrMZHkkh/I1NGLiNe9DhyfnA25QPHpmrfkjfaaE34l97TuZMN2tMOha5fiYi6tYkwI43/j30jwP8HeYJMN2nvljIqWXymR9GDwXoB0x4LPuU5YwdejYadOm4Y8E9o=';
        
        console.log('✅ Environment variables set');
        
        const client = new BedrockRuntimeClient({
            region,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                sessionToken: process.env.AWS_SESSION_TOKEN
            },
            requestHandler: httpHandler
        });

        console.log('Sending request...');
        const startTime = Date.now();

        const command = new InvokeModelCommand({
            modelId: modelId,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify(requestBody)
        });

        const response = await client.send(command);
        const latency = Date.now() - startTime;
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        
        console.log(`✅ SUCCESS! Response in ${latency}ms`);
        console.log(`Response: ${responseBody.content?.[0]?.text?.substring(0, 100)}...`);
        
        return { success: true, method: 'Environment Variables', latency };
        
    } catch (error) {
        console.log(`❌ FAILED: ${error.message}`);
        return { success: false, method: 'Environment Variables', error: error.message };
    }
}

/**
 * Test Method 2: fromIni with profile
 */
async function testFromIniCredentials() {
    console.log('\n🧪 METHOD 2: fromIni with Profile');
    console.log('=' .repeat(50));
    
    try {
        console.log('Using profile: 130799455554_VSPPowerUserNonprod');
        
        const client = new BedrockRuntimeClient({
            region,
            credentials: fromIni({ profile: '130799455554_VSPPowerUserNonprod' }),
            requestHandler: httpHandler
        });

        console.log('Sending request...');
        const startTime = Date.now();

        const command = new InvokeModelCommand({
            modelId: modelId,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify(requestBody)
        });

        const response = await client.send(command);
        const latency = Date.now() - startTime;
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        
        console.log(`✅ SUCCESS! Response in ${latency}ms`);
        console.log(`Response: ${responseBody.content?.[0]?.text?.substring(0, 100)}...`);
        
        return { success: true, method: 'fromIni Profile', latency };
        
    } catch (error) {
        console.log(`❌ FAILED: ${error.message}`);
        return { success: false, method: 'fromIni Profile', error: error.message };
    }
}

/**
 * Test Method 3: Auto-discovery (default)
 */
async function testAutoDiscovery() {
    console.log('\n🧪 METHOD 3: Auto-discovery');
    console.log('=' .repeat(50));
    
    try {
        // Set the profile in environment
        process.env.AWS_PROFILE = '130799455554_VSPPowerUserNonprod';
        
        const client = new BedrockRuntimeClient({
            region,
            requestHandler: httpHandler
            // No explicit credentials - let SDK auto-discover
        });

        console.log('Sending request...');
        const startTime = Date.now();

        const command = new InvokeModelCommand({
            modelId: modelId,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify(requestBody)
        });

        const response = await client.send(command);
        const latency = Date.now() - startTime;
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        
        console.log(`✅ SUCCESS! Response in ${latency}ms`);
        console.log(`Response: ${responseBody.content?.[0]?.text?.substring(0, 100)}...`);
        
        return { success: true, method: 'Auto-discovery', latency };
        
    } catch (error) {
        console.log(`❌ FAILED: ${error.message}`);
        return { success: false, method: 'Auto-discovery', error: error.message };
    }
}

/**
 * Main test execution
 */
async function main() {
    console.log('🚀 AWS BEDROCK CREDENTIAL TESTING');
    console.log(`Region: ${region}`);
    console.log(`Model: ${modelId}`);

    const results = [];
    
    // Test all methods
    results.push(await testEnvCredentials());
    results.push(await testFromIniCredentials());
    results.push(await testAutoDiscovery());
    
    // Summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 RESULTS SUMMARY');
    console.log('=' .repeat(60));
    
    results.forEach((result, index) => {
        const status = result.success ? '✅' : '❌';
        const details = result.success 
            ? `${result.latency}ms` 
            : result.error.substring(0, 50) + '...';
        console.log(`${status} Method ${index + 1}: ${result.method} - ${details}`);
    });
    
    const workingMethods = results.filter(r => r.success);
    if (workingMethods.length > 0) {
        console.log(`\n🎯 RECOMMENDED: Use ${workingMethods[0].method}`);
        console.log('✅ AWS Bedrock authentication is working!');
        return workingMethods[0];
    } else {
        console.log('\n❌ All credential methods failed');
        return null;
    }
}

// Run the tests
if (require.main === module) {
    main().then(result => {
        process.exit(result ? 0 : 1);
    }).catch(error => {
        console.error('💥 Unexpected error:', error);
        process.exit(1);
    });
}

module.exports = { testEnvCredentials, testFromIniCredentials, testAutoDiscovery };

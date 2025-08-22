#!/usr/bin/env node

/**
 * Direct test of BedrockAccessor to verify AWS SDK authentication
 */

// Set environment variables
process.env.AWS_ACCESS_KEY_ID = "ASIAR45CBJVBIPC7M4VA";
process.env.AWS_SECRET_ACCESS_KEY = "Swv0pdShgiWti6m6JV2apQsQYb4PykjlUyiRi8Y8";
process.env.AWS_SESSION_TOKEN = "IQoJb3JpZ2luX2VjENX//////////wEaCXVzLXdlc3QtMiJHMEUCIAkRI6CpkqPRy9wkUUKyqbVWbepZ2KBpgc6wwnv4EBmhAiEA/MKG3Zj5AF24kh6azZ9TzyP8vwGpnMY3MlKqrl9OGWYqkQMI3v//////////ARAAGgwxMzA3OTk0NTU1NTQiDFkAS9ocoqiaqWZeeirlAjsDuCqTBPP/+uVvfPm4azmWe1I8ZTqyBHlCZAmGI7D2aIl40whb+O6ydDI5bR5HLoxHpChmvFha2kUs8ERyEF1UTKlYj6LQVMLmM+7eEBqhYfYHiiWWi/HfpwxeYDmHAh+7u1jVDp2p28OPcylSvLhILIK3P5ctJBa8q6wQNCe4ITFSQ/fqmW52PXOJLejbH3VqKV2GqRVBXPkeID6CEQWBKjntGb4ZHX5+HQemNrj7hSHuK92CygS4mr8uzisKO55EFeWonSQCZPEwzextEP5Rb4GI1NwX5PgLNa8franFTcDIVKY3/L3LRgg6PtFvHvfWEFrPXoqeoJRaVbxUDPGxPsFrlFX3Gyc3Bhy5IPPHx2GLOYdYyPoArn97PleXgJVhk/jUQO4zrX8Hez04qxugeryWrjAErDl7pBt+xvfDpV1+BPmaPIaxWAZUJhDyqy7Bm213HUDCs1Z4iMGql5+uWV0z/zC378XDBjqmATE/VO8ECSyx+c97O3jl38HopAulcRD5kqWtH4rYeeR2e4XcjcrbWku/s1I+YKqjXXt+KoEFqX373XTqwzmBEoDUKqL/ZLc6QdLrMZHkkh/I1NGLiNe9DhyfnA25QPHpmrfkjfaaE34l97TuZMN2tMOha5fiYi6tYkwI43/j30jwP8HeYJMN2nvljIqWXymR9GDwXoB0x4LPuU5YwdejYadOm4Y8E9o=";
process.env.AWS_BEDROCK_REGION = "us-east-1";
process.env.BEDROCK_MODEL_ID = "anthropic.claude-3-5-sonnet-20240620-v1:0";

// Clear any API key variables
delete process.env.BEDROCK_API_KEY;
delete process.env.AWS_BEARER_TOKEN_BEDROCK;

console.log('🧪 DIRECT BEDROCK ACCESSOR TEST');
console.log('================================');
console.log(`AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'NOT SET'}`);
console.log(`AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET'}`);
console.log(`AWS_SESSION_TOKEN: ${process.env.AWS_SESSION_TOKEN ? 'SET' : 'NOT SET'}`);
console.log(`BEDROCK_API_KEY: ${process.env.BEDROCK_API_KEY ? 'SET' : 'NOT SET'}`);
console.log(`AWS_BEARER_TOKEN_BEDROCK: ${process.env.AWS_BEARER_TOKEN_BEDROCK ? 'SET' : 'NOT SET'}`);

async function testBedrockAccessor() {
    try {
        // Import the BedrockAccessor (compile TypeScript first)
        const { BedrockAccessor } = await import('./src/lib/accessors/BedrockAccessor.js');
        
        console.log('\n🔧 Creating BedrockAccessor instance...');
        
        // Create a new instance with explicit AWS SDK configuration
        const bedrockAccessor = new BedrockAccessor({
            region: 'us-east-1',
            modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
            useApiKey: false, // Explicitly disable API key mode
            temperature: 0.7,
            maxTokens: 500
        });
        
        console.log('\n🚀 Testing generateChatResponse...');
        
        const response = await bedrockAccessor.generateChatResponse(
            'Hello! Please confirm that AWS Bedrock is working properly.',
            'You are a helpful AI assistant.',
            'test-user',
            'test-tenant'
        );
        
        console.log('\n✅ SUCCESS!');
        console.log('Response:', response.message);
        console.log('Confidence:', response.confidence);
        console.log('Processing time:', response.processingTime, 'ms');
        
        if (response.metadata) {
            console.log('Usage stats:', response.metadata);
        }
        
        return { success: true, response };
        
    } catch (error) {
        console.log('\n❌ FAILED!');
        console.log('Error name:', error.name);
        console.log('Error message:', error.message);
        console.log('Error code:', error.code);
        console.log('Status code:', error.$metadata?.httpStatusCode);
        
        if (error.message?.includes('Invalid API Key format')) {
            console.log('\n🔍 ANALYSIS: Still using API key mode despite configuration');
            console.log('This suggests the useApiKey parameter is not being respected');
        } else if (error.message?.includes('UnauthorizedException')) {
            console.log('\n🔍 ANALYSIS: AWS credentials issue');
            console.log('Check credentials and permissions');
        } else if (error.message?.includes('ValidationException')) {
            console.log('\n🔍 ANALYSIS: Model or request validation issue');
            console.log('Check model ID and region configuration');
        }
        
        return { success: false, error };
    }
}

// Test with TypeScript compilation
async function testWithTsNode() {
    try {
        console.log('\n📦 Loading with ts-node...');
        require('ts-node/register');
        return await testBedrockAccessor();
    } catch (error) {
        console.log('❌ ts-node loading failed:', error.message);
        return { success: false, error };
    }
}

// Main execution
(async () => {
    console.log('\nStarting BedrockAccessor direct test...\n');
    
    const result = await testWithTsNode();
    
    console.log('\n' + '='.repeat(50));
    console.log('FINAL RESULT');
    console.log('='.repeat(50));
    
    if (result.success) {
        console.log('✅ BedrockAccessor is working correctly!');
        console.log('✅ AWS SDK authentication successful');
        process.exit(0);
    } else {
        console.log('❌ BedrockAccessor test failed');
        console.log('❌ Authentication or configuration issue detected');
        process.exit(1);
    }
})();

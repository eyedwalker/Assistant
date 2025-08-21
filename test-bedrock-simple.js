const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

async function testBedrockConnection() {
  try {
    console.log('Testing AWS Bedrock connection...\n');
    
    // Remove NODE_TLS_REJECT_UNAUTHORIZED for this test
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    
    const client = new BedrockRuntimeClient({
      region: process.env.AWS_BEDROCK_REGION || 'us-east-1',
      credentials: process.env.AWS_ACCESS_KEY_ID ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN,
      } : undefined,
      maxAttempts: 3,
      requestHandler: {
        requestTimeout: 30000,
        httpsAgent: {
          maxSockets: 25,
          keepAlive: true
        }
      }
    });

    // Try the actual model invocation with minimal payload
    
    const invokeCommand = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 50,
        messages: [{
          role: "user",
          content: "Say 'Hello'"
        }]
      })
    });

    console.log('\nInvoking Claude model with test message...');
    const invokeResponse = await client.send(invokeCommand);
    
    const responseBody = JSON.parse(new TextDecoder().decode(invokeResponse.body));
    console.log('\n✅ Success! Bedrock is working!');
    console.log('Response:', responseBody.content[0].text);
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Error connecting to Bedrock:');
    console.error('Type:', error.constructor.name);
    console.error('Name:', error.name);
    console.error('Message:', error.message);
    
    if (error.$metadata) {
      console.error('\nAWS Error Metadata:');
      console.error('Status:', error.$metadata.httpStatusCode);
      console.error('Request ID:', error.$metadata.requestId);
      console.error('Error Code:', error.$metadata.errorCode);
      console.error('Error Type:', error.$metadata.errorType);
    }
    
    if (error.name === 'ExpiredTokenException' || error.message?.includes('expired')) {
      console.error('\n🔄 AWS credentials expired. Refresh with: aws sso login');
    } else if (error.message?.includes('ENOTFOUND') || error.message?.includes('ETIMEDOUT')) {
      console.error('\n🌐 Network issue. Check your internet connection and proxy settings.');
    } else if (error.message?.includes('ERR_HTTP2')) {
      console.error('\n⚠️ HTTP2 protocol issue detected.');
      console.error('This might be caused by proxy or firewall settings.');
    }
    
    return false;
  }
}

// Load environment variables
require('dotenv').config();

testBedrockConnection().then(success => {
  process.exit(success ? 0 : 1);
});

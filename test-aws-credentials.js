const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

async function testAWSCredentials() {
  try {
    console.log('Testing AWS Bedrock credentials...');
    console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'Set' : 'Not set');
    console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? 'Set' : 'Not set');
    console.log('AWS_SESSION_TOKEN:', process.env.AWS_SESSION_TOKEN ? 'Set' : 'Not set');
    console.log('AWS_BEDROCK_REGION:', process.env.AWS_BEDROCK_REGION || 'us-east-1');
    console.log('BEDROCK_MODEL_ID:', process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0');
    
    const client = new BedrockRuntimeClient({
      region: process.env.AWS_BEDROCK_REGION || 'us-east-1',
      credentials: process.env.AWS_ACCESS_KEY_ID ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN,
      } : undefined,
    });

    const command = new InvokeModelCommand({
      modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 100,
        messages: [{
          role: "user",
          content: "Hello, this is a test. Please respond with a short greeting."
        }],
        temperature: 0.7
      })
    });

    console.log('\nSending test request to Bedrock...');
    const response = await client.send(command);
    
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    console.log('\n✅ Success! Response from Bedrock:');
    console.log(responseBody.content[0].text);
    
  } catch (error) {
    console.error('\n❌ Error testing AWS credentials:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.Code || error.code);
    console.error('Status code:', error.$metadata?.httpStatusCode);
    console.error('Request ID:', error.$metadata?.requestId);
    
    if (error.name === 'ExpiredTokenException' || error.message?.includes('expired')) {
      console.error('\n🔄 Your AWS credentials have expired. Please refresh them using:');
      console.error('aws sso login --profile <your-profile>');
    } else if (error.name === 'UnrecognizedClientException') {
      console.error('\n🔑 Invalid AWS credentials. Check your .env file.');
    } else if (error.name === 'ResourceNotFoundException') {
      console.error('\n📦 Model not found or not enabled in your region.');
      console.error('Make sure the model is enabled in AWS Bedrock console.');
    } else if (error.name === 'ValidationException') {
      console.error('\n⚠️ Invalid request format or model ID.');
    }
  }
}

// Load environment variables
require('dotenv').config();

testAWSCredentials();

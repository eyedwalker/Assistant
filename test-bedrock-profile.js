// Test AWS Bedrock using AWS profile directly
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { fromIni } = require('@aws-sdk/credential-providers');
const { NodeHttpHandler } = require('@smithy/node-http-handler');

async function testBedrock() {
  console.log('========================================');
  console.log('AWS Bedrock Test with Profile');
  console.log('========================================\n');
  
  const region = 'us-east-1';
  const modelId = 'anthropic.claude-3-5-sonnet-20240620-v1:0';
  const profile = '130799455554_VSPPowerUserNonprod';
  
  console.log(`Using AWS Profile: ${profile}`);
  console.log(`Region: ${region}`);
  console.log(`Model: ${modelId}\n`);
  
  try {
    // Create HTTP/1.1 handler
    const httpHandler = new NodeHttpHandler({
      connectionTimeout: 60000,
      socketTimeout: 60000,
      httpAgent: {
        maxSockets: 50,
        keepAlive: true
      },
      httpsAgent: {
        maxSockets: 50,
        keepAlive: true,
        rejectUnauthorized: true
      }
    });
    
    // Initialize client with profile credentials
    const client = new BedrockRuntimeClient({
      region: region,
      credentials: fromIni({ profile: profile }),
      requestHandler: httpHandler,
      maxAttempts: 3
    });
    
    // Test message
    const requestBody = {
      anthropic_version: 'bedrock-2023-05-31',
      messages: [
        {
          role: 'user',
          content: 'Hello! Please respond with a simple greeting to confirm the connection works.'
        }
      ],
      max_tokens: 100,
      temperature: 0.7
    };
    
    console.log('📤 Sending test message to Bedrock...\n');
    
    const command = new InvokeModelCommand({
      modelId: modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody)
    });
    
    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    console.log('✅ SUCCESS! Response from Bedrock:');
    console.log('========================================');
    console.log(responseBody.content[0].text);
    console.log('========================================');
    console.log('\nUsage:', responseBody.usage);
    console.log('\n✅ AWS Bedrock integration is working correctly!');
    
  } catch (error) {
    console.error('❌ Error calling AWS Bedrock:', error.message);
    if (error.$metadata) {
      console.error('  - HTTP status:', error.$metadata.httpStatusCode);
      console.error('  - Request ID:', error.$metadata.requestId);
    }
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run the test
testBedrock().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

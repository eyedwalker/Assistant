/**
 * Configures the AWS infrastructure values in .env file
 * and provides test values for OpenSearch and API Gateway
 */

// Import required modules
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Sample infrastructure values for testing
// Note: These are placeholder values for testing purposes
const awsInfraConfig = {
  AWS_S3_BUCKET: 'eyecare-ai-content-dev-demo',
  AWS_OPENSEARCH_ENDPOINT: 'https://demo-eyecare-ai-search.us-east-2.es.amazonaws.com',
  AWS_API_ENDPOINT: 'https://demo1234.execute-api.us-east-2.amazonaws.com/dev',
  OPENSEARCH_INDEX_NAME: 'ai-assistant-rag',
  USE_BEDROCK: 'true',
  BEDROCK_MODEL_ID: 'anthropic.claude-3-5-sonnet-20240620-v1:0'
};

// Update .env file with infrastructure values
console.log('🔧 Configuring AWS infrastructure values in .env file...');

try {
  // Read the current .env file
  const envPath = path.join(process.cwd(), '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Update each infrastructure value
  Object.entries(awsInfraConfig).forEach(([key, value]) => {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    
    if (envContent.match(regex)) {
      // Update existing value
      envContent = envContent.replace(regex, `${key}=${value}`);
      console.log(`✅ Updated ${key}=${value}`);
    } else {
      // Add new value
      envContent += `\n${key}=${value}`;
      console.log(`➕ Added ${key}=${value}`);
    }
  });
  
  // Write updated content back to .env file
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Successfully updated .env file with AWS infrastructure values');
  
  // Output test script instructions
  console.log('\n🧪 To test the AWS integration:');
  console.log('1. Run: ./aws/run-aws-tests.sh');
  console.log('2. Run: node test-bedrock-fallback.js');
  console.log('3. Check system status: curl http://localhost:3001/api/system/status');
  console.log('\n💡 Note: The AWS infrastructure values are simulated for testing.');
  console.log('   Update them with your actual deployed infrastructure values.');
  
} catch (error) {
  console.error('❌ Error updating .env file:', error);
}

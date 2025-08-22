/**
 * Extract AWS credentials directly from AWS CLI credentials file
 * and save them as environment variables that can be used by other scripts
 */

const fs = require('fs');
const { execSync } = require('child_process');
const os = require('os');
const path = require('path');

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
};

const AWS_PROFILE = '130799455554_VSPPowerUserNonprod';
const CREDENTIALS_PATH = path.join(os.homedir(), '.aws', 'credentials');

function extractCredentials() {
  console.log(`${colors.bright}Extracting AWS credentials directly from AWS CLI${colors.reset}`);

  try {
    // Check if credentials file exists
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      console.error(`${colors.red}AWS credentials file not found at ${CREDENTIALS_PATH}${colors.reset}`);
      return null;
    }

    // Read credentials file
    const credentialsFile = fs.readFileSync(CREDENTIALS_PATH, 'utf8');
    
    // Find the profile section
    const profileRegex = new RegExp(`\\[${AWS_PROFILE}\\]([^\\[]+)`, 'g');
    const profileMatch = profileRegex.exec(credentialsFile);
    
    if (!profileMatch || !profileMatch[1]) {
      console.error(`${colors.red}Profile ${AWS_PROFILE} not found in credentials file${colors.reset}`);
      return null;
    }
    
    const profileSection = profileMatch[1];
    
    // Extract key values
    const accessKeyMatch = /aws_access_key_id\s*=\s*([^\s]+)/.exec(profileSection);
    const secretKeyMatch = /aws_secret_access_key\s*=\s*([^\s]+)/.exec(profileSection);
    const sessionTokenMatch = /aws_session_token\s*=\s*([^\n]+)/.exec(profileSection);
    
    if (!accessKeyMatch || !secretKeyMatch) {
      console.error(`${colors.red}Access key or secret key not found in profile${colors.reset}`);
      return null;
    }
    
    const credentials = {
      accessKeyId: accessKeyMatch[1],
      secretAccessKey: secretKeyMatch[1],
      sessionToken: sessionTokenMatch ? sessionTokenMatch[1] : undefined,
      region: getAwsRegion(),
    };
    
    console.log(`${colors.green}Successfully extracted AWS credentials${colors.reset}`);
    console.log(`${colors.dim}Access Key: ${credentials.accessKeyId.substring(0, 5)}...${colors.reset}`);
    console.log(`${colors.dim}Region: ${credentials.region}${colors.reset}`);
    
    return credentials;
  } catch (error) {
    console.error(`${colors.red}Error extracting AWS credentials: ${error.message}${colors.reset}`);
    return null;
  }
}

function getAwsRegion() {
  try {
    const regionOutput = execSync(`aws configure get region --profile ${AWS_PROFILE}`, { encoding: 'utf8' });
    return regionOutput.trim() || 'us-east-2'; // Default to us-east-2 if not found
  } catch (error) {
    console.error(`${colors.yellow}Warning: Could not determine AWS region, using default us-east-2${colors.reset}`);
    return 'us-east-2';
  }
}

function exportToEnv(credentials) {
  if (!credentials) return false;
  
  const envContent = `AWS_ACCESS_KEY_ID=${credentials.accessKeyId}
AWS_SECRET_ACCESS_KEY=${credentials.secretAccessKey}
${credentials.sessionToken ? `AWS_SESSION_TOKEN=${credentials.sessionToken}` : ''}
AWS_REGION=${credentials.region}
`;
  
  fs.writeFileSync('.aws-extracted-env', envContent);
  console.log(`${colors.green}Credentials exported to .aws-extracted-env${colors.reset}`);
  console.log(`${colors.bright}Run 'source .aws-extracted-env' to load them in your current shell${colors.reset}`);
  
  // Also create a JS module that can be required
  const jsModuleContent = `module.exports = {
  accessKeyId: '${credentials.accessKeyId}',
  secretAccessKey: '${credentials.secretAccessKey}',
  ${credentials.sessionToken ? `sessionToken: '${credentials.sessionToken}',` : ''}
  region: '${credentials.region}'
};`;
  
  fs.writeFileSync('.aws-credentials.js', jsModuleContent);
  console.log(`${colors.green}Credentials exported as JS module to .aws-credentials.js${colors.reset}`);
  
  return true;
}

// Main
const credentials = extractCredentials();
if (credentials) {
  exportToEnv(credentials);
}

module.exports = credentials;

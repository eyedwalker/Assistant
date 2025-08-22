
#!/usr/bin/env node

/**
 * Wrapper script to refresh AWS SSO credentials and invoke AWS Bedrock
 */

const { execSync } = require('child_process');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { fromIni } = require('@aws-sdk/credential-provider-ini');
const { NodeHttpHandler } = require('@smithy/node-http-handler');


const yargs = require('yargs');
const argv = yargs
    .option('profile', {
        alias: 'p',
        description: 'AWS SSO profile name',
        type: 'string',
        default: '130799455554_VSPPowerUserNonprod'
    })
    .option('region', {
        alias: 'r',
        description: 'AWS region',
        type: 'string',
        default: 'us-east-1'
    })
    .option('model', {
        alias: 'm',
        description: 'Bedrock model ID',
        type: 'string',
        default: 'anthropic.claude-3-5-sonnet-20240620-v1:0'
    })
    .option('prompt', {
        alias: 'q',
        description: 'Prompt text to send to the model',
        type: 'string',
        default: 'What are the main advantages of using AWS Bedrock for AI applications?'
    })
    .help()
    .alias('help', 'h')
    .argv;

const profile = argv.profile;
const region = argv.region;
const modelId = argv.model;
const promptText = argv.prompt;

console.log(`🎯 Configuration:`);
console.log(`Profile: ${profile}`);
console.log(`Region: ${region}`);
console.log(`Model: ${modelId}`);
console.log(`Prompt: ${promptText.substring(0, 50)}...\n`);

async function refreshSSOCredentials() {
    try {
        console.log(`🔄 Refreshing AWS SSO credentials for profile: ${profile}`);
        execSync(`aws sso login --profile ${profile}`, { stdio: 'inherit' });
        console.log('✅ SSO login successful');
    } catch (error) {
        console.error('❌ Failed to refresh SSO credentials:', error.message);
        process.exit(1);
    }
}

async function invokeBedrock() {
    try {
        const httpHandler = new NodeHttpHandler({
            connectionTimeout: 60000,
            socketTimeout: 60000,
            httpAgent: { maxSockets: 50, keepAlive: true },
            httpsAgent: { maxSockets: 50, keepAlive: true, rejectUnauthorized: true }
        });

        const client = new BedrockRuntimeClient({
            region,
            credentials: fromIni({ profile }),
            requestHandler: httpHandler
        });

        const requestBody = {
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 1024,
            temperature: 0.7,
            messages: [
                {
                    role: 'user',
                    content: promptText
                }
            ]
        };

        console.log('🚀 Sending request to AWS Bedrock...');
        const startTime = Date.now();

        const command = new InvokeModelCommand({
            modelId,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify(requestBody)
        });

        const response = await client.send(command);
        const endTime = Date.now();
        const latency = endTime - startTime;

        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        const messageContent = responseBody.content?.[0]?.text || '';

        console.log(`✅ Response received in ${latency}ms`);
        console.log('\n📝 RESPONSE:');
        console.log(messageContent);

        if (responseBody.usage) {
            console.log('\n📊 USAGE:');
            console.log(`Input tokens: ${responseBody.usage.input_tokens}`);
            console.log(`Output tokens: ${responseBody.usage.output_tokens}`);
        }

    } catch (error) {
        console.error('❌ Bedrock invocation failed:', error.message);
        
        if (error.message.includes('security token')) {
            console.log('\n💡 TROUBLESHOOTING:');
            console.log('- Try refreshing SSO credentials: aws sso login --profile ' + profile);
            console.log('- Verify your profile has Bedrock permissions');
            console.log('- Check if your SSO session has expired');
        }
        
        process.exit(1);
    }
}

(async () => {
    console.log('🚀 AWS BEDROCK CLI WRAPPER');
    console.log('=' + '='.repeat(30));
    
    try {
        // Check if we should skip SSO refresh
        const skipSSO = process.argv.includes('--skip-sso');
        
        if (!skipSSO) {
            await refreshSSOCredentials();
        } else {
            console.log('⏭️  Skipping SSO refresh (using existing credentials)');
        }
        
        await invokeBedrock();
        
        console.log('\n✅ SUCCESS! Bedrock CLI wrapper completed successfully.');
    } catch (error) {
        console.error('\n💥 FATAL ERROR:', error.message);
        process.exit(1);
    }
})();

const { BedrockClient, ListFoundationModelsCommand } = require('@aws-sdk/client-bedrock');

const bedrockClient = new BedrockClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'ASIAR45CBJVBAWDNPNAN',
    secretAccessKey: 'sDQ2Cgx+EXF82zuOJ81N8LN9QsfvmYuWbVKe73l0',
    sessionToken: 'IQoJb3JpZ2luX2VjEI7//////////wEaCXVzLXdlc3QtMiJGMEQCH29+vJghZthgPhTf7mmXeZtsSOwXNs0kNV9OXPAKCGoCIQC2CLn2ewYLqkjKe0Pv1aFkRA/VcBbh4SXk53OTXRy/zyqRAwjX//////////8BEAAaDDEzMDc5OTQ1NTU1NCIMTvbWf1ZefcWlmht2KuUCUxq1tvZeW6ld3x1IZhTCvZNUkUR1guuSTwuNWvglmul0iKu8UANJ2rgkpAKWr8YJ+cxxqMC8stynLTcAzNS/5PeiWXlyDczpBlYi/UvOFByDQ6vZIEKstGl/gZMrKbEewQi7S0NK6TqwM/f0+CGAfWVZggDVF5Vslxn1v0hRf/r9gcx/7emj5OG7+KsAzucK4f7a2ZmmNA1xRKyHsyEhrCN+dUdkjLWk0knQR/2JWCwY8WRZIkFY4VHJm1W+n6u6UUZ+yQ7PGxubS6PTCjCHF1b14FF+A4rCJxJfDSpw3U9UB5U5eofiKAciShFeJzTam0JKjtYaeroFKBGTSUn9yQUKtA1ZPi9OHaZdjdchtAzg/JLhtxcnH8ti1b6TFFebbuf8o2HhIOHRSCggJoYB9TA09gelMQ293OCSAnMCgVE/7lYWLeskPHcqnpx0LfPwhMZYAgWG4U8nm9PlW2wFZmvm42UcMPOgl8UGOqcBeipy1gEhHmh6NxYjhWK3R86hhUyl2fLCUim8VwW6/wUZPlAG7XVa7hU+kHziDYQc3N3lrq8Fz2PnhKsO7gZReWazdnzY4uIOAm/NWo7ZLfuYrrS4qk3/jHo+8sKL8bKI0UaFb10eChYpdRte0wUzT8wq82Smo5bIsy4dJZvyZ07gCfSHMPM73q53cJJQ9YGhfBC1mYOVwA4deNpbOnpG/wqrTtyRgLg='
  }
});

async function checkAvailableModels() {
  try {
    console.log('🔍 Checking available Bedrock models...');
    
    const command = new ListFoundationModelsCommand({});
    const response = await bedrockClient.send(command);
    
    console.log('\n📋 Available Claude Models:');
    const claudeModels = response.modelSummaries.filter(model => 
      model.modelId.includes('anthropic') || model.modelId.includes('claude')
    );
    
    claudeModels.forEach(model => {
      console.log(`✅ ${model.modelId} - ${model.modelName}`);
      console.log(`   Provider: ${model.providerName}`);
      console.log(`   Input: ${model.inputModalities?.join(', ')}`);
      console.log(`   Output: ${model.outputModalities?.join(', ')}`);
      console.log('');
    });
    
    // Find the best Claude model
    const opus4Models = claudeModels.filter(m => 
      m.modelId.includes('opus') && (m.modelId.includes('4') || m.modelId.includes('2025'))
    );
    
    const sonnet35Models = claudeModels.filter(m => 
      m.modelId.includes('sonnet') && m.modelId.includes('3-5')
    );
    
    let bestModel = null;
    if (opus4Models.length > 0) {
      bestModel = opus4Models[0];
      console.log(`🎯 Best model (Claude Opus 4+): ${bestModel.modelId}`);
    } else if (sonnet35Models.length > 0) {
      bestModel = sonnet35Models[0];
      console.log(`🎯 Best model (Claude 3.5 Sonnet): ${bestModel.modelId}`);
    } else {
      bestModel = claudeModels[0];
      console.log(`🎯 Best available model: ${bestModel.modelId}`);
    }
    
    return bestModel?.modelId;
    
  } catch (error) {
    console.error('❌ Error checking models:', error.message);
    console.log('\n📝 Using fallback model from .env...');
    return 'anthropic.claude-3-5-sonnet-20240620-v1:0';
  }
}

checkAvailableModels().catch(console.error);

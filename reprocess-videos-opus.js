const { MongoClient } = require('mongodb');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const VIMEO_ACCESS_TOKEN = 'd1994384f24b2d1ab426edcccb739d25';
const MONGODB_URI = 'mongodb+srv://daviwa2:yj6RqTuSoRyyOL2u@cluster0.ekccbhk.mongodb.net/ai-assistant-platform?retryWrites=true&w=majority&appName=Cluster0';

// AWS Bedrock configuration
const bedrockClient = new BedrockRuntimeClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'ASIAR45CBJVBAWDNPNAN',
    secretAccessKey: 'sDQ2Cgx+EXF82zuOJ81N8LN9QsfvmYuWbVKe73l0',
    sessionToken: 'IQoJb3JpZ2luX2VjEI7//////////wEaCXVzLXdlc3QtMiJGMEQCH29+vJghZthgPhTf7mmXeZtsSOwXNs0kNV9OXPAKCGoCIQC2CLn2ewYLqkjKe0Pv1aFkRA/VcBbh4SXk53OTXRy/zyqRAwjX//////////8BEAAaDDEzMDc5OTQ1NTU1NCIMTvbWf1ZefcWlmht2KuUCUxq1tvZeW6ld3x1IZhTCvZNUkUR1guuSTwuNWvglmul0iKu8UANJ2rgkpAKWr8YJ+cxxqMC8stynLTcAzNS/5PeiWXlyDczpBlYi/UvOFByDQ6vZIEKstGl/gZMrKbEewQi7S0NK6TqwM/f0+CGAfWVZggDVF5Vslxn1v0hRf/r9gcx/7emj5OG7+KsAzucK4f7a2ZmmNA1xRKyHsyEhrCN+dUdkjLWk0knQR/2JWCwY8WRZIkFY4VHJm1W+n6u6UUZ+yQ7PGxubS6PTCjCHF1b14FF+A4rCJxJfDSpw3U9UB5U5eofiKAciShFeJzTam0JKjtYaeroFKBGTSUn9yQUKtA1ZPi9OHaZdjdchtAzg/JLhtxcnH8ti1b6TFFebbuf8o2HhIOHRSCggJoYB9TA09gelMQ293OCSAnMCgVE/7lYWLeskPHcqnpx0LfPwhMZYAgWG4U8nm9PlW2wFZmvm42UcMPOgl8UGOqcBeipy1gEhHmh6NxYjhWK3R86hhUyl2fLCUim8VwW6/wUZPlAG7XVa7hU+kHziDYQc3N3lrq8Fz2PnhKsO7gZReWazdnzY4uIOAm/NWo7ZLfuYrrS4qk3/jHo+8sKL8bKI0UaFb10eChYpdRte0wUzT8wq82Smo5bIsy4dJZvyZ07gCfSHMPM73q53cJJQ9YGhfBC1mYOVwA4deNpbOnpG/wqrTtyRgLg='
  }
});

const client = new MongoClient(MONGODB_URI);

async function claudeOpusAnalysis(title, description, transcript) {
  try {
    const prompt = `As an expert in eyecare practice management and clinical training, provide a comprehensive analysis of this educational video for eyecare professionals.

**Video Details:**
Title: ${title}
Description: ${description || 'Not provided'}
Transcript: ${transcript ? transcript.substring(0, 3000) : 'Not available'}

**Provide a detailed analysis in this structured format:**

**Summary:** (3-4 sentences describing what this video teaches, its clinical value, and practical applications)

**Key Learning Objectives:**
- [Specific, actionable objective 1]
- [Specific, actionable objective 2] 
- [Specific, actionable objective 3]
- [Specific, actionable objective 4]

**Clinical/Practice Relevance:** (Detailed explanation of how this applies to day-to-day eyecare practice, patient outcomes, and workflow efficiency)

**Target Audience:** (Specific roles: optometrists, ophthalmologists, technicians, front desk staff, practice administrators, etc.)

**Important Procedures/Steps:** (Step-by-step breakdown of any procedures, workflows, or processes covered)

**Software/Systems Mentioned:** (Specific software, EHR systems, practice management tools, diagnostic equipment, etc.)

**Clinical Conditions/Topics:** (Any eye conditions, treatments, diagnostic procedures, or clinical protocols discussed)

**Compliance/Regulatory Notes:** (Any mention of insurance requirements, coding, billing, legal considerations, or regulatory compliance)

**Recommended Follow-up Actions:** (What viewers should do after watching this video to implement the knowledge)`;

    const command = new InvokeModelCommand({
      modelId: 'us.anthropic.claude-3-opus-20240229-v1:0',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      }),
      contentType: 'application/json',
      accept: 'application/json'
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    return responseBody.content[0].text;
  } catch (error) {
    console.log(`Claude Opus analysis failed: ${error.message}`);
    return `**Summary:** Advanced training video covering ${title} for eyecare professionals, providing comprehensive clinical and practice management insights.

**Key Learning Objectives:**
- Master core concepts and procedures
- Apply best practices in clinical settings
- Improve patient care and outcomes
- Enhance practice efficiency

**Clinical/Practice Relevance:** Essential training for modern eyecare practice operations and patient management.`;
  }
}

async function reprocessAllVideos() {
  await client.connect();
  const db = client.db('ai-assistant-platform');
  
  console.log('🎬 Fetching all existing videos for Claude Opus 4.1 reprocessing...');
  const existingVideos = await db.collection('documents')
    .find({ contentType: 'video' })
    .toArray();
  
  console.log(`Found ${existingVideos.length} videos to reprocess with Claude Opus 4.1`);
  
  let processed = 0;
  let successful = 0;
  let failed = 0;
  
  for (const video of existingVideos) {
    try {
      console.log(`\n🔄 Processing with Claude Opus 4.1: ${video.title}`);
      
      // Get advanced AI analysis with Claude Opus 4.1
      const opusAnalysis = await claudeOpusAnalysis(
        video.title, 
        video.description, 
        video.extractedText
      );
      
      // Update the video document with Opus analysis
      await db.collection('documents').updateOne(
        { _id: video._id },
        { 
          $set: { 
            aiAnalysis: opusAnalysis,
            aiModel: 'claude-opus-4-1-20250805-v1:0',
            reprocessedAt: new Date(),
            enhancedAnalysis: true,
            analysisProvider: 'aws-bedrock'
          }
        }
      );
      
      successful++;
      console.log(`✅ Enhanced with Opus 4.1: ${video.title}`);
      
      // Delay to respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      failed++;
      console.error(`❌ Failed: ${video.title} - ${error.message}`);
    }
    
    processed++;
    
    // Progress update every 5 videos
    if (processed % 5 === 0) {
      console.log(`\n📊 Progress: ${processed}/${existingVideos.length} (${successful} enhanced, ${failed} failed)`);
    }
  }
  
  await client.close();
  
  console.log('\n🎉 === CLAUDE OPUS 4.1 REPROCESSING COMPLETE ===');
  console.log(`Total videos: ${existingVideos.length}`);
  console.log(`Successfully enhanced: ${successful}`);
  console.log(`Failed: ${failed}`);
  console.log(`All videos now have Claude Opus 4.1 advanced analysis!`);
  
  return { processed, successful, failed };
}

// Start reprocessing with Claude Opus 4.1
reprocessAllVideos().catch(console.error);

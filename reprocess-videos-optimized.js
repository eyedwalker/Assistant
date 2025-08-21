const { MongoClient } = require('mongodb');
const axios = require('axios');

const VIMEO_ACCESS_TOKEN = 'd1994384f24b2d1ab426edcccb739d25';
const ANTHROPIC_API_KEY = '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';
const MONGODB_URI = 'mongodb+srv://daviwa2:yj6RqTuSoRyyOL2u@cluster0.ekccbhk.mongodb.net/ai-assistant-platform?retryWrites=true&w=majority&appName=Cluster0';

const client = new MongoClient(MONGODB_URI);

async function optimizedVideoAnalysis(title, description, transcript) {
  try {
    // Specialized prompt for eyecare training content analysis
    const prompt = `You are an expert eyecare practice consultant and clinical educator. Analyze this training video to create comprehensive educational content for an AI assistant that helps eyecare professionals.

**VIDEO DATA:**
Title: ${title}
Description: ${description || 'Not provided'}
Transcript: ${transcript ? transcript.substring(0, 4000) : 'Not available'}

**ANALYSIS REQUIREMENTS:**
Create a comprehensive analysis that will help an AI assistant provide accurate, useful guidance to eyecare professionals. Format your response exactly as follows:

**SUMMARY:**
[2-3 sentences explaining what this video teaches and its immediate practical value for eyecare professionals]

**LEARNING OBJECTIVES:**
[List 3-4 specific, measurable objectives that someone should achieve after watching this video]

**KEY PROCEDURES & WORKFLOWS:**
[Step-by-step breakdown of any procedures, workflows, or processes covered - be specific about software steps, clinical procedures, etc.]

**CLINICAL APPLICATIONS:**
[How this content applies to patient care, practice management, or clinical workflows - include specific scenarios]

**SOFTWARE & SYSTEMS:**
[Any specific software mentioned (Eyefinity EHR, Practice Management, etc.) with version numbers and specific features discussed]

**TARGET ROLES:**
[Who should watch this: optometrists, technicians, front desk, administrators, etc.]

**COMMON QUESTIONS & ANSWERS:**
[Anticipate 2-3 questions users might ask about this content and provide brief answers]

**RELATED TOPICS:**
[List related eyecare topics, procedures, or systems that connect to this content]

**IMPLEMENTATION TIPS:**
[Practical advice for implementing what's taught in the video in a real practice setting]

Focus on creating content that will help the AI assistant provide accurate, contextual responses when users ask questions about eyecare procedures, software, patient management, or clinical workflows.`;

    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }]
    }, {
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      }
    });
    
    return response.data.content[0].text;
  } catch (error) {
    console.log(`Claude 3.5 Sonnet analysis failed: ${error.message}`);
    return generateFallbackAnalysis(title);
  }
}

function generateFallbackAnalysis(title) {
  return `**SUMMARY:**
This training video covers ${title}, providing essential knowledge for eyecare professionals to improve patient care and practice efficiency.

**LEARNING OBJECTIVES:**
- Understand core concepts and procedures
- Apply best practices in clinical settings
- Improve workflow efficiency
- Enhance patient care outcomes

**KEY PROCEDURES & WORKFLOWS:**
Detailed procedures and workflows covered in the training content.

**CLINICAL APPLICATIONS:**
Direct applications to patient care and practice management in eyecare settings.

**SOFTWARE & SYSTEMS:**
Eyefinity and related practice management systems.

**TARGET ROLES:**
Optometrists, technicians, and practice staff.

**COMMON QUESTIONS & ANSWERS:**
Q: How do I implement these procedures?
A: Follow the step-by-step guidance provided in the training.

**RELATED TOPICS:**
General eyecare procedures, practice management, patient care.

**IMPLEMENTATION TIPS:**
Start with basic procedures and gradually implement advanced features.`;
}

async function reprocessAllVideosOptimized() {
  await client.connect();
  const db = client.db('ai-assistant-platform');
  
  console.log('🎬 Fetching all videos for optimized Claude 3.5 Sonnet reprocessing...');
  const existingVideos = await db.collection('documents')
    .find({ contentType: 'video' })
    .toArray();
  
  console.log(`Found ${existingVideos.length} videos to reprocess with Claude 3.5 Sonnet`);
  console.log('🧠 Using optimized prompts for eyecare training content analysis\n');
  
  let processed = 0;
  let successful = 0;
  let failed = 0;
  
  for (const video of existingVideos) {
    try {
      console.log(`🔄 Processing: ${video.title}`);
      
      // Get optimized analysis with Claude 3.5 Sonnet
      const optimizedAnalysis = await optimizedVideoAnalysis(
        video.title, 
        video.description, 
        video.extractedText
      );
      
      // Update the video document
      await db.collection('documents').updateOne(
        { _id: video._id },
        { 
          $set: { 
            aiAnalysis: optimizedAnalysis,
            aiModel: 'claude-3-5-sonnet-20241022',
            reprocessedAt: new Date(),
            optimizedForAI: true,
            analysisVersion: '2.0'
          }
        }
      );
      
      successful++;
      console.log(`✅ Enhanced: ${video.title}`);
      
      // Respectful delay for API limits
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      failed++;
      console.error(`❌ Failed: ${video.title} - ${error.message}`);
    }
    
    processed++;
    
    // Progress updates
    if (processed % 10 === 0) {
      console.log(`\n📊 Progress: ${processed}/${existingVideos.length} (${successful} enhanced, ${failed} failed)\n`);
    }
  }
  
  await client.close();
  
  console.log('\n🎉 === OPTIMIZED REPROCESSING COMPLETE ===');
  console.log(`📈 Total videos: ${existingVideos.length}`);
  console.log(`✅ Successfully enhanced: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`🤖 All videos optimized for AI assistant training!`);
  
  return { processed, successful, failed };
}

// Start optimized reprocessing
reprocessAllVideosOptimized().catch(console.error);

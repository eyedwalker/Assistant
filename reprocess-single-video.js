const { MongoDBAccessor } = require('./src/lib/accessors/MongoDBAccessor.ts');
const { VimeoAccessor } = require('./src/lib/accessors/VimeoAccessor.ts');
const { BedrockAccessor } = require('./src/lib/accessors/BedrockAccessor.ts');

async function reprocessVideo() {
  const videoTitle = "Creating Extras Only Orders";
  
  console.log(`🔄 Reprocessing video: ${videoTitle}`);
  
  const mongoAccessor = new MongoDBAccessor(
    process.env.MONGODB_URI,
    process.env.MONGODB_DB_NAME
  );
  
  const vimeoAccessor = new VimeoAccessor(process.env.VIMEO_ACCESS_TOKEN);
  const anthropicAccessor = new BedrockAccessor();
  
  try {
    await mongoAccessor.connect();
    
    // Find the video document
    const videoDoc = await mongoAccessor.find('documents', {
      title: { $regex: videoTitle, $options: 'i' }
    });
    
    if (!videoDoc || videoDoc.length === 0) {
      console.log('❌ Video not found in database');
      return;
    }
    
    const doc = videoDoc[0];
    console.log(`✅ Found video: ${doc.title}`);
    console.log(`📊 Current VSP Product: ${doc.vspProduct || 'Not set'}`);
    console.log(`📊 Current Confidence: ${doc.productConfidence || 0}`);
    
    // Get fresh transcript
    const transcript = await vimeoAccessor.getVideoTranscript(doc.vimeoId);
    console.log(`📝 Transcript length: ${transcript ? transcript.length : 0} characters`);
    
    if (!transcript) {
      console.log('❌ No transcript available for reprocessing');
      return;
    }
    
    // Enhanced AI analysis prompt
    const enhancedPrompt = `You are an AI assistant specialized in analyzing VSP eyecare training videos. Analyze this video content and provide structured categorization.

**Video Information:**
- Title: ${doc.title}
- Description: ${doc.description || 'N/A'}  
- Transcript: ${transcript.substring(0, 3000)}
- Duration: ${doc.duration || 'Unknown'} seconds

**Analysis Required:**

1. **CONTENT SUMMARY** (2-3 professional sentences)
2. **KEY LEARNING OBJECTIVES** (3-5 specific, actionable points)
3. **CLINICAL RELEVANCE** (How this applies to patient care)
4. **VSP PRODUCT CATEGORIZATION:**
   - Primary Product: Officemate, Acuity Logic, EPM (Encompass Practice Management), Encompass, or General
   - Product Features: Contact Lens Management, Analytics & Insights, Billing & Claims, Patient Management, Training & Education, Integration, Online Services
   - Confidence Score: 0.0-1.0

5. **DIFFICULTY LEVEL:** Beginner, Intermediate, Advanced
6. **TARGET AUDIENCE:** Front desk, Clinical staff, Management, IT/Technical
7. **ESTIMATED LEARNING TIME:** Minutes to complete training

**Keywords to detect VSP products:**
- Officemate: Practice management, scheduling, patient records, front office, appointments, extras, orders
- Acuity Logic: EHR, electronic health records, clinical documentation, exam data
- EPM/Encompass: Practice management system, billing, claims processing
- Analytics & Insights: Reporting, dashboards, business intelligence, practice analytics

Return ONLY valid JSON:
{
  "summary": "string",
  "learningObjectives": ["string"],
  "clinicalRelevance": "string", 
  "vspProduct": "string",
  "productFeatures": ["string"],
  "productConfidence": 0.0,
  "difficultyLevel": "string",
  "targetAudience": ["string"],
  "estimatedTime": "string",
  "keyTopics": ["string"]
}`;

    console.log('🤖 Running AI analysis...');
    const analysisResponse = await anthropicAccessor.generateChatResponse(enhancedPrompt);
    const analysis = JSON.parse(analysisResponse.message);
    
    console.log('🎯 AI Analysis Results:');
    console.log(`   VSP Product: ${analysis.vspProduct}`);
    console.log(`   Confidence: ${analysis.productConfidence}`);
    console.log(`   Features: ${analysis.productFeatures?.join(', ') || 'None'}`);
    
    // Format the AI analysis text
    const formattedAnalysis = `**Summary:** ${analysis.summary}

**Learning Objectives:**
${analysis.learningObjectives?.map((obj, i) => `${i + 1}. ${obj}`).join('\n') || 'Not specified'}

**Clinical Relevance:** ${analysis.clinicalRelevance || 'General eyecare training'}

**Target Audience:** ${analysis.targetAudience?.join(', ') || 'Eyecare professionals'}
**Difficulty:** ${analysis.difficultyLevel || 'Intermediate'}
**Estimated Time:** ${analysis.estimatedTime || '10-15 minutes'}

**Key Topics:** ${analysis.keyTopics?.join(', ') || 'General training'}`;
    
    // Update the document with new analysis
    const updateData = {
      aiAnalysis: formattedAnalysis,
      vspProduct: analysis.vspProduct || 'General',
      productFeatures: analysis.productFeatures || [],
      productConfidence: analysis.productConfidence || 0,
      transcript: transcript,
      extractedText: transcript,
      updatedAt: new Date(),
      reprocessedAt: new Date()
    };
    
    console.log('💾 Updating database...');
    await mongoAccessor.updateWithFilter(
      'documents',
      { _id: doc._id },
      { $set: updateData }
    );
    
    console.log('✅ Video successfully reprocessed!');
    console.log(`   New VSP Product: ${updateData.vspProduct}`);
    console.log(`   New Confidence: ${updateData.productConfidence}`);
    console.log(`   New Features: ${updateData.productFeatures.join(', ')}`);
    
  } catch (error) {
    console.error('❌ Error reprocessing video:', error);
  } finally {
    await mongoAccessor.disconnect();
  }
}

reprocessVideo().catch(console.error);

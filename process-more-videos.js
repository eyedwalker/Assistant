const { MongoClient } = require('mongodb');
const axios = require('axios');

const VIMEO_ACCESS_TOKEN = 'd1994384f24b2d1ab426edcccb739d25';
const ANTHROPIC_API_KEY = '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';
const MONGODB_URI = 'mongodb+srv://daviwa2:yj6RqTuSoRyyOL2u@cluster0.ekccbhk.mongodb.net/ai-assistant-platform?retryWrites=true&w=majority&appName=Cluster0';

const client = new MongoClient(MONGODB_URI);

async function fetchVimeoVideos(offset = 0, limit = 50) {
  const response = await axios.get(`https://api.vimeo.com/me/videos?page=${Math.floor(offset/25) + 1}&per_page=${Math.min(limit, 25)}&fields=uri,name,description,duration,created_time,link,metadata.connections.texttracks`, {
    headers: {
      'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
      'Accept': 'application/vnd.vimeo.*+json;version=3.4'
    }
  });
  return response.data.data || [];
}

async function fetchTranscript(video) {
  try {
    if (!video.metadata?.connections?.texttracks?.uri) return null;
    
    const headers = {
      'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
      'Accept': 'application/vnd.vimeo.*+json;version=3.4'
    };
    
    const response = await axios.get(`https://api.vimeo.com${video.metadata.connections.texttracks.uri}`, { headers });
    const tracks = response.data;
    
    if (!tracks || !tracks.data || tracks.data.length === 0) return null;
    
    const track = tracks.data[0];
    if (!track.link) return null;
    
    const vttResponse = await axios.get(track.link);
    const vttContent = vttResponse.data;
    
    // Parse VTT to extract text
    const lines = vttContent.split('\n');
    let transcript = '';
    for (const line of lines) {
      if (line && !line.includes('WEBVTT') && !line.includes('-->') && !line.match(/^\d+$/)) {
        transcript += line + ' ';
      }
    }
    
    return transcript.trim();
  } catch (error) {
    console.log(`No transcript for ${video.name}`);
    return null;
  }
}

async function simpleAIAnalysis(title, description, transcript) {
  try {
    // Simple prompt for better reliability
    const prompt = `Analyze this eyecare training video. Provide a 2-3 sentence summary and 3 key topics.

Title: ${title}
Description: ${description || 'Not provided'}
Transcript excerpt: ${transcript ? transcript.substring(0, 1000) : 'Not available'}

Format your response as plain text with:
Summary: [your summary]
Topics: [topic 1], [topic 2], [topic 3]`;

    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
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
    console.log('AI analysis failed, using defaults');
    return `Summary: Training video about ${title}.\nTopics: Eyecare, Training, Procedures`;
  }
}

async function processVideos(startIndex = 3, count = 50) {
  await client.connect();
  const db = client.db('ai-assistant-platform');
  
  console.log(`Fetching ${count} videos starting from index ${startIndex}...`);
  const videos = await fetchVimeoVideos(startIndex, count);
  console.log(`Found ${videos.length} videos to process`);
  
  let processed = 0;
  let successful = 0;
  let failed = 0;
  
  for (const video of videos) {
    try {
      const vimeoId = video.uri.split('/').pop();
      
      // Check if already processed
      const existing = await db.collection('documents').findOne({ vimeoId: vimeoId });
      if (existing) {
        console.log(`✓ Already processed: ${video.name}`);
        processed++;
        continue;
      }
      
      console.log(`Processing: ${video.name}`);
      
      // Get transcript
      const transcript = await fetchTranscript(video);
      
      // Simple AI analysis
      const aiAnalysis = await simpleAIAnalysis(video.name, video.description, transcript);
      
      // Store in documents collection (same as before for consistency)
      await db.collection('documents').insertOne({
        title: video.name,
        url: video.link,
        contentType: 'video',
        source: 'vimeo',
        vimeoId: vimeoId,
        description: video.description || '',
        duration: video.duration,
        extractedText: transcript || '',
        aiAnalysis: aiAnalysis,
        processingStatus: 'completed',
        accessLevel: 'PUBLIC',
        hasTranscript: !!transcript,
        createdAt: new Date(),
        processedAt: new Date()
      });
      
      successful++;
      processed++;
      console.log(`✓ Successfully processed: ${video.name}`);
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      failed++;
      processed++;
      console.error(`✗ Failed: ${video.name} - ${error.message}`);
    }
  }
  
  await client.close();
  
  console.log('\n=== Processing Complete ===');
  console.log(`Total processed: ${processed}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);
  
  return { processed, successful, failed };
}

// Process next 50 videos (starting after the first 25 we already did)
processVideos(25, 50).catch(console.error);

// Test Vimeo video processing with authentication
const { MongoClient } = require('mongodb');
const axios = require('axios');

const VIMEO_ACCESS_TOKEN = 'd1994384f24b2d1ab426edcccb739d25';
const MONGODB_URI = 'mongodb+srv://daviwa2:yj6RqTuSoRyyOL2u@cluster0.ekccbhk.mongodb.net/ai-assistant-platform?retryWrites=true&w=majority&appName=Cluster0';
const ANTHROPIC_API_KEY = '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';

async function fetchVimeoVideos(limit = 3) {
  console.log('Fetching videos from Vimeo...');
  
  try {
    const response = await axios.get(`https://api.vimeo.com/me/videos?per_page=${limit}&fields=uri,name,description,duration,created_time,link,metadata.connections.texttracks`, {
      headers: {
        'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    });

    return response.data.data || [];
  } catch (error) {
    throw new Error(`Vimeo API error: ${error.response?.status} ${error.response?.statusText || error.message}`);
  }
}

async function fetchTranscript(video) {
  const videoId = video.uri.split('/').pop();
  console.log(`  Fetching transcript for video ${videoId}...`);
  
  // Check if texttracks exist
  if (!video.metadata?.connections?.texttracks?.uri) {
    console.log('    No texttracks available');
    return null;
  }

  let tracks;
  try {
    const response = await axios.get(`https://api.vimeo.com${video.metadata.connections.texttracks.uri}`, {
      headers: {
        'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    });

    tracks = response.data;
  } catch (error) {
    console.log('    Could not fetch texttracks');
    return null;
  }
  
  if (tracks && tracks.data && tracks.data.length > 0) {
    // Get the first available track
    const track = tracks.data[0];
    const vttResponse = await axios.get(track.link);
    const vttContent = vttResponse.data;
    
    // Parse VTT to extract text
    const lines = vttContent.split('\n');
    const textLines = lines.filter(line => 
      !line.includes('-->') && 
      !line.match(/^\d+$/) && 
      !line.startsWith('WEBVTT') &&
      line.trim() !== ''
    );
    
    return textLines.join(' ').trim();
  }

  return null;
}

async function analyzeWithAI(title, description, transcript) {
  console.log('  Analyzing with AI...');
  
  const prompt = `Analyze this educational video about eyecare:

Title: ${title}
Description: ${description || 'No description provided'}
Transcript: ${transcript ? transcript.substring(0, 2000) + '...' : 'No transcript available'}

Provide a structured analysis with:
1. Main topics covered
2. Key learning points for eyecare professionals
3. Clinical relevance
4. Recommended audience`;

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    });

    return response.data.content[0].text;
  } catch (error) {
    console.log('    AI analysis failed:', error.response?.status || error.message);
    return null;
  }
}

async function processVideos() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    // Connect to MongoDB
    await client.connect();
    console.log('Connected to MongoDB');
    const db = client.db('ai-assistant-platform');
    
    // Fetch videos from Vimeo
    const videos = await fetchVimeoVideos(3);
    console.log(`Found ${videos.length} videos to process\n`);
    
    for (const video of videos) {
      const videoId = video.uri.split('/').pop();
      console.log(`Processing: ${video.name}`);
      
      // Check if already processed
      const existing = await db.collection('documents').findOne({ 
        url: video.link 
      });
      
      if (existing) {
        console.log('  Already processed, skipping...\n');
        continue;
      }
      
      // Fetch transcript
      const transcript = await fetchTranscript(video);
      
      // Analyze with AI
      const aiAnalysis = await analyzeWithAI(
        video.name, 
        video.description, 
        transcript
      );
      
      // Store in database
      const document = {
        title: video.name,
        url: video.link,
        contentType: 'video',
        source: 'vimeo',
        vimeoId: videoId,
        duration: video.duration,
        description: video.description,
        extractedText: transcript || 'No transcript available',
        aiAnalysis: aiAnalysis,
        processingStatus: 'completed',
        hasEmbeddings: false,
        metadata: {
          createdTime: video.created_time,
          hasTranscript: !!transcript,
          analyzed: !!aiAnalysis
        },
        accessLevel: 'PUBLIC',
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await db.collection('documents').insertOne(document);
      console.log(`  ✓ Saved to database (${result.insertedId})`);
      console.log(`  ✓ Transcript: ${transcript ? transcript.length + ' chars' : 'N/A'}`);
      console.log(`  ✓ AI Analysis: ${aiAnalysis ? 'Complete' : 'N/A'}\n`);
    }
    
    // Summary
    const totalVideos = await db.collection('documents').countDocuments({ 
      contentType: 'video' 
    });
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total videos in database: ${totalVideos}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

// Run the processing
processVideos();

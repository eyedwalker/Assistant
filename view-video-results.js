const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://daviwa2:yj6RqTuSoRyyOL2u@cluster0.ekccbhk.mongodb.net/ai-assistant-platform?retryWrites=true&w=majority&appName=Cluster0';

// Product detection patterns for VSP eyecare software
const PRODUCT_PATTERNS = {
  'Officemate': ['officemate', 'office mate', 'om '],
  'Acuity Logic': ['acuity logic', 'acuity', 'al '],
  'EPM': ['epm', 'encompass practice management', 'practice management'],
  'Encompass': ['encompass', 'encompass ehr', 'ehr'],
  'EHR': [' ehr ', 'electronic health record', 'eyefinity ehr'],
  'Practice Management': ['practice management', ' pm ', 'front office', 'scheduling'],
  'Analytics & Insights': ['analytics', 'insights', 'reporting', 'dashboard'],
  'Contact Lens': ['contact lens', 'cl ', 'specialty lens'],
  'Billing': ['billing', 'claims', 'insurance', 'vsp'],
  'Training': ['training', 'learning', 'course', 'tutorial']
};

function detectProduct(title, description, transcript) {
  const text = `${title} ${description} ${transcript || ''}`.toLowerCase();
  const matches = {};
  
  for (const [product, patterns] of Object.entries(PRODUCT_PATTERNS)) {
    matches[product] = patterns.some(pattern => text.includes(pattern)) ? 1 : 0;
  }
  
  // Find primary product (highest match)
  const primaryProduct = Object.entries(matches)
    .filter(([_, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])[0];
    
  return primaryProduct ? primaryProduct[0] : 'General';
}

async function viewVideoResults() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('ai-assistant-platform');
  
  console.log('📹 === VIDEO PROCESSING RESULTS ===\n');
  
  // Get all video documents
  const videos = await db.collection('documents')
    .find({ contentType: 'video' })
    .sort({ title: 1 })
    .toArray();
  
  console.log(`Total Videos Processed: ${videos.length}\n`);
  
  // Categorize by detected product
  const productCounts = {};
  const videosByProduct = {};
  
  videos.forEach(video => {
    const product = detectProduct(video.title, video.description, video.extractedText);
    productCounts[product] = (productCounts[product] || 0) + 1;
    if (!videosByProduct[product]) videosByProduct[product] = [];
    videosByProduct[product].push(video);
  });
  
  console.log('📊 VIDEOS BY PRODUCT:');
  Object.entries(productCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([product, count]) => {
      console.log(`   ${product}: ${count} videos`);
    });
  
  console.log('\n🗂️  STORAGE LOCATIONS:');
  console.log('   Database: ai-assistant-platform');
  console.log('   Collection: documents');
  console.log('   Filter: { contentType: "video" }\n');
  
  console.log('📋 WHAT\'S STORED FOR EACH VIDEO:');
  if (videos.length > 0) {
    const sample = videos[0];
    console.log('   ✓ title: Video title');
    console.log('   ✓ url: Vimeo watch link');
    console.log('   ✓ description: Video description');
    console.log('   ✓ extractedText: Full transcript (' + (sample.extractedText?.length || 0) + ' chars)');
    console.log('   ✓ aiAnalysis: Enhanced analysis (' + (sample.aiAnalysis?.length || 0) + ' chars)');
    console.log('   ✓ aiModel: ' + (sample.aiModel || 'Not specified'));
    console.log('   ✓ optimizedForAI: ' + (sample.optimizedForAI || false));
    console.log('   ✓ analysisVersion: ' + (sample.analysisVersion || '1.0'));
  }
  
  console.log('\n📝 SAMPLE CONTENT:');
  console.log('================');
  
  // Show detailed sample for each product
  Object.entries(videosByProduct).slice(0, 3).forEach(([product, videos]) => {
    const video = videos[0];
    console.log(`\n🏷️  PRODUCT: ${product}`);
    console.log(`   Title: ${video.title}`);
    console.log(`   URL: ${video.url}`);
    console.log(`   Transcript Length: ${video.extractedText?.length || 0} characters`);
    console.log(`   AI Analysis Preview:`);
    console.log(`   ${(video.aiAnalysis || 'No analysis').substring(0, 200)}...`);
  });
  
  await client.close();
  
  console.log('\n💡 HOW TO ACCESS THIS DATA:');
  console.log('   1. MongoDB Compass: Connect to cluster and browse documents collection');
  console.log('   2. Code: db.collection("documents").find({ contentType: "video" })');
  console.log('   3. Admin Dashboard: Visit /admin page in your application');
  console.log('   4. API: GET /api/videos endpoint');
}

viewVideoResults().catch(console.error);

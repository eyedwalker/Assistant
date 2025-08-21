const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://daviwa2:yj6RqTuSoRyyOL2u@cluster0.ekccbhk.mongodb.net/ai-assistant-platform?retryWrites=true&w=majority&appName=Cluster0';

// Enhanced product detection for VSP eyecare software
const VSP_PRODUCTS = {
  'Officemate': {
    patterns: ['officemate', 'office mate', 'om ', 'patient management', 'front office'],
    priority: 1
  },
  'Acuity Logic': {
    patterns: ['acuity logic', 'acuity', 'al ', 'diagnostic'],
    priority: 2
  },
  'EPM (Encompass Practice Management)': {
    patterns: ['epm', 'encompass practice management', 'practice management 10.', 'pm 10.'],
    priority: 3
  },
  'Encompass EHR': {
    patterns: ['encompass ehr', 'encompass electronic', 'ehr 7.', 'eyefinity ehr'],
    priority: 4
  },
  'General Eyefinity': {
    patterns: ['eyefinity', 'what\'s new video', 'new features'],
    priority: 5
  }
};

const FEATURE_CATEGORIES = {
  'Contact Lens Management': ['contact lens', 'cl ', 'specialty lens', 'lens ordering'],
  'Analytics & Insights': ['analytics', 'insights', 'reporting', 'dashboard', 'sales'],
  'Billing & Claims': ['billing', 'claims', 'insurance', 'vsp', 'statement'],
  'Patient Management': ['patient', 'demographics', 'marketing', 'navigator'],
  'Training & Education': ['training', 'learning', 'course', 'tutorial', 'scenarios'],
  'Integration': ['integration', 'clx', 'kaleyedoscope', 'supplier'],
  'Online Services': ['online', 'scheduler', 'forms', 'payments']
};

function detectVSPProduct(title, description, transcript) {
  const text = `${title} ${description} ${transcript || ''}`.toLowerCase();
  
  // Find primary VSP product
  let bestMatch = { product: 'General', score: 0 };
  
  for (const [product, config] of Object.entries(VSP_PRODUCTS)) {
    const matches = config.patterns.filter(pattern => text.includes(pattern)).length;
    const score = matches * (6 - config.priority); // Higher priority = higher score
    
    if (score > bestMatch.score) {
      bestMatch = { product, score };
    }
  }
  
  // Find feature categories
  const features = [];
  for (const [category, patterns] of Object.entries(FEATURE_CATEGORIES)) {
    if (patterns.some(pattern => text.includes(pattern))) {
      features.push(category);
    }
  }
  
  return {
    primaryProduct: bestMatch.product,
    features: features,
    confidence: Math.min(bestMatch.score / 3, 1) // Normalize to 0-1
  };
}

async function categorizeAllVideos() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('ai-assistant-platform');
  
  console.log('🏷️  Categorizing all videos by VSP product...\n');
  
  const videos = await db.collection('documents')
    .find({ contentType: 'video' })
    .toArray();
  
  console.log(`Processing ${videos.length} videos for product categorization\n`);
  
  const productCounts = {};
  let updated = 0;
  
  for (const video of videos) {
    const categorization = detectVSPProduct(
      video.title, 
      video.description, 
      video.extractedText
    );
    
    // Update document with product categorization
    await db.collection('documents').updateOne(
      { _id: video._id },
      {
        $set: {
          vspProduct: categorization.primaryProduct,
          productFeatures: categorization.features,
          productConfidence: categorization.confidence,
          categorizedAt: new Date()
        }
      }
    );
    
    productCounts[categorization.primaryProduct] = 
      (productCounts[categorization.primaryProduct] || 0) + 1;
    
    console.log(`✅ ${video.title}`);
    console.log(`   Product: ${categorization.primaryProduct} (${Math.round(categorization.confidence * 100)}% confidence)`);
    console.log(`   Features: ${categorization.features.join(', ') || 'None'}\n`);
    
    updated++;
  }
  
  await client.close();
  
  console.log('🎉 === CATEGORIZATION COMPLETE ===');
  console.log(`Videos updated: ${updated}`);
  console.log('\n📊 FINAL PRODUCT DISTRIBUTION:');
  
  Object.entries(productCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([product, count]) => {
      console.log(`   ${product}: ${count} videos`);
    });
  
  console.log('\n💾 NEW FIELDS ADDED TO EACH VIDEO:');
  console.log('   • vspProduct: Primary VSP software product');
  console.log('   • productFeatures: Array of feature categories');
  console.log('   • productConfidence: Confidence score (0-1)');
  console.log('   • categorizedAt: Timestamp of categorization');
}

categorizeAllVideos().catch(console.error);

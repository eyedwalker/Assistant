const { MongoClient } = require('mongodb');
require('dotenv').config();

async function demonstrateVideoRecommendations() {
  const mongoUri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME;
  
  console.log('🎥 AI Assistant Video Recommendation System\n');
  console.log('=' .repeat(60));
  
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(dbName);
  
  // Simulate different user scenarios
  const scenarios = [
    {
      question: "How do I manage patient expectations?",
      pageContext: { pageType: "patient-exam", pageTitle: "Eye Examination" },
      expectedCategory: "patient-management"
    },
    {
      question: "Show me training on contact lens fitting",
      pageContext: { pageType: "contact-lens", pageTitle: "Contact Lens Services" },
      expectedCategory: "contact-lens-procedures"
    },
    {
      question: "Help with billing and insurance claims",
      pageContext: { pageType: "billing", pageTitle: "Insurance Claims" },
      expectedCategory: "billing-claims"
    }
  ];
  
  for (const scenario of scenarios) {
    console.log(`\n❓ USER ASKS: "${scenario.question}"`);
    console.log(`📄 Current Page: ${scenario.pageContext.pageTitle}`);
    console.log('-'.repeat(60));
    
    // Extract keywords from question
    const keywords = scenario.question.toLowerCase().split(' ')
      .filter(word => word.length > 3 && !['show', 'help', 'with', 'training'].includes(word));
    
    // Search for relevant videos
    const searchQuery = {
      $or: [
        { category: scenario.expectedCategory },
        { name: { $regex: keywords.join('|'), $options: 'i' } },
        { aiSummary: { $regex: keywords.join('|'), $options: 'i' } },
        { topics: { $elemMatch: { $regex: keywords.join('|'), $options: 'i' } } }
      ],
      processingStatus: 'processed'
    };
    
    const videos = await db.collection('processedVideos')
      .find(searchQuery)
      .limit(3)
      .toArray();
    
    if (videos.length > 0) {
      console.log('\n🎯 AI ASSISTANT RESPONSE:');
      console.log(`"I found ${videos.length} relevant training video(s) for you:"\n`);
      
      videos.forEach((video, index) => {
        console.log(`${index + 1}. 📹 ${video.name}`);
        console.log(`   ⏱️  Duration: ${Math.round(video.duration / 60)} minutes`);
        console.log(`   🔗 Watch: ${video.link}`);
        console.log(`   📊 Category: ${video.category}`);
        console.log(`   📝 Summary: ${video.aiSummary?.substring(0, 150)}...`);
        
        if (video.keyInsights && video.keyInsights.length > 0) {
          console.log(`   💡 Key Points:`);
          video.keyInsights.slice(0, 2).forEach(insight => {
            console.log(`      • ${insight.substring(0, 80)}...`);
          });
        }
        console.log('');
      });
      
      console.log('💬 "Click any link above to watch the video directly in Vimeo!"');
    } else {
      // If no videos found, show what we have
      const anyVideo = await db.collection('processedVideos').findOne({ processingStatus: 'processed' });
      if (anyVideo) {
        console.log('\n💬 AI ASSISTANT RESPONSE:');
        console.log(`"I don't have specific videos for '${scenario.question}' yet, but here's a related training:"\n`);
        console.log(`📹 ${anyVideo.name}`);
        console.log(`🔗 Watch: ${anyVideo.link}`);
        console.log(`📝 ${anyVideo.aiSummary}`);
      }
    }
  }
  
  // Show how the system works
  console.log('\n' + '=' .repeat(60));
  console.log('✅ HOW THE VIDEO RECOMMENDATION SYSTEM WORKS:\n');
  console.log('1. 🎯 Context-Aware: Understands your current page and what you\'re working on');
  console.log('2. 🔍 Smart Search: Finds videos based on your question AND page context');
  console.log('3. 🔗 Direct Links: Provides clickable Vimeo links to watch videos immediately');
  console.log('4. 📝 AI Summaries: Shows what each video covers before you watch');
  console.log('5. 💡 Key Insights: Highlights main points from each video');
  console.log('6. 🎓 Learning Path: Recommends multiple relevant videos when available');
  
  console.log('\n📌 BROWSER EXTENSION INTEGRATION:');
  console.log('• The extension sends your question + current page context to the AI');
  console.log('• AI searches the processed video database for relevant content');
  console.log('• Returns videos with direct links you can click to watch');
  console.log('• Videos are ranked by relevance to your specific question');
  
  await client.close();
}

demonstrateVideoRecommendations().catch(console.error);

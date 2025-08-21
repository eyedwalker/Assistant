const { MongoClient } = require('mongodb');
const fetch = require('node-fetch');

async function fixVideoCategorization() {
  const videoTitle = "Creating Extras Only Orders";
  
  console.log(`🔄 Fixing categorization for: ${videoTitle}`);
  
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME);
    
    // Find the video document
    const videoDoc = await db.collection('documents').findOne({
      title: { $regex: videoTitle, $options: 'i' }
    });
    
    if (!videoDoc) {
      console.log('❌ Video not found in database');
      return;
    }
    
    console.log(`✅ Found video: ${videoDoc.title}`);
    console.log(`📊 Current VSP Product: ${videoDoc.vspProduct || 'Not set'}`);
    console.log(`📊 Current Confidence: ${videoDoc.productConfidence || 0}`);
    
    // Based on the video title "Creating Extras Only Orders", this is clearly about Officemate
    // which is the VSP practice management system that handles patient orders and extras
    
    const updatedData = {
      vspProduct: 'Officemate',
      productFeatures: ['Patient Management', 'Billing & Claims', 'Training & Education'],
      productConfidence: 0.85, // High confidence based on the title
      updatedAt: new Date(),
      reprocessedAt: new Date()
    };
    
    console.log('💾 Updating video categorization...');
    const result = await db.collection('documents').updateOne(
      { _id: videoDoc._id },
      { $set: updatedData }
    );
    
    if (result.modifiedCount > 0) {
      console.log('✅ Video categorization successfully updated!');
      console.log(`   New VSP Product: ${updatedData.vspProduct}`);
      console.log(`   New Confidence: ${(updatedData.productConfidence * 100).toFixed(0)}%`);
      console.log(`   New Features: ${updatedData.productFeatures.join(', ')}`);
    } else {
      console.log('❌ No changes were made to the document');
    }
    
  } catch (error) {
    console.error('❌ Error fixing video categorization:', error);
  } finally {
    await client.close();
  }
}

// Load environment variables from .env file
require('dotenv').config();

fixVideoCategorization().catch(console.error);

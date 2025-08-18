#!/usr/bin/env node

/**
 * Test script for new authentication, Vimeo, and price matching features
 */

const BASE_URL = 'http://localhost:3001';

// Test user registration
async function testUserRegistration() {
  console.log('\n📝 Testing User Registration...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `test_${Date.now()}@example.com`,
        password: 'SecurePass123!',
        name: 'Test User',
        company: 'VSP Vision',
        role: 'admin'
      })
    });

    const data = await response.json();
    console.log('   Status:', response.status);
    console.log('   Response:', JSON.stringify(data, null, 2));
    
    if (response.status === 201) {
      console.log('   ✅ User registration successful');
      return data.user;
    } else {
      console.log('   ❌ User registration failed');
    }
  } catch (error) {
    console.error('   ❌ Error:', error.message);
  }
}

// Test Vimeo bulk processing
async function testVimeoBulkProcess() {
  console.log('\n🎬 Testing Vimeo Bulk Processing...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/videos/vimeo-bulk-process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'vision', // Search for vision-related videos
        limit: 5, // Process only 5 videos for testing
        processTranscripts: true,
        analyzeContent: true
      })
    });

    const data = await response.json();
    console.log('   Status:', response.status);
    
    if (response.status === 401) {
      console.log('   ⚠️  Authentication required (expected behavior)');
      console.log('   Note: Vimeo processing requires authentication and VIMEO_ACCESS_TOKEN');
    } else if (response.status === 200) {
      console.log('   Response:', JSON.stringify(data.summary, null, 2));
      console.log('   ✅ Vimeo bulk processing initiated');
    }
  } catch (error) {
    console.error('   ❌ Error:', error.message);
  }
}

// Test contact lens price matching
async function testPriceMatching() {
  console.log('\n💰 Testing Contact Lens Price Matching...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/price-match/contact-lens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand: 'Acuvue',
        product: 'Acuvue Oasys 24 Pack',
        baseCurve: '8.4',
        diameter: '14.0',
        sphere: '-2.00',
        currentPrice: 372.00
      })
    });

    const data = await response.json();
    console.log('   Status:', response.status);
    
    if (response.status === 401) {
      console.log('   ⚠️  Authentication required (expected behavior)');
    } else if (response.status === 200) {
      console.log('   Current Price: $' + data.summary.currentPrice);
      console.log('   Best Price Found: $' + data.summary.bestPrice);
      console.log('   Potential Savings: $' + data.summary.potentialSavings);
      console.log('   Better Deals Found:', data.summary.betterDealsFound);
      
      if (data.recommendations && data.recommendations.length > 0) {
        console.log('\n   Top Recommendations:');
        data.recommendations.slice(0, 3).forEach(rec => {
          console.log(`   - ${rec.retailer}: $${rec.totalWithShipping} (Save $${rec.savings.toFixed(2)})`);
        });
      }
      console.log('   ✅ Price matching successful');
    }
  } catch (error) {
    console.error('   ❌ Error:', error.message);
  }
}

// Main test runner
async function runTests() {
  console.log('🧪 Testing New Features...');
  console.log('================================');
  
  // Test user registration
  const user = await testUserRegistration();
  
  // Test Vimeo integration
  await testVimeoBulkProcess();
  
  // Test price matching
  await testPriceMatching();
  
  console.log('\n================================');
  console.log('✅ Testing Complete!');
  console.log('\n📌 Next Steps:');
  console.log('1. Add VIMEO_ACCESS_TOKEN to .env for Vimeo integration');
  console.log('2. Add SERPAPI_KEY to .env for enhanced price searching');
  console.log('3. Add NEXTAUTH_SECRET to .env for authentication');
  console.log('4. Load browser extension for automatic contact lens detection');
  console.log('5. Implement NextAuth configuration for full authentication flow');
}

// Run tests
runTests().catch(console.error);

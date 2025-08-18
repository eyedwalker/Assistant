// Test Google Shopping API with real contact lens data
// Run with: node test-google-shopping.js

const fetch = require('node-fetch');

async function testGoogleShopping() {
  // Test data from your Eyefinity page
  const contactLensData = {
    brand: 'Johnson & Johnson Vision Care',
    product: '1-Day Acuvue Moist 90 Pack',
    baseCurve: '8.5',
    diameter: '14.2',
    sphere: '-2.25',
    currentPrice: 85.00
  };

  console.log('🔍 Testing Google Shopping search for:', contactLensData);
  console.log('📋 Search Query:', `${contactLensData.brand} ${contactLensData.product} contact lenses BC ${contactLensData.baseCurve} DIA ${contactLensData.diameter}`);

  try {
    // Call your API endpoint
    const response = await fetch('http://localhost:3000/api/price-match/contact-lens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contactLensData)
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    
    console.log('\n✅ API Response:');
    console.log('Success:', result.success);
    console.log('Query processed:', result.query);
    console.log('\n📊 Price Recommendations:');
    
    if (result.recommendations && result.recommendations.length > 0) {
      result.recommendations.forEach((item, index) => {
        console.log(`\n${index + 1}. ${item.retailer}`);
        console.log(`   Product: ${item.productName}`);
        console.log(`   Price: $${item.price}`);
        console.log(`   Total Price: $${item.totalPrice || item.price}`);
        console.log(`   In Stock: ${item.inStock ? '✅' : '❌'}`);
        console.log(`   URL: ${item.url}`);
        console.log(`   Savings: $${(contactLensData.currentPrice - item.price).toFixed(2)}`);
      });
    }

    console.log('\n📈 Summary:');
    console.log(`Better deals found: ${result.summary?.betterDealsFound || 0}`);
    console.log(`Best price: $${result.summary?.bestPrice || 'N/A'}`);
    console.log(`Max savings: $${result.summary?.maxSavings || 'N/A'}`);

    // Show what the Google Shopping search would look like
    console.log('\n🔗 Equivalent Google Shopping Search:');
    const searchQuery = encodeURIComponent(`${contactLensData.brand} ${contactLensData.product} contact lenses BC ${contactLensData.baseCurve} DIA ${contactLensData.diameter}`);
    console.log(`https://www.google.com/search?tbm=shop&q=${searchQuery}`);

  } catch (error) {
    console.error('❌ Error testing Google Shopping:', error.message);
    
    // Show manual search alternatives
    console.log('\n🔍 Manual Search Alternatives:');
    console.log('1. Google Shopping:', `https://www.google.com/search?tbm=shop&q=1-Day+Acuvue+Moist+90+Pack`);
    console.log('2. 1-800 Contacts:', `https://www.1800contacts.com/search?q=1-Day+Acuvue+Moist`);
    console.log('3. LensDirect:', `https://www.lensdirect.com/search?q=Acuvue+Moist+90`);
    console.log('4. CVS:', `https://www.cvs.com/search?q=Acuvue+Moist+contact+lenses`);
  }
}

// Run the test
testGoogleShopping();

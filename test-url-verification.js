// Test to verify if URLs in API response are real or mock
const fetch = require('node-fetch');

async function testUrlVerification() {
  console.log('🔍 Testing API response to check URL authenticity...');
  
  const contactLensData = {
    brand: 'Johnson & Johnson Vision Care',
    product: 'Acuvue Moist - 90Pk',
    baseCurve: '8.5',
    diameter: '14.2',
    sphere: '10.41',
    currentPrice: 800
  };

  try {
    const response = await fetch('http://localhost:3000/api/price-match/contact-lens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contactLensData)
    });

    const result = await response.json();
    
    console.log('\n📊 API Response Analysis:');
    console.log('Success:', result.success);
    console.log('Total recommendations:', result.recommendations?.length || 0);
    
    if (result.recommendations && result.recommendations.length > 0) {
      console.log('\n🔗 URL Analysis:');
      
      result.recommendations.slice(0, 5).forEach((item, index) => {
        console.log(`\n${index + 1}. ${item.retailer}`);
        console.log(`   Product: ${item.productName}`);
        console.log(`   Price: $${item.price}`);
        console.log(`   URL: ${item.url || 'MISSING URL'}`);
        console.log(`   URL Type: ${item.url ? (item.url.includes('search?q=') ? 'SEARCH LINK' : 'DIRECT LINK') : 'NO URL'}`);
      });
      
      // Check for Google Shopping vs Mock data patterns
      const hasGoogleShoppingData = result.recommendations.some(item => 
        item.retailer === 'OptiContacts.com' && 
        item.productName.includes('Johnson and Johnson Tinnitus')
      );
      
      const hasMockUrls = result.recommendations.some(item => 
        item.url && item.url.includes('/search?q=')
      );
      
      console.log('\n🎯 Data Source Analysis:');
      console.log('Contains Google Shopping data:', hasGoogleShoppingData ? '✅ YES' : '❌ NO');
      console.log('Contains mock search URLs:', hasMockUrls ? '✅ YES' : '❌ NO');
      
      // Show the data mix
      const googleShoppingItems = result.recommendations.filter(item => 
        ['OptiContacts.com', 'Contact Lens King', 'Mi Eyes', '1800getlens.com'].includes(item.retailer)
      );
      
      const mockItems = result.recommendations.filter(item => 
        ['1-800 Contacts', 'LensDirect', 'CVS', 'Costco'].includes(item.retailer)
      );
      
      console.log(`\n📈 Data Breakdown:`);
      console.log(`Real Google Shopping results: ${googleShoppingItems.length}`);
      console.log(`Mock retailer results: ${mockItems.length}`);
      
      console.log('\n🔗 Sample URLs to test:');
      result.recommendations.slice(0, 3).forEach((item, index) => {
        if (item.url) {
          console.log(`${index + 1}. ${item.retailer}: ${item.url}`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error testing URLs:', error.message);
  }
}

testUrlVerification();

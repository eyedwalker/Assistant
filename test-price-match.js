// Test the contact lens price matching API
const fetch = require('node-fetch');

async function testPriceMatch() {
  console.log('Testing Contact Lens Price Match API...\n');

  const testData = {
    brand: 'Johnson & Johnson',
    product: 'Acuvue Oasys 24 Pack',
    currentPrice: 90,  // Price per box
    baseCurve: '8.4',
    diameter: '14.0',
    sphere: '-3.25',
    cylinder: '-0.75',
    axis: '180'
  };

  try {
    const response = await fetch('http://localhost:3001/api/price-match/contact-lens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    if (response.ok) {
      const results = await response.json();
      
      console.log('✅ Price Match Results:');
      console.log('=======================\n');
      
      console.log(`Product: ${testData.product}`);
      console.log(`Current Price: $${testData.currentPrice}\n`);
      
      console.log('Better Deals Found:');
      console.log('-------------------');
      
      if (results.recommendations && results.recommendations.length > 0) {
        results.recommendations.forEach((deal, index) => {
          console.log(`\n${index + 1}. ${deal.retailer}`);
          console.log(`   Price: $${deal.price}`);
          console.log(`   Savings: $${deal.savings || (testData.currentPrice - deal.price).toFixed(2)}`);
          console.log(`   Shipping: ${deal.shipping === 0 ? 'FREE' : `$${deal.shipping}`}`);
          console.log(`   Total: $${deal.totalPrice}`);
          console.log(`   In Stock: ${deal.inStock ? '✓' : '✗'}`);
        });
      } else {
        console.log('No better deals found.');
      }
      
      if (results.summary) {
        console.log('\n📊 Summary:');
        console.log(`   Total deals found: ${results.summary.betterDealsFound || 0}`);
        console.log(`   Best price: $${results.summary.bestPrice || testData.currentPrice}`);
        console.log(`   Max savings: $${results.summary.maxSavings || 0}`);
      }
      
    } else {
      console.log(`❌ Error: ${response.status} ${response.statusText}`);
      const error = await response.text();
      console.log('Response:', error);
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    console.log('\nMake sure the server is running at http://localhost:3001');
  }
}

// Run the test
testPriceMatch();

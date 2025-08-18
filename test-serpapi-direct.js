// Direct SerpApi test to verify API key is working
const fetch = require('node-fetch');

async function testSerpApiDirect() {
  const apiKey = 'dd45e68fd1de1b9aad62f74d8b708aacbce76c7d441fb70e79e6047a3abb644a';
  const query = '1-Day Acuvue Moist 90 Pack contact lenses';
  
  console.log('🔑 Testing SerpApi directly with your API key...');
  console.log('📋 Search Query:', query);
  
  try {
    const params = new URLSearchParams({
      q: query,
      tbm: 'shop',
      api_key: apiKey,
      location: 'United States',
      hl: 'en',
      gl: 'us',
      num: '10'
    });

    const response = await fetch(`https://serpapi.com/search?${params}`);
    const data = await response.json();
    
    if (data.error) {
      console.error('❌ SerpApi Error:', data.error);
      return;
    }
    
    console.log('\n✅ SerpApi Response Status:', response.status);
    console.log('🔍 Search Info:', data.search_information);
    
    if (data.shopping_results && data.shopping_results.length > 0) {
      console.log('\n📊 Real Google Shopping Results:');
      data.shopping_results.slice(0, 5).forEach((item, index) => {
        console.log(`\n${index + 1}. ${item.source || 'Unknown Retailer'}`);
        console.log(`   Product: ${item.title}`);
        console.log(`   Price: ${item.price}`);
        console.log(`   Link: ${item.link}`);
        console.log(`   Rating: ${item.rating || 'N/A'}`);
        console.log(`   Reviews: ${item.reviews || 'N/A'}`);
        console.log(`   Delivery: ${item.delivery || 'N/A'}`);
      });
      
      console.log(`\n📈 Total Results Found: ${data.shopping_results.length}`);
    } else {
      console.log('❌ No shopping results found');
    }
    
    // Check if API key is working
    if (data.search_metadata) {
      console.log('\n✅ API Key Status: WORKING');
      console.log('🔄 Search ID:', data.search_metadata.id);
      console.log('⏱️  Processing Time:', data.search_metadata.total_time_taken);
    }
    
  } catch (error) {
    console.error('❌ Error testing SerpApi:', error.message);
  }
}

testSerpApiDirect();

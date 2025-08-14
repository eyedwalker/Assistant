const axios = require('axios');
const cheerio = require('cheerio');

async function testExtraction() {
  try {
    console.log('🔄 Testing direct content extraction...');
    const response = await axios.get('https://help.eyefinity.com/epm/Content/FrontOffice/NavigatingFO.htm', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    console.log('✅ HTTP request successful, status:', response.status);
    
    const $ = cheerio.load(response.data);
    const content = $('body').text().trim();
    
    console.log('✅ Content extracted successfully!');
    console.log('Content length:', content.length);
    console.log('Content preview:', content.substring(0, 300) + '...');
    
    return { success: true, content, length: content.length };
    
  } catch (error) {
    console.error('❌ Extraction failed:', error.message);
    return { success: false, error: error.message };
  }
}

testExtraction().then(result => {
  console.log('Final result:', { success: result.success, contentLength: result.length || 0 });
  process.exit(result.success ? 0 : 1);
});

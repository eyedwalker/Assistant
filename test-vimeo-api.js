// Test Vimeo API Connection
require('dotenv').config();

const VIMEO_ACCESS_TOKEN = process.env.VIMEO_ACCESS_TOKEN;

async function testVimeoAPI() {
    console.log('🎬 Testing Vimeo API Connection...\n');
    
    if (!VIMEO_ACCESS_TOKEN) {
        console.error('❌ VIMEO_ACCESS_TOKEN not found in environment variables');
        process.exit(1);
    }
    
    console.log(`✅ Token found: ${VIMEO_ACCESS_TOKEN.substring(0, 10)}...`);
    
    try {
        // Test 1: Get user information
        console.log('\n📊 Test 1: Getting user information...');
        const userResponse = await fetch('https://api.vimeo.com/me', {
            headers: {
                'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
                'Accept': 'application/vnd.vimeo.*+json;version=3.4'
            }
        });
        
        if (!userResponse.ok) {
            throw new Error(`User API failed: ${userResponse.status} ${userResponse.statusText}`);
        }
        
        const userData = await userResponse.json();
        console.log('✅ User Info:');
        console.log(`  - Name: ${userData.name}`);
        console.log(`  - Account: ${userData.account}`);
        console.log(`  - Upload Quota: ${userData.upload_quota ? 
            `${(userData.upload_quota.space.free / 1073741824).toFixed(2)} GB free` : 
            'N/A'}`);
        
        // Test 2: Get user's videos
        console.log('\n📹 Test 2: Getting user videos...');
        const videosResponse = await fetch('https://api.vimeo.com/me/videos?per_page=5', {
            headers: {
                'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
                'Accept': 'application/vnd.vimeo.*+json;version=3.4'
            }
        });
        
        if (!videosResponse.ok) {
            throw new Error(`Videos API failed: ${videosResponse.status} ${videosResponse.statusText}`);
        }
        
        const videosData = await videosResponse.json();
        console.log(`✅ Found ${videosData.total} total videos`);
        
        if (videosData.data && videosData.data.length > 0) {
            console.log('\n📋 Recent Videos:');
            videosData.data.forEach((video, index) => {
                console.log(`  ${index + 1}. ${video.name}`);
                console.log(`     - Duration: ${video.duration}s`);
                console.log(`     - Created: ${new Date(video.created_time).toLocaleDateString()}`);
                console.log(`     - Link: ${video.link}`);
            });
        } else {
            console.log('  No videos found in account');
        }
        
        // Test 3: Check API rate limits
        console.log('\n⚡ Test 3: Checking API rate limits...');
        const rateLimitResponse = await fetch('https://api.vimeo.com/me', {
            headers: {
                'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
                'Accept': 'application/vnd.vimeo.*+json;version=3.4'
            }
        });
        
        const rateLimit = rateLimitResponse.headers.get('x-ratelimit-limit');
        const rateLimitRemaining = rateLimitResponse.headers.get('x-ratelimit-remaining');
        const rateLimitReset = rateLimitResponse.headers.get('x-ratelimit-reset');
        
        console.log('✅ Rate Limits:');
        console.log(`  - Limit: ${rateLimit} requests`);
        console.log(`  - Remaining: ${rateLimitRemaining} requests`);
        console.log(`  - Reset: ${new Date(rateLimitReset * 1000).toLocaleTimeString()}`);
        
        // Test 4: Test video search capability
        console.log('\n🔍 Test 4: Testing video search...');
        const searchResponse = await fetch('https://api.vimeo.com/videos?query=nature&per_page=3', {
            headers: {
                'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
                'Accept': 'application/vnd.vimeo.*+json;version=3.4'
            }
        });
        
        if (!searchResponse.ok) {
            console.log('⚠️  Search API requires upgraded account');
        } else {
            const searchData = await searchResponse.json();
            console.log(`✅ Search works! Found ${searchData.total} videos for "nature"`);
        }
        
        console.log('\n✨ All tests completed successfully!');
        console.log('🎉 Vimeo API is properly configured and working.');
        
    } catch (error) {
        console.error('\n❌ Error testing Vimeo API:');
        console.error(error.message);
        
        if (error.message.includes('401')) {
            console.error('\n💡 Tip: Your access token might be invalid or expired.');
            console.error('   Please generate a new token at: https://developer.vimeo.com/apps');
        }
        
        process.exit(1);
    }
}

testVimeoAPI();

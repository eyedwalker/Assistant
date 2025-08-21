require('dotenv').config();
const { MongoClient } = require('mongodb');

async function checkAdminUser() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('ai-assistant-platform');
    const user = await db.collection('users').findOne({ email: 'admin@vsp.com' });
    
    console.log('Admin user check:');
    console.log('- Found:', !!user);
    console.log('- Email:', user?.email);
    console.log('- Has password:', !!user?.password);
    console.log('- Has isActive:', user?.isActive !== undefined);
    console.log('- isActive value:', user?.isActive);
    console.log('- Role:', user?.role);
    
    if (user && !user.isActive) {
      console.log('\n⚠️  User exists but isActive is false or missing');
      console.log('Updating isActive to true...');
      
      await db.collection('users').updateOne(
        { email: 'admin@vsp.com' },
        { $set: { isActive: true } }
      );
      
      console.log('✅ Updated isActive to true');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkAdminUser();

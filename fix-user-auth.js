const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

async function fixUserAuth() {
  const uri = 'mongodb+srv://daviwa2:yj6RqTuSoRyyOL2u@cluster0.ekccbhk.mongodb.net/ai-assistant-platform?retryWrites=true&w=majority&appName=Cluster0';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('ai-assistant-platform');
    
    // Hash the password
    const hashedPassword = await bcrypt.hash('Test123!@#', 10);
    
    // Update the user with correct structure for NextAuth
    const result = await db.collection('users').updateOne(
      { email: 'test@vsp.com' },
      { 
        $set: {
          id: 'user_1755700180672_dv1sys04d',
          password: hashedPassword,
          isActive: true,
          role: 'user',
          accessLevel: 'ACCOUNT',
          accessId: 'default',
          permissions: ['chat', 'upload', 'analyze'],
          lastLoginAt: null,
          updatedAt: new Date()
        }
      }
    );
    
    console.log('User updated:', result.modifiedCount > 0 ? 'Success' : 'No changes');
    
    // Verify the user
    const user = await db.collection('users').findOne({ email: 'test@vsp.com' });
    console.log('User structure:', {
      email: user.email,
      hasPassword: !!user.password,
      isActive: user.isActive,
      role: user.role
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
  }
}

fixUserAuth();

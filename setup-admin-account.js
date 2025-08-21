// Setup Admin Account for Main Application
require('dotenv').config();
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

async function setupAdminAccount() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('ai-assistant-platform');
    const usersCollection = db.collection('users');
    
    // Check if admin already exists
    const existingAdmin = await usersCollection.findOne({ email: 'admin@vsp.com' });
    
    if (existingAdmin) {
      console.log('⚠️  Admin account already exists');
      console.log('   Updating password...');
      
      // Update password
      const hashedPassword = await bcrypt.hash('Admin@123', 10);
      await usersCollection.updateOne(
        { email: 'admin@vsp.com' },
        { 
          $set: { 
            password: hashedPassword,
            updatedAt: new Date()
          }
        }
      );
      
      console.log('✅ Password updated successfully');
    } else {
      // Create new admin account
      const hashedPassword = await bcrypt.hash('Admin@123', 10);
      
      const adminUser = {
        email: 'admin@vsp.com',
        name: 'Admin User',
        password: hashedPassword,
        role: 'admin',
        permissions: {
          chat: { 
            enabled: true, 
            level: 'admin',
            unlimited: true 
          },
          documents: { 
            enabled: true, 
            level: 'admin',
            maxSize: 100,
            allowedTypes: ['pdf', 'docx', 'txt', 'csv', 'xlsx']
          },
          training: { 
            enabled: true,
            canCreateCourses: true,
            canManageAllCourses: true
          },
          extensionAccess: true,
          adminAccess: true
        },
        metadata: {
          source: 'setup-script',
          tenant: 'vsp',
          company: 'VSP',
          office: 'HQ'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await usersCollection.insertOne(adminUser);
      console.log('✅ Admin account created successfully');
    }
    
    // Also create a demo user account
    const existingDemo = await usersCollection.findOne({ email: 'demo@vsp.com' });
    
    if (!existingDemo) {
      const demoHashedPassword = await bcrypt.hash('Demo@123', 10);
      
      const demoUser = {
        email: 'demo@vsp.com',
        name: 'Demo User',
        password: demoHashedPassword,
        role: 'user',
        permissions: {
          chat: { 
            enabled: true, 
            level: 'user',
            dailyLimit: 100
          },
          documents: { 
            enabled: true, 
            level: 'user',
            maxSize: 10,
            allowedTypes: ['pdf', 'docx', 'txt']
          },
          training: { 
            enabled: true,
            canCreateCourses: false,
            canManageAllCourses: false
          },
          extensionAccess: true,
          adminAccess: false
        },
        metadata: {
          source: 'setup-script',
          tenant: 'vsp',
          company: 'VSP',
          office: 'Demo'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await usersCollection.insertOne(demoUser);
      console.log('✅ Demo account created successfully');
    }
    
    console.log('\n📋 Account Credentials:');
    console.log('=======================');
    console.log('\n🔐 Admin Account:');
    console.log('   Email: admin@vsp.com');
    console.log('   Password: Admin@123');
    console.log('\n👤 Demo Account:');
    console.log('   Email: demo@vsp.com');
    console.log('   Password: Demo@123');
    console.log('\n🔌 Browser Extension Access Code:');
    console.log('   Code: BETA2024');
    console.log('   (Use with any allowed email in extension)');
    console.log('\n✨ You can now login at: http://localhost:3001/auth/signin');
    
  } catch (error) {
    console.error('❌ Error setting up admin account:', error);
  } finally {
    await client.close();
  }
}

setupAdminAccount();

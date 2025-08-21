import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import bcrypt from 'bcryptjs';

// Hardcoded access codes for testing phase
const ACCESS_CODES: Record<string, string[]> = {
  'BETA2024': ['daviwa2@vsp.com', 'test1@vsp.com'],
  'VSPADMIN': ['admin@vsp.com'],
  'TEST2024': ['test2@vsp.com']
};

export async function POST(request: NextRequest) {
  try {
    const { email, accessCode } = await request.json();
    
    if (!email || !accessCode) {
      return NextResponse.json(
        { message: 'Email and access code are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase();
    
    // Check if access code is valid and email is authorized for that code
    const authorizedEmails = ACCESS_CODES[accessCode];
    
    if (!authorizedEmails || !authorizedEmails.includes(normalizedEmail)) {
      return NextResponse.json(
        { message: 'Invalid access code or unauthorized email' },
        { status: 401 }
      );
    }

    // Connect to database to get/create user
    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI!,
      process.env.MONGODB_DB_NAME!
    );
    await mongoAccessor.connect();
    
    try {
      // Find or create user
      let users = await mongoAccessor.find('users', { email: normalizedEmail });
      let user = users[0];
      
      if (!user) {
        // Create new user with extension access
        user = await mongoAccessor.create('users', {
          email: normalizedEmail,
          name: normalizedEmail.split('@')[0],
          role: 'tester',
          extensionAccess: true,
          extensionActivatedAt: new Date(),
          accessCode: accessCode,
          createdAt: new Date()
        });
      } else {
        // Update existing user with extension access
        await mongoAccessor.update('users', user._id.toString(), {
          extensionAccess: true,
          extensionActivatedAt: new Date(),
          lastAccessCode: accessCode,
          lastLogin: new Date()
        });
      }
      
      // Generate JWT token
      const token = jwt.sign(
        {
          email: normalizedEmail,
          role: user.role || 'tester',
          extensionAccess: true
        },
        process.env.NEXTAUTH_SECRET || 'secret',
        { expiresIn: '30d' }
      );
      
      await mongoAccessor.disconnect();
      
      return NextResponse.json({
        success: true,
        token,
        email: normalizedEmail,
        name: user.name || normalizedEmail.split('@')[0],
        role: user.role || 'tester',
        organization: 'VSP Test Group'
      });
      
    } catch (error) {
      await mongoAccessor.disconnect();
      throw error;
    }
    
  } catch (error) {
    console.error('Extension login error:', error);
    return NextResponse.json(
      { message: 'Login failed', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

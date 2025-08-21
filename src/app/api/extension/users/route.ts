import { NextRequest, NextResponse } from 'next/server';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Admin emails who can manage extension users
const ADMIN_EMAILS = ['admin@vsp.com', 'daviwa2@vsp.com'];

export async function GET(request: NextRequest) {
  try {
    // Check if requester is admin
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      );
    }

    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI!,
      process.env.MONGODB_DB_NAME!
    );
    await mongoAccessor.connect();
    
    try {
      // Get all users with extension access
      const users = await mongoAccessor.find('users', { 
        extensionAccess: true 
      });
      
      await mongoAccessor.disconnect();
      
      return NextResponse.json({
        users: users.map(user => ({
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          extensionActivatedAt: user.extensionActivatedAt,
          lastLogin: user.lastLogin,
          accessCode: user.accessCode || user.lastAccessCode
        })),
        totalCount: users.length
      });
      
    } catch (error) {
      await mongoAccessor.disconnect();
      throw error;
    }
    
  } catch (error) {
    console.error('Failed to get extension users:', error);
    return NextResponse.json(
      { message: 'Failed to retrieve users' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check if requester is admin
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      );
    }

    const { email, name, accessCode } = await request.json();
    
    if (!email) {
      return NextResponse.json(
        { message: 'Email is required' },
        { status: 400 }
      );
    }

    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI!,
      process.env.MONGODB_DB_NAME!
    );
    await mongoAccessor.connect();
    
    try {
      // Check if user already exists
      const existingUsers = await mongoAccessor.find('users', { 
        email: email.toLowerCase() 
      });
      
      if (existingUsers.length > 0) {
        // Update existing user
        const user = existingUsers[0];
        await mongoAccessor.update('users', user._id.toString(), {
          extensionAccess: true,
          extensionActivatedAt: new Date(),
          accessCode: accessCode || 'BETA2024'
        });
        
        await mongoAccessor.disconnect();
        
        return NextResponse.json({
          message: 'User updated with extension access',
          user: {
            email: user.email,
            name: user.name || name,
            extensionAccess: true
          }
        });
      } else {
        // Create new user
        const newUserData = {
          email: email.toLowerCase(),
          name: name || email.split('@')[0],
          role: 'tester',
          extensionAccess: true,
          extensionActivatedAt: new Date(),
          accessCode: accessCode || 'BETA2024',
          createdAt: new Date()
        };
        
        const newUserId = await mongoAccessor.create('users', newUserData);
        
        await mongoAccessor.disconnect();
        
        return NextResponse.json({
          message: 'User created with extension access',
          user: {
            id: newUserId,
            email: newUserData.email,
            name: newUserData.name,
            extensionAccess: true
          }
        });
      }
      
    } catch (error) {
      await mongoAccessor.disconnect();
      throw error;
    }
    
  } catch (error) {
    console.error('Failed to add extension user:', error);
    return NextResponse.json(
      { message: 'Failed to add user' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check if requester is admin
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      );
    }

    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json(
        { message: 'Email is required' },
        { status: 400 }
      );
    }

    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI!,
      process.env.MONGODB_DB_NAME!
    );
    await mongoAccessor.connect();
    
    try {
      // Find user
      const users = await mongoAccessor.find('users', { 
        email: email.toLowerCase() 
      });
      
      if (users.length === 0) {
        await mongoAccessor.disconnect();
        return NextResponse.json(
          { message: 'User not found' },
          { status: 404 }
        );
      }
      
      // Remove extension access
      const user = users[0];
      await mongoAccessor.update('users', user._id.toString(), {
        extensionAccess: false,
        extensionDeactivatedAt: new Date()
      });
      
      await mongoAccessor.disconnect();
      
      return NextResponse.json({
        message: 'Extension access revoked',
        email: email.toLowerCase()
      });
      
    } catch (error) {
      await mongoAccessor.disconnect();
      throw error;
    }
    
  } catch (error) {
    console.error('Failed to remove extension user:', error);
    return NextResponse.json(
      { message: 'Failed to remove user' },
      { status: 500 }
    );
  }
}

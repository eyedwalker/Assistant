import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, company, role = 'user' } = await request.json();

    // Validate input
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      );
    }

    // Initialize MongoDB
    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI!,
      process.env.MONGODB_DB_NAME!
    );
    await mongoAccessor.connect();

    try {
      // Check if user already exists
      const existingUsers = await mongoAccessor.find('users', { email });
      if (existingUsers.length > 0) {
        return NextResponse.json(
          { error: 'User already exists' },
          { status: 409 }
        );
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const newUser = {
        userId: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email,
        password: hashedPassword,
        name,
        company,
        role,
        tenantId: company ? `tenant_${company.toLowerCase().replace(/\s+/g, '_')}` : 'default',
        accessLevel: role === 'admin' ? 'COMPANY' : 'ACCOUNT',
        permissions: role === 'admin' 
          ? ['chat', 'upload', 'analyze', 'manage_users', 'view_analytics']
          : ['chat', 'upload', 'analyze'],
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await mongoAccessor.create('users', newUser);

      // Remove password from response
      const { password: _, ...userWithoutPassword } = newUser;

      return NextResponse.json({
        success: true,
        message: 'User created successfully',
        user: userWithoutPassword
      }, { status: 201 });

    } finally {
      await mongoAccessor.disconnect();
    }

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Failed to register user' },
      { status: 500 }
    );
  }
}

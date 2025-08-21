import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';

// List of allowed test users (email addresses)
const ALLOWED_TEST_USERS = [
  'daviwa2@vsp.com',
  'test1@vsp.com',
  'test2@vsp.com',
  'admin@vsp.com'
];

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { valid: false, message: 'No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    
    try {
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET || 'secret') as any;
      
      // Check if user is in allowed list
      const hasExtensionAccess = ALLOWED_TEST_USERS.includes(decoded.email?.toLowerCase());
      
      // Optional: Check database for more dynamic access control
      if (hasExtensionAccess) {
        const mongoAccessor = new MongoDBAccessor();
        await mongoAccessor.connect();
        
        const users = await mongoAccessor.find('users', { 
          email: decoded.email,
          extensionAccess: true 
        });
        
        await mongoAccessor.disconnect();
        
        // If user exists in DB with extension access, allow
        const dbHasAccess = users.length > 0;
        
        return NextResponse.json({
          valid: true,
          hasExtensionAccess: dbHasAccess || hasExtensionAccess,
          email: decoded.email,
          role: decoded.role || 'user'
        });
      }
      
      return NextResponse.json({
        valid: true,
        hasExtensionAccess: false,
        message: 'User not authorized for extension access'
      });
      
    } catch (error) {
      console.error('Token verification failed:', error);
      return NextResponse.json(
        { valid: false, message: 'Invalid token' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Extension validation error:', error);
    return NextResponse.json(
      { valid: false, error: 'Validation failed' },
      { status: 500 }
    );
  }
}

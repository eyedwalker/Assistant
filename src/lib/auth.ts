import { NextAuthOptions } from 'next-auth';
import { MongoDBAdapter } from '@next-auth/mongodb-adapter';
import { MongoClient } from 'mongodb';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { User, AccessLevel, UserRole, Permission } from '@/types';
import mongoService from '@/lib/services/mongodb-service';

const client = new MongoClient(process.env.MONGODB_URI!);
const clientPromise = Promise.resolve(client);

export const authOptions: NextAuthOptions = {
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const user = await mongoService.getUserByEmail(credentials.email);
          
          if (!user || !user.isActive) {
            return null;
          }

          // In a real implementation, you'd have a password field
          // For now, we'll create a simple check
          const isValidPassword = await bcrypt.compare(
            credentials.password, 
            user.email // Temporary - replace with actual password hash
          );

          if (!isValidPassword) {
            return null;
          }

          // Update last login
          await mongoService.updateUser(user.id, {
            lastLoginAt: new Date()
          });

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            accessLevel: user.accessLevel,
            accessId: user.accessId,
            permissions: user.permissions,
          };
        } catch (error) {
          console.error('Authentication error:', error);
          return null;
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '60') * 60, // Convert to seconds
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    maxAge: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '60') * 60,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.accessLevel = user.accessLevel;
        token.accessId = user.accessId;
        token.permissions = user.permissions;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!;
        session.user.role = token.role as UserRole;
        session.user.accessLevel = token.accessLevel as AccessLevel;
        session.user.accessId = token.accessId as string;
        session.user.permissions = token.permissions as Permission[];
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
  },
  events: {
    async signIn({ user, isNewUser }) {
      console.log(`User ${user.email} signed in. New user: ${isNewUser}`);
    },
    async signOut({ token }) {
      console.log(`User ${token?.email} signed out`);
    },
  },
};

// Utility functions for authorization
export function hasPermission(
  userPermissions: Permission[], 
  requiredPermission: Permission
): boolean {
  return userPermissions.includes(requiredPermission) || 
         userPermissions.includes(Permission.ADMIN_ACCESS);
}

export function canAccessDocument(
  userAccessLevel: AccessLevel,
  userAccessId: string,
  documentAccessLevel: AccessLevel,
  documentAccessId: string
): boolean {
  // Public documents are accessible to everyone
  if (documentAccessLevel === AccessLevel.PUBLIC) {
    return true;
  }

  // Check if user has access to this specific resource
  return userAccessLevel === documentAccessLevel && userAccessId === documentAccessId;
}

export function canManageUsers(userRole: UserRole): boolean {
  return userRole === UserRole.ADMIN || userRole === UserRole.MANAGER;
}

// Middleware helper for API routes
export async function requireAuth(req: any): Promise<{
  user: User | null;
  error?: string;
}> {
  try {
    // In a real implementation, you'd extract and verify the JWT token
    // For now, this is a placeholder
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null, error: 'No authorization token provided' };
    }

    const token = authHeader.substring(7);
    // Verify JWT token here
    
    return { user: null }; // Placeholder
  } catch (error) {
    return { user: null, error: 'Invalid token' };
  }
}

// Role-based access control helper
export function requireRole(allowedRoles: UserRole[]) {
  return (userRole: UserRole): boolean => {
    return allowedRoles.includes(userRole);
  };
}

// Access level validation
export function validateAccessLevel(
  userAccessLevel: AccessLevel,
  userAccessId: string,
  requiredAccessLevel: AccessLevel,
  requiredAccessId: string
): boolean {
  // Admin users can access everything
  if (userAccessLevel === AccessLevel.PUBLIC && userAccessId === 'admin') {
    return true;
  }

  // Public access is allowed for everyone
  if (requiredAccessLevel === AccessLevel.PUBLIC) {
    return true;
  }

  // Exact match required for non-public access
  return userAccessLevel === requiredAccessLevel && userAccessId === requiredAccessId;
}

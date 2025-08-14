import NextAuth from "next-auth"
import { JWT } from "next-auth/jwt"
import { AccessLevel, UserRole, Permission } from "./index"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: UserRole
      accessLevel: AccessLevel
      accessId: string
      permissions: Permission[]
    }
  }

  interface User {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
    role: UserRole
    accessLevel: AccessLevel
    accessId: string
    permissions: Permission[]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole
    accessLevel: AccessLevel
    accessId: string
    permissions: Permission[]
  }
}

// Define the types used in the auth system
export type UserRole = 'admin' | 'user' | 'viewer'
export type Permission = string

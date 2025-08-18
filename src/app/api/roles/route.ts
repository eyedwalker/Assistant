import { NextRequest, NextResponse } from 'next/server';
import { UserManager } from '@/lib/managers/UserManager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get('roleId');

    const userManager = new UserManager();

    if (roleId) {
      // Get specific role
      const role = await userManager.getRoleById(roleId);
      return NextResponse.json({
        success: true,
        role
      });
    } else {
      // Get all roles
      const roles = await userManager.getAllRoles();
      return NextResponse.json({
        success: true,
        roles,
        count: roles.length
      });
    }

  } catch (error) {
    console.error('❌ Error in roles API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch roles' },
      { status: 500 }
    );
  }
}

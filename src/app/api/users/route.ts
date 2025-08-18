import { NextRequest, NextResponse } from 'next/server';
import { UserManager } from '@/lib/managers/UserManager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || 'demo-tenant';
    const roleId = searchParams.get('roleId');
    const email = searchParams.get('email');
    const userId = searchParams.get('userId');
    const action = searchParams.get('action') || 'list';

    const userManager = new UserManager();

    switch (action) {
      case 'list':
        if (roleId) {
          const users = await userManager.getUsersByRole(roleId, tenantId);
          return NextResponse.json({
            success: true,
            users,
            count: users.length
          });
        } else {
          const users = await userManager.getAllUsers(tenantId);
          return NextResponse.json({
            success: true,
            users,
            count: users.length
          });
        }

      case 'get':
        if (userId) {
          const user = await userManager.getUserById(userId, tenantId);
          return NextResponse.json({
            success: true,
            user
          });
        } else if (email) {
          const user = await userManager.getUserByEmail(email, tenantId);
          return NextResponse.json({
            success: true,
            user
          });
        } else {
          return NextResponse.json(
            { error: 'userId or email is required for get action' },
            { status: 400 }
          );
        }

      case 'compliance':
        const dashboard = await userManager.getComplianceDashboard(tenantId);
        return NextResponse.json({
          success: true,
          dashboard
        });

      case 'deadlines':
        const daysAhead = parseInt(searchParams.get('daysAhead') || '30');
        const usersWithDeadlines = await userManager.getUsersWithUpcomingDeadlines(tenantId, daysAhead);
        return NextResponse.json({
          success: true,
          users: usersWithDeadlines,
          count: usersWithDeadlines.length
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: list, get, compliance, or deadlines' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('❌ Error in users API:', error);
    return NextResponse.json(
      { error: 'Failed to process user request' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    const userManager = new UserManager();

    switch (action) {
      case 'initialize':
        const result = await userManager.initializeUsersAndRoles();
        return NextResponse.json(result);

      case 'assign-training':
        const { userId, moduleId, dueDate, priority = 'medium', tenantId = 'demo-tenant' } = data;
        
        if (!userId || !moduleId || !dueDate) {
          return NextResponse.json(
            { error: 'userId, moduleId, and dueDate are required' },
            { status: 400 }
          );
        }

        const assigned = await userManager.assignTrainingToUser(
          userId, 
          moduleId, 
          new Date(dueDate), 
          priority,
          tenantId
        );

        return NextResponse.json({
          success: assigned,
          message: assigned ? 'Training assigned successfully' : 'Failed to assign training'
        });

      case 'update-profile':
        const { userId: updateUserId, updates, tenantId: updateTenantId = 'demo-tenant' } = data;
        
        if (!updateUserId || !updates) {
          return NextResponse.json(
            { error: 'userId and updates are required' },
            { status: 400 }
          );
        }

        const updatedUser = await userManager.updateUserTrainingProfile(
          updateUserId, 
          updates, 
          updateTenantId
        );

        return NextResponse.json({
          success: !!updatedUser,
          user: updatedUser,
          message: updatedUser ? 'Profile updated successfully' : 'Failed to update profile'
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: initialize, assign-training, or update-profile' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('❌ Error in users POST API:', error);
    return NextResponse.json(
      { error: 'Failed to process user request' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { UserManager } from '@/lib/managers/UserManager';

export async function POST(request: NextRequest) {
  try {
    console.log('👥 Starting user and role system demonstration...');

    const userManager = new UserManager();
    
    // Initialize users and roles
    const initResult = await userManager.initializeUsersAndRoles();
    
    if (!initResult.success) {
      return NextResponse.json({
        error: 'Failed to initialize users and roles',
        details: initResult.message
      }, { status: 500 });
    }

    // Get all users and roles for demonstration
    const users = await userManager.getAllUsers('demo-tenant');
    const roles = await userManager.getAllRoles();
    const complianceDashboard = await userManager.getComplianceDashboard('demo-tenant');

    // Generate summary statistics
    const departmentCounts = users.reduce((acc, user) => {
      const dept = user.department || 'Unassigned';
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const roleCounts = users.reduce((acc, user) => {
      const role = roles.find(r => r.id === user.roleId);
      const roleName = role?.displayName || 'Unknown';
      acc[roleName] = (acc[roleName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const complianceBreakdown = {
      compliant: users.filter(u => u.trainingProfile.complianceStatus === 'compliant').length,
      warning: users.filter(u => u.trainingProfile.complianceStatus === 'warning').length,
      overdue: users.filter(u => u.trainingProfile.complianceStatus === 'overdue').length
    };

    console.log(`✅ User system demo completed! ${users.length} users, ${roles.length} roles`);

    return NextResponse.json({
      success: true,
      message: `Successfully initialized ${users.length} users across ${roles.length} roles`,
      summary: {
        totalUsers: users.length,
        totalRoles: roles.length,
        departments: Object.keys(departmentCounts).length,
        complianceRate: `${Math.round((complianceBreakdown.compliant / users.length) * 100)}%`
      },
      users: users.map(user => ({
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: roles.find(r => r.id === user.roleId)?.displayName || 'Unknown',
        department: user.department,
        complianceStatus: user.trainingProfile.complianceStatus,
        trainingHours: user.trainingProfile.trainingHours,
        completedModules: user.trainingProfile.completedModules.length,
        requiredModules: user.trainingProfile.requiredModules.length,
        certifications: user.trainingProfile.certifications.length,
        upcomingDeadlines: user.trainingProfile.upcomingDeadlines.length
      })),
      roles: roles.map(role => ({
        id: role.id,
        name: role.displayName,
        description: role.description,
        accessLevel: role.accessLevel,
        permissions: role.permissions.length,
        trainingRequirements: role.trainingRequirements.length,
        userCount: users.filter(u => u.roleId === role.id).length
      })),
      analytics: {
        departmentBreakdown: departmentCounts,
        roleBreakdown: roleCounts,
        complianceBreakdown,
        totalTrainingHours: users.reduce((sum, u) => sum + u.trainingProfile.trainingHours, 0),
        averageTrainingHours: Math.round(
          users.reduce((sum, u) => sum + u.trainingProfile.trainingHours, 0) / users.length
        )
      },
      complianceDashboard,
      testScenarios: [
        {
          name: 'New Employee Onboarding',
          description: 'Emily Davis just started and needs to complete required training',
          user: 'emily.newbie@eyecareclinic.com',
          actions: ['Complete company orientation', 'Take HIPAA training', 'Finish safety procedures']
        },
        {
          name: 'Manager Compliance Review',
          description: 'Sarah Johnson (Practice Manager) has upcoming HIPAA renewal',
          user: 'sarah.manager@eyecareclinic.com',
          actions: ['Review compliance status', 'Complete HIPAA renewal', 'Monitor team progress']
        },
        {
          name: 'Role-Based Training',
          description: 'Different roles have different training requirements',
          user: 'Various',
          actions: ['Opticians need lens technology updates', 'Billing staff need claims training', 'Technicians need equipment training']
        }
      ],
      nextSteps: [
        'Use /api/training/generate-module to create role-specific training',
        'Test assessment system with different user roles',
        'Monitor compliance dashboard for training deadlines',
        'Generate certificates for completed training'
      ]
    });

  } catch (error) {
    console.error('❌ Error in user demo:', error);
    return NextResponse.json({
      error: 'User system demo failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    const userManager = new UserManager();

    if (action === 'status') {
      const users = await userManager.getAllUsers('demo-tenant');
      const roles = await userManager.getAllRoles();

      return NextResponse.json({
        success: true,
        status: {
          usersInitialized: users.length > 0,
          rolesInitialized: roles.length > 0,
          totalUsers: users.length,
          totalRoles: roles.length,
          systemReady: users.length > 0 && roles.length > 0
        },
        quickStats: {
          compliantUsers: users.filter(u => u.trainingProfile.complianceStatus === 'compliant').length,
          usersWithDeadlines: users.filter(u => u.trainingProfile.upcomingDeadlines.length > 0).length,
          totalCertifications: users.reduce((sum, u) => sum + u.trainingProfile.certifications.length, 0)
        }
      });
    }

    return NextResponse.json({
      error: 'Invalid action. Use ?action=status'
    }, { status: 400 });

  } catch (error) {
    console.error('❌ Error getting user system status:', error);
    return NextResponse.json({
      error: 'Failed to get user system status'
    }, { status: 500 });
  }
}

import { MongoDBAccessor } from '../accessors/MongoDBAccessor';
import { 
  User, 
  UserRole, 
  UserTrainingProfile, 
  TrainingDeadline,
  EYECARE_ROLES,
  TEST_USERS
} from '../../types/user-roles';

export class UserManager {
  private mongoAccessor: MongoDBAccessor;

  constructor() {
    this.mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI || 'mongodb://localhost:27017',
      process.env.MONGODB_DB || 'ai-assistant'
    );
  }

  /**
   * Initialize the system with predefined roles and test users
   */
  async initializeUsersAndRoles(): Promise<{ success: boolean; message: string; stats: any }> {
    try {
      console.log('👥 Initializing users and roles for training system...');

      // Clear existing data (for demo purposes)
      await this.mongoAccessor.deleteMany('user_roles', {});
      await this.mongoAccessor.deleteMany('users', {});

      // Insert predefined roles
      let rolesCreated = 0;
      for (const role of EYECARE_ROLES) {
        await this.mongoAccessor.create('user_roles', role);
        rolesCreated++;
      }

      // Insert test users
      let usersCreated = 0;
      for (const user of TEST_USERS) {
        await this.mongoAccessor.create('users', user);
        usersCreated++;
      }

      console.log(`✅ Initialized ${rolesCreated} roles and ${usersCreated} users`);

      return {
        success: true,
        message: `Successfully initialized ${rolesCreated} roles and ${usersCreated} test users`,
        stats: {
          rolesCreated,
          usersCreated,
          departments: [...new Set(TEST_USERS.map(u => u.department))],
          accessLevels: [...new Set(EYECARE_ROLES.map(r => r.accessLevel))]
        }
      };

    } catch (error) {
      console.error('❌ Error initializing users and roles:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to initialize users and roles',
        stats: {}
      };
    }
  }

  /**
   * Get all users with their roles and training profiles
   */
  async getAllUsers(tenantId: string): Promise<User[]> {
    try {
      const users = await this.mongoAccessor.find('users', { tenantId, isActive: true });
      return users.map(this.mapToUser);
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      return [];
    }
  }

  /**
   * Get user by ID with role information
   */
  async getUserById(userId: string, tenantId: string): Promise<User | null> {
    try {
      const user = await this.mongoAccessor.findOne('users', { id: userId, tenantId });
      return user ? this.mapToUser(user) : null;
    } catch (error) {
      console.error('❌ Error fetching user:', error);
      return null;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string, tenantId: string): Promise<User | null> {
    try {
      const user = await this.mongoAccessor.findOne('users', { email, tenantId });
      return user ? this.mapToUser(user) : null;
    } catch (error) {
      console.error('❌ Error fetching user by email:', error);
      return null;
    }
  }

  /**
   * Get users by role
   */
  async getUsersByRole(roleId: string, tenantId: string): Promise<User[]> {
    try {
      const users = await this.mongoAccessor.find('users', { roleId, tenantId, isActive: true });
      return users.map(this.mapToUser);
    } catch (error) {
      console.error('❌ Error fetching users by role:', error);
      return [];
    }
  }

  /**
   * Get all roles
   */
  async getAllRoles(): Promise<UserRole[]> {
    try {
      const roles = await this.mongoAccessor.find('user_roles', { isActive: true });
      return roles.map(this.mapToUserRole);
    } catch (error) {
      console.error('❌ Error fetching roles:', error);
      return [];
    }
  }

  /**
   * Get role by ID
   */
  async getRoleById(roleId: string): Promise<UserRole | null> {
    try {
      const role = await this.mongoAccessor.findOne('user_roles', { id: roleId });
      return role ? this.mapToUserRole(role) : null;
    } catch (error) {
      console.error('❌ Error fetching role:', error);
      return null;
    }
  }

  /**
   * Update user training profile
   */
  async updateUserTrainingProfile(
    userId: string, 
    updates: Partial<UserTrainingProfile>,
    tenantId: string
  ): Promise<User | null> {
    try {
      const user = await this.getUserById(userId, tenantId);
      if (!user) {
        throw new Error('User not found');
      }

      const updatedProfile = {
        ...user.trainingProfile,
        ...updates
      };

      const updatedUser = {
        ...user,
        trainingProfile: updatedProfile,
        updatedAt: new Date()
      };

      await this.mongoAccessor.update('users', userId, updatedUser);
      return updatedUser;

    } catch (error) {
      console.error('❌ Error updating user training profile:', error);
      return null;
    }
  }

  /**
   * Get users with upcoming training deadlines
   */
  async getUsersWithUpcomingDeadlines(tenantId: string, daysAhead: number = 30): Promise<User[]> {
    try {
      const users = await this.getAllUsers(tenantId);
      const cutoffDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);

      return users.filter(user => 
        user.trainingProfile.upcomingDeadlines.some(deadline => 
          deadline.dueDate <= cutoffDate
        )
      );
    } catch (error) {
      console.error('❌ Error fetching users with deadlines:', error);
      return [];
    }
  }

  /**
   * Get compliance dashboard data
   */
  async getComplianceDashboard(tenantId: string): Promise<any> {
    try {
      const users = await this.getAllUsers(tenantId);
      
      const complianceStats = {
        totalUsers: users.length,
        compliant: users.filter(u => u.trainingProfile.complianceStatus === 'compliant').length,
        warning: users.filter(u => u.trainingProfile.complianceStatus === 'warning').length,
        overdue: users.filter(u => u.trainingProfile.complianceStatus === 'overdue').length,
        totalTrainingHours: users.reduce((sum, u) => sum + u.trainingProfile.trainingHours, 0),
        averageTrainingHours: 0
      };

      complianceStats.averageTrainingHours = complianceStats.totalUsers > 0 
        ? Math.round(complianceStats.totalTrainingHours / complianceStats.totalUsers)
        : 0;

      const upcomingDeadlines = users
        .flatMap(user => 
          user.trainingProfile.upcomingDeadlines.map(deadline => ({
            ...deadline,
            userId: user.id,
            userName: `${user.firstName} ${user.lastName}`,
            userEmail: user.email
          }))
        )
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
        .slice(0, 10); // Top 10 upcoming deadlines

      const departmentStats = this.calculateDepartmentStats(users);
      const roleStats = this.calculateRoleStats(users);

      return {
        compliance: complianceStats,
        upcomingDeadlines,
        departmentStats,
        roleStats,
        lastUpdated: new Date()
      };

    } catch (error) {
      console.error('❌ Error generating compliance dashboard:', error);
      return null;
    }
  }

  /**
   * Assign training module to user
   */
  async assignTrainingToUser(
    userId: string, 
    moduleId: string, 
    dueDate: Date,
    priority: 'high' | 'medium' | 'low',
    tenantId: string
  ): Promise<boolean> {
    try {
      const user = await this.getUserById(userId, tenantId);
      if (!user) {
        throw new Error('User not found');
      }

      // Add to required modules if not already there
      if (!user.trainingProfile.requiredModules.includes(moduleId)) {
        user.trainingProfile.requiredModules.push(moduleId);
      }

      // Add to upcoming deadlines
      const deadline: TrainingDeadline = {
        moduleId,
        moduleName: `Training Module ${moduleId}`, // Would be fetched from actual module
        dueDate,
        priority,
        isOverdue: dueDate < new Date()
      };

      user.trainingProfile.upcomingDeadlines.push(deadline);

      await this.updateUserTrainingProfile(userId, user.trainingProfile, tenantId);
      return true;

    } catch (error) {
      console.error('❌ Error assigning training to user:', error);
      return false;
    }
  }

  // Private helper methods

  private calculateDepartmentStats(users: User[]): any {
    const departments = [...new Set(users.map(u => u.department).filter(Boolean))];
    
    return departments.map(dept => {
      const deptUsers = users.filter(u => u.department === dept);
      return {
        department: dept,
        totalUsers: deptUsers.length,
        compliant: deptUsers.filter(u => u.trainingProfile.complianceStatus === 'compliant').length,
        averageHours: Math.round(
          deptUsers.reduce((sum, u) => sum + u.trainingProfile.trainingHours, 0) / deptUsers.length
        )
      };
    });
  }

  private calculateRoleStats(users: User[]): any {
    const roles = [...new Set(users.map(u => u.roleId))];
    
    return roles.map(roleId => {
      const roleUsers = users.filter(u => u.roleId === roleId);
      return {
        roleId,
        totalUsers: roleUsers.length,
        compliant: roleUsers.filter(u => u.trainingProfile.complianceStatus === 'compliant').length,
        averageHours: Math.round(
          roleUsers.reduce((sum, u) => sum + u.trainingProfile.trainingHours, 0) / roleUsers.length
        )
      };
    });
  }

  private mapToUser(doc: any): User {
    return {
      id: doc._id?.toString() || doc.id,
      email: doc.email,
      firstName: doc.firstName,
      lastName: doc.lastName,
      roleId: doc.roleId,
      tenantId: doc.tenantId,
      department: doc.department,
      hireDate: doc.hireDate ? new Date(doc.hireDate) : undefined,
      isActive: doc.isActive !== false,
      lastLogin: doc.lastLogin ? new Date(doc.lastLogin) : undefined,
      trainingProfile: doc.trainingProfile || {
        userId: doc.id,
        completedModules: [],
        requiredModules: [],
        certifications: [],
        trainingHours: 0,
        complianceStatus: 'warning',
        upcomingDeadlines: []
      },
      createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date()
    };
  }

  private mapToUserRole(doc: any): UserRole {
    return {
      id: doc._id?.toString() || doc.id,
      name: doc.name,
      displayName: doc.displayName,
      description: doc.description,
      permissions: doc.permissions || [],
      trainingRequirements: doc.trainingRequirements || [],
      accessLevel: doc.accessLevel || 'PUBLIC',
      isActive: doc.isActive !== false
    };
  }
}

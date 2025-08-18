// User Roles and Permissions for Training System

export interface UserRole {
  id: string;
  name: string;
  displayName: string;
  description: string;
  permissions: Permission[];
  trainingRequirements: TrainingRequirement[];
  accessLevel: 'PUBLIC' | 'ACCOUNT' | 'COMPANY' | 'OFFICE';
  isActive: boolean;
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'execute';
  description: string;
}

export interface TrainingRequirement {
  moduleId: string;
  required: boolean;
  renewalPeriod?: number; // in months
  priority: 'high' | 'medium' | 'low';
  deadline?: Date;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  tenantId: string;
  department?: string;
  hireDate?: Date;
  isActive: boolean;
  lastLogin?: Date;
  trainingProfile: UserTrainingProfile;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserTrainingProfile {
  userId: string;
  completedModules: string[];
  requiredModules: string[];
  certifications: string[];
  trainingHours: number;
  lastTrainingDate?: Date;
  complianceStatus: 'compliant' | 'warning' | 'overdue';
  upcomingDeadlines: TrainingDeadline[];
}

export interface TrainingDeadline {
  moduleId: string;
  moduleName: string;
  dueDate: Date;
  priority: 'high' | 'medium' | 'low';
  isOverdue: boolean;
}

// Predefined roles for eyecare practices
export const EYECARE_ROLES: UserRole[] = [
  {
    id: 'practice-manager',
    name: 'practice_manager',
    displayName: 'Practice Manager',
    description: 'Manages overall practice operations, staff, and compliance',
    permissions: [
      { id: 'training-admin', name: 'training_admin', resource: 'training', action: 'create', description: 'Create and manage training modules' },
      { id: 'user-management', name: 'user_management', resource: 'users', action: 'create', description: 'Manage user accounts and roles' },
      { id: 'analytics-view', name: 'analytics_view', resource: 'analytics', action: 'read', description: 'View training analytics and reports' },
      { id: 'compliance-manage', name: 'compliance_manage', resource: 'compliance', action: 'update', description: 'Manage compliance requirements' }
    ],
    trainingRequirements: [
      { moduleId: 'leadership-fundamentals', required: true, renewalPeriod: 24, priority: 'high' },
      { moduleId: 'hipaa-compliance', required: true, renewalPeriod: 12, priority: 'high' },
      { moduleId: 'practice-management', required: true, renewalPeriod: 24, priority: 'medium' }
    ],
    accessLevel: 'OFFICE',
    isActive: true
  },
  {
    id: 'front-office-supervisor',
    name: 'front_office_supervisor',
    displayName: 'Front Office Supervisor',
    description: 'Supervises front office operations and patient services',
    permissions: [
      { id: 'training-assign', name: 'training_assign', resource: 'training', action: 'update', description: 'Assign training to team members' },
      { id: 'progress-view', name: 'progress_view', resource: 'progress', action: 'read', description: 'View team training progress' },
      { id: 'schedule-manage', name: 'schedule_manage', resource: 'scheduling', action: 'update', description: 'Manage staff schedules' }
    ],
    trainingRequirements: [
      { moduleId: 'front-office-operations', required: true, renewalPeriod: 18, priority: 'high' },
      { moduleId: 'customer-service', required: true, renewalPeriod: 12, priority: 'high' },
      { moduleId: 'hipaa-compliance', required: true, renewalPeriod: 12, priority: 'high' },
      { moduleId: 'insurance-billing', required: true, renewalPeriod: 24, priority: 'medium' }
    ],
    accessLevel: 'COMPANY',
    isActive: true
  },
  {
    id: 'front-office-staff',
    name: 'front_office_staff',
    displayName: 'Front Office Staff',
    description: 'Handles patient check-in, scheduling, and administrative tasks',
    permissions: [
      { id: 'training-take', name: 'training_take', resource: 'training', action: 'read', description: 'Take assigned training modules' },
      { id: 'progress-self', name: 'progress_self', resource: 'progress', action: 'read', description: 'View own training progress' },
      { id: 'patient-basic', name: 'patient_basic', resource: 'patients', action: 'read', description: 'Basic patient information access' }
    ],
    trainingRequirements: [
      { moduleId: 'front-office-basics', required: true, renewalPeriod: 12, priority: 'high' },
      { moduleId: 'patient-communication', required: true, renewalPeriod: 18, priority: 'high' },
      { moduleId: 'hipaa-compliance', required: true, renewalPeriod: 12, priority: 'high' },
      { moduleId: 'appointment-scheduling', required: true, renewalPeriod: 24, priority: 'medium' }
    ],
    accessLevel: 'ACCOUNT',
    isActive: true
  },
  {
    id: 'optician',
    name: 'optician',
    displayName: 'Licensed Optician',
    description: 'Fits and dispenses eyewear, handles optical services',
    permissions: [
      { id: 'training-take', name: 'training_take', resource: 'training', action: 'read', description: 'Take assigned training modules' },
      { id: 'progress-self', name: 'progress_self', resource: 'progress', action: 'read', description: 'View own training progress' },
      { id: 'optical-manage', name: 'optical_manage', resource: 'optical', action: 'update', description: 'Manage optical services' }
    ],
    trainingRequirements: [
      { moduleId: 'optical-fundamentals', required: true, renewalPeriod: 24, priority: 'high' },
      { moduleId: 'frame-fitting', required: true, renewalPeriod: 18, priority: 'high' },
      { moduleId: 'lens-technology', required: true, renewalPeriod: 12, priority: 'medium' },
      { moduleId: 'hipaa-compliance', required: true, renewalPeriod: 12, priority: 'high' }
    ],
    accessLevel: 'ACCOUNT',
    isActive: true
  },
  {
    id: 'optometric-technician',
    name: 'optometric_technician',
    displayName: 'Optometric Technician',
    description: 'Assists with patient care and clinical procedures',
    permissions: [
      { id: 'training-take', name: 'training_take', resource: 'training', action: 'read', description: 'Take assigned training modules' },
      { id: 'progress-self', name: 'progress_self', resource: 'progress', action: 'read', description: 'View own training progress' },
      { id: 'clinical-assist', name: 'clinical_assist', resource: 'clinical', action: 'read', description: 'Assist with clinical procedures' }
    ],
    trainingRequirements: [
      { moduleId: 'clinical-procedures', required: true, renewalPeriod: 12, priority: 'high' },
      { moduleId: 'patient-care', required: true, renewalPeriod: 18, priority: 'high' },
      { moduleId: 'equipment-operation', required: true, renewalPeriod: 24, priority: 'medium' },
      { moduleId: 'hipaa-compliance', required: true, renewalPeriod: 12, priority: 'high' }
    ],
    accessLevel: 'ACCOUNT',
    isActive: true
  },
  {
    id: 'billing-specialist',
    name: 'billing_specialist',
    displayName: 'Billing Specialist',
    description: 'Handles insurance claims, billing, and financial operations',
    permissions: [
      { id: 'training-take', name: 'training_take', resource: 'training', action: 'read', description: 'Take assigned training modules' },
      { id: 'progress-self', name: 'progress_self', resource: 'progress', action: 'read', description: 'View own training progress' },
      { id: 'billing-manage', name: 'billing_manage', resource: 'billing', action: 'update', description: 'Manage billing and claims' }
    ],
    trainingRequirements: [
      { moduleId: 'insurance-billing', required: true, renewalPeriod: 12, priority: 'high' },
      { moduleId: 'claims-processing', required: true, renewalPeriod: 18, priority: 'high' },
      { moduleId: 'financial-procedures', required: true, renewalPeriod: 24, priority: 'medium' },
      { moduleId: 'hipaa-compliance', required: true, renewalPeriod: 12, priority: 'high' }
    ],
    accessLevel: 'ACCOUNT',
    isActive: true
  },
  {
    id: 'new-employee',
    name: 'new_employee',
    displayName: 'New Employee',
    description: 'Recently hired employee completing onboarding training',
    permissions: [
      { id: 'training-take', name: 'training_take', resource: 'training', action: 'read', description: 'Take assigned training modules' },
      { id: 'progress-self', name: 'progress_self', resource: 'progress', action: 'read', description: 'View own training progress' }
    ],
    trainingRequirements: [
      { moduleId: 'company-orientation', required: true, priority: 'high', deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }, // 7 days
      { moduleId: 'hipaa-compliance', required: true, priority: 'high', deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) }, // 14 days
      { moduleId: 'safety-procedures', required: true, priority: 'high', deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } // 30 days
    ],
    accessLevel: 'PUBLIC',
    isActive: true
  }
];

export const TEST_USERS: User[] = [
  {
    id: 'user-001',
    email: 'sarah.manager@eyecareclinic.com',
    firstName: 'Sarah',
    lastName: 'Johnson',
    roleId: 'practice-manager',
    tenantId: 'demo-tenant',
    department: 'Administration',
    hireDate: new Date('2020-03-15'),
    isActive: true,
    trainingProfile: {
      userId: 'user-001',
      completedModules: ['leadership-fundamentals', 'practice-management'],
      requiredModules: ['hipaa-compliance'],
      certifications: ['leadership-cert-2023', 'practice-mgmt-cert-2024'],
      trainingHours: 45,
      lastTrainingDate: new Date('2024-06-15'),
      complianceStatus: 'warning',
      upcomingDeadlines: [
        {
          moduleId: 'hipaa-compliance',
          moduleName: 'HIPAA Compliance Training',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          priority: 'high',
          isOverdue: false
        }
      ]
    },
    createdAt: new Date('2020-03-15'),
    updatedAt: new Date()
  },
  {
    id: 'user-002',
    email: 'mike.supervisor@eyecareclinic.com',
    firstName: 'Mike',
    lastName: 'Chen',
    roleId: 'front-office-supervisor',
    tenantId: 'demo-tenant',
    department: 'Front Office',
    hireDate: new Date('2021-08-10'),
    isActive: true,
    trainingProfile: {
      userId: 'user-002',
      completedModules: ['front-office-operations', 'customer-service'],
      requiredModules: ['insurance-billing'],
      certifications: ['front-office-cert-2024'],
      trainingHours: 32,
      lastTrainingDate: new Date('2024-05-20'),
      complianceStatus: 'compliant',
      upcomingDeadlines: []
    },
    createdAt: new Date('2021-08-10'),
    updatedAt: new Date()
  },
  {
    id: 'user-003',
    email: 'jessica.frontdesk@eyecareclinic.com',
    firstName: 'Jessica',
    lastName: 'Rodriguez',
    roleId: 'front-office-staff',
    tenantId: 'demo-tenant',
    department: 'Front Office',
    hireDate: new Date('2023-01-20'),
    isActive: true,
    trainingProfile: {
      userId: 'user-003',
      completedModules: ['front-office-basics', 'patient-communication'],
      requiredModules: ['appointment-scheduling'],
      certifications: ['front-office-basics-cert-2023'],
      trainingHours: 28,
      lastTrainingDate: new Date('2024-04-10'),
      complianceStatus: 'compliant',
      upcomingDeadlines: []
    },
    createdAt: new Date('2023-01-20'),
    updatedAt: new Date()
  },
  {
    id: 'user-004',
    email: 'david.optician@eyecareclinic.com',
    firstName: 'David',
    lastName: 'Thompson',
    roleId: 'optician',
    tenantId: 'demo-tenant',
    department: 'Optical',
    hireDate: new Date('2019-11-05'),
    isActive: true,
    trainingProfile: {
      userId: 'user-004',
      completedModules: ['optical-fundamentals', 'frame-fitting'],
      requiredModules: ['lens-technology'],
      certifications: ['licensed-optician-2024', 'frame-fitting-cert-2023'],
      trainingHours: 52,
      lastTrainingDate: new Date('2024-03-25'),
      complianceStatus: 'compliant',
      upcomingDeadlines: []
    },
    createdAt: new Date('2019-11-05'),
    updatedAt: new Date()
  },
  {
    id: 'user-005',
    email: 'maria.technician@eyecareclinic.com',
    firstName: 'Maria',
    lastName: 'Garcia',
    roleId: 'optometric-technician',
    tenantId: 'demo-tenant',
    department: 'Clinical',
    hireDate: new Date('2022-06-12'),
    isActive: true,
    trainingProfile: {
      userId: 'user-005',
      completedModules: ['clinical-procedures', 'patient-care'],
      requiredModules: ['equipment-operation'],
      certifications: ['clinical-procedures-cert-2024'],
      trainingHours: 38,
      lastTrainingDate: new Date('2024-07-08'),
      complianceStatus: 'compliant',
      upcomingDeadlines: []
    },
    createdAt: new Date('2022-06-12'),
    updatedAt: new Date()
  },
  {
    id: 'user-006',
    email: 'robert.billing@eyecareclinic.com',
    firstName: 'Robert',
    lastName: 'Kim',
    roleId: 'billing-specialist',
    tenantId: 'demo-tenant',
    department: 'Billing',
    hireDate: new Date('2021-02-28'),
    isActive: true,
    trainingProfile: {
      userId: 'user-006',
      completedModules: ['insurance-billing', 'claims-processing'],
      requiredModules: ['financial-procedures'],
      certifications: ['billing-specialist-cert-2024'],
      trainingHours: 41,
      lastTrainingDate: new Date('2024-06-30'),
      complianceStatus: 'compliant',
      upcomingDeadlines: []
    },
    createdAt: new Date('2021-02-28'),
    updatedAt: new Date()
  },
  {
    id: 'user-007',
    email: 'emily.newbie@eyecareclinic.com',
    firstName: 'Emily',
    lastName: 'Davis',
    roleId: 'new-employee',
    tenantId: 'demo-tenant',
    department: 'Front Office',
    hireDate: new Date(),
    isActive: true,
    trainingProfile: {
      userId: 'user-007',
      completedModules: ['company-orientation'],
      requiredModules: ['hipaa-compliance', 'safety-procedures'],
      certifications: [],
      trainingHours: 8,
      lastTrainingDate: new Date(),
      complianceStatus: 'warning',
      upcomingDeadlines: [
        {
          moduleId: 'hipaa-compliance',
          moduleName: 'HIPAA Compliance Training',
          dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          priority: 'high',
          isOverdue: false
        },
        {
          moduleId: 'safety-procedures',
          moduleName: 'Safety Procedures Training',
          dueDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
          priority: 'high',
          isOverdue: false
        }
      ]
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

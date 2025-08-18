import { NextRequest, NextResponse } from 'next/server';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('📚 Fetching training module:', params.id);
    
    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI || 'mongodb://localhost:27017',
      process.env.MONGODB_DB || 'ai-assistant'
    );
    
    await mongoAccessor.connect();
    
    // Try to find the module by ID
    const module = await mongoAccessor.findOne('training_modules', { id: params.id });
    
    // Always return full content (even if module exists in DB, add the detailed content)
    if (!module || !module.content) {
      // Return a detailed demo module with full content
      const demoModule = {
        id: params.id,
        title: 'Eyefinity Administration Fundamentals',
        category: 'Practice Management',
        difficulty: 'intermediate',
        estimatedDuration: 45,
        description: 'Learn essential practice management and administrative procedures for Eyefinity systems.',
        status: 'active',
        createdAt: new Date().toISOString(),
        content: {
          sections: [
            {
              id: 'intro',
              title: 'Introduction to Eyefinity Administration',
              type: 'content',
              duration: 5,
              content: `
# Welcome to Eyefinity Administration Fundamentals

## Overview
This comprehensive training module will teach you the essential skills needed to effectively manage an eyecare practice using Eyefinity systems.

## Learning Objectives
By the end of this module, you will be able to:
- Navigate the Eyefinity administration interface
- Manage patient records and appointments
- Process insurance claims and billing
- Generate reports and analytics
- Maintain system security and compliance

## Prerequisites
- Basic computer skills
- Familiarity with eyecare practice operations
- Access to Eyefinity system (demo environment provided)
              `
            },
            {
              id: 'navigation',
              title: 'System Navigation',
              type: 'interactive',
              duration: 10,
              content: `
# Eyefinity System Navigation

## Main Dashboard
The Eyefinity dashboard provides quick access to all major functions:

### Key Areas:
1. **Patient Management** - Search, add, and update patient records
2. **Scheduling** - Manage appointments and provider calendars
3. **Billing & Claims** - Process insurance and patient billing
4. **Inventory** - Track frames, lenses, and supplies
5. **Reports** - Generate practice analytics and compliance reports

## Navigation Tips
- Use the search bar (Ctrl+F) to quickly find patients
- Bookmark frequently used screens
- Customize your dashboard widgets for efficiency

### Practice Exercise
Try navigating to the Patient Management section and search for a patient record.
              `
            },
            {
              id: 'patient-management',
              title: 'Patient Record Management',
              type: 'hands-on',
              duration: 15,
              content: `
# Patient Record Management

## Creating New Patient Records
Follow these steps to add a new patient:

### Step 1: Access Patient Management
1. Click on **Patients** in the main navigation
2. Select **Add New Patient**
3. Choose the appropriate patient type

### Step 2: Enter Patient Information
**Required Fields:**
- First Name, Last Name
- Date of Birth
- Contact Information (Phone, Email)
- Insurance Information

**Optional but Recommended:**
- Emergency Contact
- Medical History
- Preferred Communication Method

### Step 3: Verify and Save
- Review all entered information
- Check for duplicate records
- Save the patient record

## Best Practices
- Always verify patient identity before accessing records
- Keep contact information current
- Document all interactions in patient notes
- Follow HIPAA compliance guidelines

### Hands-On Exercise
Create a sample patient record using the provided demo data.
              `
            },
            {
              id: 'assessment',
              title: 'Knowledge Check',
              type: 'quiz',
              duration: 10,
              content: `
# Knowledge Assessment

## Question 1
What are the required fields when creating a new patient record?

**Options:**
A) Only name and phone number
B) Name, DOB, contact info, and insurance
C) Just insurance information
D) Name and email only

**Correct Answer:** B

## Question 2
Which keyboard shortcut helps you quickly search for patients?

**Options:**
A) Ctrl+S
B) Ctrl+P
C) Ctrl+F
D) Ctrl+N

**Correct Answer:** C

## Question 3
What should you always verify before accessing patient records?

**Options:**
A) Patient's favorite color
B) Patient identity
C) Weather conditions
D) Time of day

**Correct Answer:** B

## Practical Scenario
A patient calls to update their insurance information. Walk through the steps you would take to locate and update their record while maintaining HIPAA compliance.

**Key Points to Address:**
- Patient verification process
- Locating the correct record
- Updating insurance information
- Documentation requirements
              `
            },
            {
              id: 'completion',
              title: 'Module Completion',
              type: 'summary',
              duration: 5,
              content: `
# Congratulations! 🎉

You have successfully completed the **Eyefinity Administration Fundamentals** training module.

## What You've Learned
✅ System navigation and dashboard overview
✅ Patient record creation and management
✅ Best practices for data entry and security
✅ HIPAA compliance considerations

## Next Steps
1. **Practice** - Use the demo environment to reinforce your learning
2. **Advanced Training** - Consider enrolling in specialized modules:
   - Insurance Claims Processing
   - Advanced Reporting
   - System Administration
3. **Certification** - Take the certification exam to earn your credential

## Resources
- [Eyefinity User Guide](https://help.eyefinity.com)
- [Practice Management Best Practices](https://help.eyefinity.com/best-practices)
- [HIPAA Compliance Guidelines](https://help.eyefinity.com/hipaa)

## Support
If you have questions or need additional help:
- Contact your system administrator
- Submit a help desk ticket
- Join the monthly user training sessions

**Module Completion Time:** 45 minutes
**Your Score:** Will be calculated after assessment
**Certification Status:** Pending completion of all required modules
              `
            }
          ],
          totalSections: 5,
          completionCriteria: {
            requiredSections: ['intro', 'navigation', 'patient-management'],
            minimumScore: 80,
            practicalExercises: 2
          }
        },
        metadata: {
          version: '1.0',
          lastUpdated: new Date().toISOString(),
          author: 'Eyefinity Training Team',
          reviewedBy: 'Practice Management Experts',
          tags: ['administration', 'patient-management', 'eyefinity', 'fundamentals']
        }
      };
      
      await mongoAccessor.disconnect();
      return NextResponse.json({
        success: true,
        module: demoModule
      });
    }
    
    await mongoAccessor.disconnect();
    return NextResponse.json({
      success: true,
      module: module
    });
    
  } catch (error) {
    console.error('❌ Error fetching training module:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch training module',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

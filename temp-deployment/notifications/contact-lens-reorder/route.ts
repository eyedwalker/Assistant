/**
 * Contact Lens Reorder SMS API Endpoint
 * POST /api/notifications/contact-lens-reorder
 */

import { NextRequest, NextResponse } from 'next/server';
import { SMSManager } from '../../../../lib/managers/SMSManager';
import { MongoDBAccessor } from '../../../../lib/accessors/MongoDBAccessor';
import { getServerSession } from 'next-auth/next';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { patients, practicePhone, practiceName, tenantId } = body;

    if (!patients || !Array.isArray(patients) || patients.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Patients array with phone numbers is required' },
        { status: 400 }
      );
    }

    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-assistant',
      process.env.MONGODB_DB_NAME || 'ai-assistant'
    );
    const smsManager = new SMSManager(mongoAccessor);

    const results = [];
    for (const patient of patients) {
      if (patient.phoneNumber) {
        const result = await smsManager.sendNotification({
          userId: session.user.id,
          tenantId: tenantId || 'default',
          recipients: [patient.phoneNumber],
          type: 'contact_lens_reorder',
          templateData: {
            patientName: patient.name || 'Patient',
            practicePhone: practicePhone || 'us',
            practiceName: practiceName || 'your eyecare provider'
          }
        });
        
        results.push({
          patient: patient.name || 'Unknown',
          phoneNumber: patient.phoneNumber,
          success: result.success,
          error: result.error
        });
      }
    }

    const totalSent = results.filter(r => r.success).length;

    return NextResponse.json({
      success: totalSent > 0,
      data: {
        totalSent,
        results
      }
    });

  } catch (error) {
    console.error('Contact lens reorder API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send contact lens reorder reminders' 
      },
      { status: 500 }
    );
  }
}

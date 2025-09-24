/**
 * Appointment Reminder SMS API Endpoint
 * POST /api/notifications/appointment-reminder
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
    const { 
      patients, 
      appointmentDate, 
      practiceName, 
      tenantId,
      sendTime // Optional: schedule for later
    } = body;

    // Validate required fields
    if (!patients || !Array.isArray(patients) || patients.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Patients array with phone numbers is required' },
        { status: 400 }
      );
    }

    if (!appointmentDate) {
      return NextResponse.json(
        { success: false, error: 'Appointment date is required' },
        { status: 400 }
      );
    }

    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-assistant',
      process.env.MONGODB_DB_NAME || 'ai-assistant'
    );
    const smsManager = new SMSManager(mongoAccessor);

    // Extract phone numbers from patient data
    const recipients = patients.map((patient: any) => patient.phoneNumber).filter(Boolean);

    if (recipients.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid phone numbers found in patient data' },
        { status: 400 }
      );
    }

    // Format appointment date
    const formattedDate = new Date(appointmentDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Send appointment reminders
    const results = [];
    for (const patient of patients) {
      if (patient.phoneNumber) {
        const result = await smsManager.sendNotification({
          userId: session.user.id,
          tenantId: tenantId || 'default',
          recipients: [patient.phoneNumber],
          type: 'appointment_reminder',
          templateData: {
            patientName: patient.name || 'Patient',
            appointmentDate: formattedDate,
            practiceName: practiceName || 'our practice'
          },
          scheduleFor: sendTime ? new Date(sendTime) : undefined
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
        totalPatients: patients.length,
        results
      }
    });

  } catch (error) {
    console.error('Appointment reminder API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send appointment reminders' 
      },
      { status: 500 }
    );
  }
}

/**
 * SMS Settings API Endpoint
 * GET/POST /api/sms/settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { SMSManager } from '../../../../lib/managers/SMSManager';
import { MongoDBAccessor } from '../../../../lib/accessors/MongoDBAccessor';
import { getServerSession } from 'next-auth/next';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || 'default';

    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-assistant',
      process.env.MONGODB_DB_NAME || 'ai-assistant'
    );
    const smsManager = new SMSManager(mongoAccessor);

    const settings = await smsManager.getSMSSettings(session.user.id!, tenantId);

    return NextResponse.json({
      success: true,
      data: settings
    });

  } catch (error) {
    console.error('SMS settings GET error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get SMS settings' 
      },
      { status: 500 }
    );
  }
}

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
    const { phoneNumber, optedIn, notificationTypes, quietHours, tenantId } = body;

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-assistant',
      process.env.MONGODB_DB_NAME || 'ai-assistant'
    );
    const smsManager = new SMSManager(mongoAccessor);

    const success = await smsManager.updateSMSSettings({
      userId: session.user.id!,
      tenantId: tenantId || 'default',
      phoneNumber,
      optedIn: optedIn !== false, // Default to true if not specified
      notificationTypes: notificationTypes || ['all'],
      quietHours
    });

    return NextResponse.json({
      success,
      ...(success ? { message: 'SMS settings updated successfully' } : { error: 'Failed to update SMS settings' })
    });

  } catch (error) {
    console.error('SMS settings POST error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update SMS settings' 
      },
      { status: 500 }
    );
  }
}

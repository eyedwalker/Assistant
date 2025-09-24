/**
 * SMS Send API Endpoint
 * POST /api/sms/send
 */

import { NextRequest, NextResponse } from 'next/server';
import { SMSManager } from '../../../../lib/managers/SMSManager';
import { MongoDBAccessor } from '../../../../lib/accessors/MongoDBAccessor';
import { getServerSession } from 'next-auth/next';

export async function POST(request: NextRequest) {
  try {
    // Get session for authentication
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { recipients, type, templateData, customMessage, tenantId } = body;

    // Validate required fields
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Recipients array is required' },
        { status: 400 }
      );
    }

    if (!type && !customMessage) {
      return NextResponse.json(
        { success: false, error: 'Either type or customMessage is required' },
        { status: 400 }
      );
    }

    // Initialize SMS Manager
    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-assistant',
      process.env.MONGODB_DB_NAME || 'ai-assistant'
    );
    const smsManager = new SMSManager(mongoAccessor);

    // Send SMS notification
    const result = await smsManager.sendNotification({
      userId: session.user.id,
      tenantId: tenantId || 'default',
      recipients,
      type: type || 'custom',
      templateData,
      customMessage
    });

    return NextResponse.json({
      success: result.success,
      data: {
        totalSent: result.totalSent,
        results: result.results
      },
      ...(result.error && { error: result.error })
    });

  } catch (error) {
    console.error('SMS send API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send SMS' 
      },
      { status: 500 }
    );
  }
}

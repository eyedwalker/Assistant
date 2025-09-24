/**
 * SMS Opt-Out API Endpoint
 * POST /api/sms/opt-out
 */

import { NextRequest, NextResponse } from 'next/server';
import { SMSManager } from '../../../../lib/managers/SMSManager';
import { MongoDBAccessor } from '../../../../lib/accessors/MongoDBAccessor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber, tenantId } = body;

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

    const success = await smsManager.optOut(phoneNumber, tenantId || 'default');

    return NextResponse.json({
      success,
      message: success ? 'Successfully opted out of SMS notifications' : 'Failed to opt out'
    });

  } catch (error) {
    console.error('SMS opt-out API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process opt-out' 
      },
      { status: 500 }
    );
  }
}

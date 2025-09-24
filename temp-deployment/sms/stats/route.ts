/**
 * SMS Statistics API Endpoint
 * GET /api/sms/stats
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
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-assistant',
      process.env.MONGODB_DB_NAME || 'ai-assistant'
    );
    const smsManager = new SMSManager(mongoAccessor);

    const stats = await smsManager.getSMSStats(tenantId, startDate, endDate);

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('SMS stats API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get SMS statistics' 
      },
      { status: 500 }
    );
  }
}

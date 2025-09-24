/**
 * SMS Test API Endpoint
 * GET /api/sms/test - Test Twilio connection and credentials
 */

import { NextRequest, NextResponse } from 'next/server';
import { TwilioAccessor } from '../../../../lib/accessors/TwilioAccessor';

export async function GET(request: NextRequest) {
  try {
    const twilioAccessor = new TwilioAccessor();

    // Test 1: Get account balance
    const balance = await twilioAccessor.getAccountBalance();
    
    // Test 2: Get usage stats
    const usage = await twilioAccessor.getUsageStats();

    // Test 3: Validate a test phone number
    const validation = await twilioAccessor.validatePhoneNumber('+15555551234');

    return NextResponse.json({
      success: true,
      data: {
        connection: 'Connected to Twilio successfully',
        account: {
          balance: balance?.balance || 'Unable to fetch',
          currency: balance?.currency || 'USD'
        },
        usage: {
          messagesSent: usage?.messagesSent || 0,
          cost: usage?.cost || '0.00',
          period: usage?.period || 'current month'
        },
        validation: {
          testNumber: '+15555551234',
          isValid: validation.isValid,
          error: validation.error
        },
        credentials: {
          accountSid: process.env.TWILIO_ACCOUNT_SID?.substring(0, 10) + '...',
          fromNumber: process.env.TWILIO_PHONE_NUMBER
        }
      }
    });

  } catch (error) {
    console.error('SMS test API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to test Twilio connection',
        credentials: {
          accountSid: process.env.TWILIO_ACCOUNT_SID ? 'Set' : 'Missing',
          authToken: process.env.TWILIO_AUTH_TOKEN ? 'Set' : 'Missing',
          fromNumber: process.env.TWILIO_PHONE_NUMBER || 'Missing'
        }
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber, message } = body;

    if (!phoneNumber || !message) {
      return NextResponse.json(
        { success: false, error: 'phoneNumber and message are required' },
        { status: 400 }
      );
    }

    const twilioAccessor = new TwilioAccessor();

    // Send test SMS
    const result = await twilioAccessor.sendSMS({
      to: phoneNumber,
      body: message
    });

    return NextResponse.json({
      success: result.success,
      data: {
        messageId: result.messageId,
        status: result.status,
        to: phoneNumber,
        message: message
      },
      ...(result.error && { error: result.error })
    });

  } catch (error) {
    console.error('SMS test send error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send test SMS' 
      },
      { status: 500 }
    );
  }
}

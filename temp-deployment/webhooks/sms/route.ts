/**
 * SMS Webhook API Endpoint
 * POST /api/webhooks/sms
 * Handles incoming SMS responses (STOP, replies, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { SMSManager } from '../../../../lib/managers/SMSManager';
import { MongoDBAccessor } from '../../../../lib/accessors/MongoDBAccessor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const params = new URLSearchParams(body);
    
    const from = params.get('From');
    const to = params.get('To');
    const messageBody = params.get('Body')?.toLowerCase().trim();
    const messageSid = params.get('MessageSid');

    if (!from || !messageBody) {
      return NextResponse.json(
        { error: 'Missing required webhook data' },
        { status: 400 }
      );
    }

    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-assistant',
      process.env.MONGODB_DB_NAME || 'ai-assistant'
    );

    // Handle STOP/UNSUBSCRIBE requests
    if (['stop', 'unsubscribe', 'quit', 'end', 'cancel'].includes(messageBody)) {
      const smsManager = new SMSManager(mongoAccessor);
      await smsManager.optOut(from, 'default'); // Default tenant for webhook
      
      // Log opt-out webhook
      await mongoAccessor.connect();
      try {
        await mongoAccessor.create('webhookLogs', {
          type: 'sms_opt_out',
          from,
          to,
          messageBody,
          messageSid,
          processedAt: new Date()
        });
      } finally {
        await mongoAccessor.disconnect();
      }

      // Twilio expects XML response for SMS
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
         <Response>
           <Message>You have been unsubscribed from SMS notifications. Text START to opt back in.</Message>
         </Response>`,
        {
          headers: { 'Content-Type': 'text/xml' },
          status: 200
        }
      );
    }

    // Handle START/SUBSCRIBE requests
    if (['start', 'subscribe', 'yes'].includes(messageBody)) {
      await mongoAccessor.connect();
      try {
        // Reactivate SMS settings if they exist
        const existingSettings = await mongoAccessor.find('smsSettings', { phoneNumber: from });
        if (existingSettings.length > 0) {
          await mongoAccessor.update('smsSettings', 
            existingSettings[0]._id, 
            { 
              optedIn: true, 
              updatedAt: new Date() 
            }
          );
        }

        await mongoAccessor.create('webhookLogs', {
          type: 'sms_opt_in',
          from,
          to,
          messageBody,
          messageSid,
          processedAt: new Date()
        });
      } finally {
        await mongoAccessor.disconnect();
      }

      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
         <Response>
           <Message>You have been subscribed to SMS notifications from your eyecare provider.</Message>
         </Response>`,
        {
          headers: { 'Content-Type': 'text/xml' },
          status: 200
        }
      );
    }

    // Log other incoming messages
    await mongoAccessor.connect();
    try {
      await mongoAccessor.create('incomingSMS', {
        from,
        to,
        messageBody: params.get('Body'), // Original case
        messageSid,
        receivedAt: new Date(),
        processed: false
      });
    } finally {
      await mongoAccessor.disconnect();
    }

    // Default response - don't auto-reply to prevent loops
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
       <Response></Response>`,
      {
        headers: { 'Content-Type': 'text/xml' },
        status: 200
      }
    );

  } catch (error) {
    console.error('SMS webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

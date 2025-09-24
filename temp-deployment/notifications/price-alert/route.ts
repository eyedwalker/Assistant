/**
 * Price Alert SMS API Endpoint
 * POST /api/notifications/price-alert
 * Integrates with browser extension price matching system
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
      recipients, 
      productName, 
      originalPrice, 
      matchedPrice, 
      retailer,
      savings,
      productUrl,
      tenantId 
    } = body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Recipients array with phone numbers is required' },
        { status: 400 }
      );
    }

    if (!productName || !savings || !retailer) {
      return NextResponse.json(
        { success: false, error: 'productName, savings, and retailer are required' },
        { status: 400 }
      );
    }

    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-assistant',
      process.env.MONGODB_DB_NAME || 'ai-assistant'
    );
    const smsManager = new SMSManager(mongoAccessor);

    // Calculate savings percentage if not provided
    let savingsText = savings;
    if (originalPrice && matchedPrice) {
      const savingAmount = parseFloat(originalPrice) - parseFloat(matchedPrice);
      const savingPercent = Math.round((savingAmount / parseFloat(originalPrice)) * 100);
      savingsText = `$${savingAmount.toFixed(2)} (${savingPercent}%)`;
    }

    const result = await smsManager.sendNotification({
      userId: session.user.id,
      tenantId: tenantId || 'default',
      recipients,
      type: 'price_alert',
      templateData: {
        productName,
        savings: savingsText,
        retailer
      }
    });

    // Log price alert for analytics
    await mongoAccessor.connect();
    try {
      await mongoAccessor.create('priceAlerts', {
        userId: session.user.id,
        tenantId: tenantId || 'default',
        productName,
        originalPrice,
        matchedPrice,
        retailer,
        savings: savingsText,
        productUrl,
        recipients: recipients.length,
        smsResults: result.results,
        createdAt: new Date()
      });
    } finally {
      await mongoAccessor.disconnect();
    }

    return NextResponse.json({
      success: result.success,
      data: {
        totalSent: result.totalSent,
        productName,
        savings: savingsText,
        retailer,
        results: result.results
      }
    });

  } catch (error) {
    console.error('Price alert API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send price alerts' 
      },
      { status: 500 }
    );
  }
}

/**
 * Invoice Sharing API Endpoint
 * POST /api/invoices/share
 * Handles sending invoices via SMS and/or email
 */

import { NextRequest, NextResponse } from 'next/server';
import { SMSManager } from '../../../../lib/managers/SMSManager';
import { MongoDBAccessor } from '../../../../lib/accessors/MongoDBAccessor';
import { SESAccessor } from '../../../../lib/accessors/SESAccessor';
import { getServerSession } from 'next-auth/next';

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

interface InvoiceData {
  type: string;
  timestamp: string;
  url: string;
  patient: {
    name?: string;
  };
  practice: {
    officeNumber?: string;
    serviceDate?: string;
  };
  services: Array<{
    description: string;
    price: string;
    fullRow: string;
  }>;
  payment: {
    amount?: string;
  };
  totals: {
    total?: string;
    balance?: string;
  };
  transactionId?: string;
  pageContent?: string;
}

interface ShareRequest {
  invoiceData: InvoiceData;
  method: 'sms' | 'email' | 'both';
  phoneNumber?: string;
  email?: string;
  patientName?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ShareRequest = await request.json();
    const { invoiceData, method, phoneNumber, email, patientName } = body;

    // Validate required fields
    if (!invoiceData) {
      return NextResponse.json(
        { success: false, error: 'Invoice data is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!method || !['sms', 'email', 'both'].includes(method)) {
      return NextResponse.json(
        { success: false, error: 'Valid method (sms, email, both) is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if ((method === 'sms' || method === 'both') && !phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required for SMS delivery' },
        { status: 400, headers: corsHeaders }
      );
    }

    if ((method === 'email' || method === 'both') && !email) {
      return NextResponse.json(
        { success: false, error: 'Email is required for email delivery' },
        { status: 400, headers: corsHeaders }
      );
    }

    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-assistant',
      'ai-assistant'
    );

    // Generate invoice summary for SMS
    const invoiceSummary = generateInvoiceSummary(invoiceData);
    
    // Results tracking
    const results: any = {};

    // Send SMS if requested
    if (method === 'sms' || method === 'both') {
      const smsManager = new SMSManager(mongoAccessor);
      
      const smsResult = await smsManager.sendNotification({
        tenantId: 'default',
        recipients: [phoneNumber!],
        type: 'custom',
        customMessage: invoiceSummary.smsMessage
      });

      results.sms = {
        success: smsResult.success,
        totalSent: smsResult.totalSent,
        error: smsResult.error
      };
    }

    // Send Email if requested
    if (method === 'email' || method === 'both') {
      const sesAccessor = new SESAccessor();
      results.email = await sendInvoiceEmail(sesAccessor, email!, invoiceData, invoiceSummary);
    }

    // Log the share action
    const shareRecord = await logInvoiceShare(mongoAccessor, {
      invoiceData,
      method,
      phoneNumber,
      email,
      results,
      timestamp: new Date()
    });

    return NextResponse.json({
      success: true,
      message: 'Invoice shared successfully',
      deliveryReport: {
        sms: results.sms,
        email: results.email
      },
      timestamp: new Date().toISOString()
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Invoice sharing error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to share invoice' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Generate invoice summary for different delivery methods
function generateInvoiceSummary(invoiceData: InvoiceData) {
  const patientName = invoiceData.patient?.name || 'Patient';
  const total = invoiceData.totals?.total || 'N/A';
  const serviceDate = invoiceData.practice?.serviceDate || 'Recent visit';
  const officeNumber = invoiceData.practice?.officeNumber || '';
  
  // Generate SMS message (keep under 160 characters for single SMS)
  let smsMessage = `Hi ${patientName}, here's your eyecare invoice from ${serviceDate}. Total: ${total}.`;
  
  if (invoiceData.totals?.balance && invoiceData.totals.balance !== '$0.00') {
    smsMessage += ` Balance: ${invoiceData.totals.balance}.`;
  }
  
  smsMessage += ' Reply STOP to opt out.';
  
  // Generate detailed summary
  const services = invoiceData.services.map(s => `${s.description}: ${s.price}`).join('\n');
  
  const summary = {
    patient: patientName,
    serviceDate,
    officeNumber,
    services: invoiceData.services,
    total,
    balance: invoiceData.totals?.balance,
    payment: invoiceData.payment?.amount,
    transactionId: invoiceData.transactionId
  };
  
  return {
    smsMessage,
    summary,
    services
  };
}

// Email sending function using AWS SES
async function sendInvoiceEmail(sesAccessor: SESAccessor, email: string, invoiceData: InvoiceData, summary: any) {
  try {
    const subject = `Your Eyecare Invoice - ${summary.serviceDate}`;
    const patientName = summary.patient;
    
    // Create HTML email content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .invoice-details { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .services { margin: 20px 0; }
          .service-item { border-bottom: 1px solid #dee2e6; padding: 10px 0; }
          .total { font-weight: bold; font-size: 1.2em; color: #007bff; }
          .footer { background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 0.9em; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Your Eyecare Invoice</h1>
        </div>
        <div class="content">
          <p>Dear ${patientName},</p>
          <p>Thank you for visiting us. Please find your invoice details below:</p>
          
          <div class="invoice-details">
            <h3>Invoice Summary</h3>
            <p><strong>Service Date:</strong> ${summary.serviceDate}</p>
            ${summary.officeNumber ? `<p><strong>Office:</strong> ${summary.officeNumber}</p>` : ''}
            ${summary.transactionId ? `<p><strong>Transaction ID:</strong> ${summary.transactionId}</p>` : ''}
          </div>
          
          <div class="services">
            <h3>Services Provided</h3>
            ${summary.services.map((service: any) => `
              <div class="service-item">
                <strong>${service.description}</strong>
                <span style="float: right;">${service.price}</span>
              </div>
            `).join('')}
          </div>
          
          <div class="invoice-details">
            <p class="total">Total: ${summary.total}</p>
            ${summary.balance && summary.balance !== '$0.00' ? `<p><strong>Balance Due:</strong> ${summary.balance}</p>` : ''}
            ${summary.payment ? `<p><strong>Payment Made:</strong> ${summary.payment}</p>` : ''}
          </div>
          
          <p>If you have any questions about this invoice, please don't hesitate to contact our office.</p>
          <p>Thank you for choosing us for your eyecare needs!</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </body>
      </html>
    `;
    
    // Create text version
    const textContent = `
Dear ${patientName},

Thank you for visiting us. Here are your invoice details:

Service Date: ${summary.serviceDate}
${summary.officeNumber ? `Office: ${summary.officeNumber}\n` : ''}
${summary.transactionId ? `Transaction ID: ${summary.transactionId}\n` : ''}

Services Provided:
${summary.services.map((service: any) => `${service.description}: ${service.price}`).join('\n')}

Total: ${summary.total}
${summary.balance && summary.balance !== '$0.00' ? `Balance Due: ${summary.balance}\n` : ''}
${summary.payment ? `Payment Made: ${summary.payment}\n` : ''}

If you have any questions about this invoice, please don't hesitate to contact our office.

Thank you for choosing us for your eyecare needs!

---
This is an automated message. Please do not reply to this email.
    `;
    
    // Send via SES
    const result = await sesAccessor.sendInvoiceEmail(
      email,
      subject,
      htmlContent,
      textContent
    );
    
    return {
      success: result.success,
      messageId: result.messageId,
      recipient: email,
      subject: subject,
      error: result.error
    };
    
  } catch (error) {
    console.error('Failed to send invoice email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email'
    };
  }
}

// Log invoice sharing activity
async function logInvoiceShare(mongoAccessor: MongoDBAccessor, shareData: any) {
  try {
    await mongoAccessor.connect();
    
    const logEntry = {
      type: 'invoice_share',
      patientName: shareData.invoiceData.patient?.name,
      method: shareData.method,
      phoneNumber: shareData.phoneNumber,
      email: shareData.email,
      invoiceUrl: shareData.invoiceData.url,
      transactionId: shareData.invoiceData.transactionId,
      results: shareData.results,
      timestamp: shareData.timestamp,
      success: shareData.results.sms?.success || shareData.results.email?.success
    };
    
    const result = await mongoAccessor.create('invoiceShares', logEntry);
    return result;
    
  } catch (error) {
    console.error('Failed to log invoice share:', error);
    return null;
  } finally {
    await mongoAccessor.disconnect();
  }
}

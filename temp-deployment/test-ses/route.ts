/**
 * AWS SES Test Endpoint
 * GET /api/test-ses
 * Tests AWS SES email sending functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { SESAccessor } from '../../../lib/accessors/SESAccessor';

export async function GET(request: NextRequest) {
  try {
    const sesAccessor = new SESAccessor();
    
    // Get test email from query params or use default
    const { searchParams } = new URL(request.url);
    const testEmail = searchParams.get('email') || 'test@example.com';
    
    // Test simple email
    const simpleResult = await sesAccessor.sendSimpleEmail(
      testEmail,
      'SES Test Email',
      'This is a test email from your AI Assistant platform to verify SES integration is working correctly.',
      '<h1>SES Test Email</h1><p>This is a test email from your AI Assistant platform to verify SES integration is working correctly.</p><p><strong>Status:</strong> ✅ SES Integration Working</p>'
    );
    
    // Test invoice email format
    const invoiceTestData = {
      patient: 'John Doe',
      serviceDate: new Date().toLocaleDateString(),
      officeNumber: 'Office #123',
      transactionId: 'TXN-' + Date.now(),
      total: '$150.00',
      balance: '$0.00',
      payment: '$150.00',
      services: [
        { description: 'Comprehensive Eye Exam', price: '$85.00' },
        { description: 'Contact Lens Fitting', price: '$65.00' }
      ]
    };
    
    const invoiceResult = await sesAccessor.sendInvoiceEmail(
      testEmail,
      'Test Invoice - AI Assistant Platform',
      generateTestInvoiceHTML(invoiceTestData),
      generateTestInvoiceText(invoiceTestData)
    );
    
    return NextResponse.json({
      success: true,
      message: 'SES test completed',
      results: {
        simpleEmail: simpleResult,
        invoiceEmail: invoiceResult
      },
      testEmail: testEmail,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('SES test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'SES test failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

function generateTestInvoiceHTML(data: any) {
  return `
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
        .test-badge { background-color: #ffc107; color: #000; padding: 5px 10px; border-radius: 3px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🧾 Test Invoice - AI Assistant Platform</h1>
        <span class="test-badge">TEST EMAIL</span>
      </div>
      <div class="content">
        <p>Dear ${data.patient},</p>
        <p>This is a test email to verify invoice email templates are working correctly.</p>
        
        <div class="invoice-details">
          <h3>Invoice Summary</h3>
          <p><strong>Service Date:</strong> ${data.serviceDate}</p>
          <p><strong>Office:</strong> ${data.officeNumber}</p>
          <p><strong>Transaction ID:</strong> ${data.transactionId}</p>
        </div>
        
        <div class="services">
          <h3>Services Provided</h3>
          ${data.services.map((service: any) => `
            <div class="service-item">
              <strong>${service.description}</strong>
              <span style="float: right;">${service.price}</span>
            </div>
          `).join('')}
        </div>
        
        <div class="invoice-details">
          <p class="total">Total: ${data.total}</p>
          <p><strong>Payment Made:</strong> ${data.payment}</p>
          <p><strong>Balance Due:</strong> ${data.balance}</p>
        </div>
        
        <p>✅ <strong>SES Integration Test Successful!</strong></p>
        <p>This confirms that AWS SES email sending is working correctly with your AI Assistant platform.</p>
      </div>
      <div class="footer">
        <p>This is a test message from your AI Assistant platform.</p>
      </div>
    </body>
    </html>
  `;
}

function generateTestInvoiceText(data: any) {
  return `
TEST INVOICE - AI ASSISTANT PLATFORM

Dear ${data.patient},

This is a test email to verify invoice email templates are working correctly.

Service Date: ${data.serviceDate}
Office: ${data.officeNumber}
Transaction ID: ${data.transactionId}

Services Provided:
${data.services.map((service: any) => `${service.description}: ${service.price}`).join('\n')}

Total: ${data.total}
Payment Made: ${data.payment}
Balance Due: ${data.balance}

✅ SES Integration Test Successful!

This confirms that AWS SES email sending is working correctly with your AI Assistant platform.

---
This is a test message from your AI Assistant platform.
  `;
}

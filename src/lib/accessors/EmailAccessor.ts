/**
 * Email Accessor - VBD Architecture
 * Handles sending emails for support cases and notifications
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export interface EmailMessage {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    encoding?: string;
    contentType?: string;
  }>;
}

export class EmailAccessor {
  private transporter: Transporter | null = null;
  private config: EmailConfig;
  private fromEmail: string;

  constructor() {
    this.config = {
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASSWORD || ''
      }
    };
    this.fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@example.com';
  }

  /**
   * Initialize email transporter
   */
  private async getTransporter(): Promise<Transporter> {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport(this.config);
      
      // Verify connection
      try {
        await this.transporter.verify();
        console.log('✅ Email transporter connected');
      } catch (error) {
        console.error('❌ Email transporter verification failed:', error);
        throw new Error('Failed to connect to email server');
      }
    }
    return this.transporter;
  }

  /**
   * Send an email
   */
  async sendEmail(message: EmailMessage): Promise<boolean> {
    try {
      const transporter = await this.getTransporter();
      
      const mailOptions = {
        from: this.fromEmail,
        to: Array.isArray(message.to) ? message.to.join(', ') : message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments
      };

      // Debug logging
      console.log('📧 Email details:');
      console.log(`  From: ${mailOptions.from}`);
      console.log(`  To: ${mailOptions.to}`);
      console.log(`  Subject: ${mailOptions.subject}`);
      console.log(`  HTML length: ${message.html?.length || 0} characters`);
      console.log(`  Text length: ${message.text?.length || 0} characters`);
      console.log(`  Attachments: ${mailOptions.attachments?.length || 0} files`);
      console.log(`  HTML preview: ${message.html?.substring(0, 200)}...`);

      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Email sent:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Send support case email with diagnostic data
   */
  async sendSupportCaseEmail(
    subject: string,
    description: string,
    diagnostics: any,
    screenshot?: string,
    supportEmail: string = process.env.SUPPORT_EMAIL || 'support@example.com',
    priority: string = 'Medium'
  ): Promise<boolean> {
    try {
      const htmlContent = this.formatSupportCaseEmail(subject, description, diagnostics, priority);
      
      const attachments: Array<{filename: string; content: string | Buffer; encoding?: string; contentType?: string}> = [];
      
      // Add diagnostics JSON
      attachments.push({
        filename: `diagnostics_${new Date().toISOString()}.json`,
        content: Buffer.from(JSON.stringify(diagnostics, null, 2)).toString('base64'),
        encoding: 'base64'
      });
      
      // Add screenshot if provided
      if (screenshot) {
        const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, '');
        attachments.push({
          filename: `screenshot_${new Date().toISOString()}.png`,
          content: base64Data,
          encoding: 'base64'
        });
      }

      // Add screen recording if provided and not empty
      if (diagnostics.screenRecording) {
        console.log(`📹 Screen recording type: ${typeof diagnostics.screenRecording}`);
        console.log(`📹 Screen recording length: ${diagnostics.screenRecording.length}`);
        console.log(`📹 First 100 chars: ${diagnostics.screenRecording.substring(0, 100)}`);
        
        // Detect video format from data URL
        const formatMatch = diagnostics.screenRecording.match(/^data:video\/([^;]+);/);
        const videoFormat = formatMatch ? formatMatch[1] : 'webm';
        
        console.log(`📹 Detected format: ${videoFormat}`);
        
        // Handle format: data:video/webm;codecs=vp9;base64,... OR data:video/mp4;base64,...
        const videoBase64 = diagnostics.screenRecording.replace(/^data:video\/[^;]+;.*?base64,/, '');
        
        // Only attach if there's actual video data (not empty string)
        if (videoBase64 && videoBase64.length > 100) {
          const sizeKB = Math.round(videoBase64.length / 1024);
          console.log(`📹 Adding screen recording to email attachments (${sizeKB}KB base64 string)`);
          console.log(`📹 After cleanup, base64 length: ${videoBase64.length}`);
          
          // Convert base64 to Buffer for reliable attachment
          try {
            let videoBuffer = Buffer.from(videoBase64, 'base64');
            const videoSizeKB = Math.round(videoBuffer.length / 1024);
            const videoSizeMB = (videoBuffer.length / (1024 * 1024)).toFixed(2);
            console.log(`📹 Video buffer created: ${videoSizeKB}KB (${videoSizeMB}MB) binary`);
            
            // Check if video is too large for email (Gmail limit is ~20MB after encoding)
            const maxEmailVideoSizeMB = 15;
            if (videoBuffer.length > maxEmailVideoSizeMB * 1024 * 1024) {
              console.log(`⚠️ Video too large for email (${videoSizeMB}MB > ${maxEmailVideoSizeMB}MB), skipping attachment`);
              console.log('💡 Consider implementing S3 upload for large videos');
            } else if (videoBuffer.length > 0) {
              let finalBuffer = videoBuffer;
              let fileExtension = videoFormat === 'mp4' ? 'mp4' : 'webm';
              let contentType = `video/${videoFormat}`;
              
              // Convert WebM to MP4 for better compatibility
              if (videoFormat === 'webm') {
                try {
                  console.log('🎬 Converting WebM to MP4 for better compatibility...');
                  const { convertWebMToMP4 } = await import('../utils/videoConverter');
                  const convertedBuffer = await convertWebMToMP4(videoBuffer);
                  finalBuffer = Buffer.from(convertedBuffer);
                  fileExtension = 'mp4';
                  contentType = 'video/mp4';
                  console.log(`✅ Conversion successful: ${Math.round(finalBuffer.length / 1024)}KB MP4`);
                } catch (conversionError: any) {
                  console.error('⚠️ Conversion failed, using original WebM:', conversionError.message);
                  // Keep original WebM if conversion fails
                  finalBuffer = videoBuffer;
                  fileExtension = 'webm';
                  contentType = 'video/webm';
                }
              }
              
              attachments.push({
                filename: `screen-recording_${new Date().toISOString()}.${fileExtension}`,
                content: finalBuffer,
                contentType: contentType
              });
              console.log(`✅ Screen recording attachment added successfully as .${fileExtension}`);
            } else {
              console.log('⚠️ Buffer was empty after conversion!');
            }
          } catch (error) {
            console.error('❌ Failed to convert base64 to buffer:', error);
          }
        } else {
          console.log('⚠️ Screen recording was empty after cleanup, skipping attachment');
        }
      }

      // Create enhanced plain text version for Gmail compatibility
      const plainText = this.createPlainTextTemplate(subject, description, diagnostics, priority);
      
      await this.sendEmail({
        to: supportEmail,
        subject: `[SUPPORT] ${subject}`,
        html: htmlContent,
        text: plainText,
        attachments
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to send support case email:', error);
      return false;
    }
  }

  /**
   * Format support case email as HTML
   */
  private formatSupportCaseEmail(
    subject: string,
    description: string,
    diagnostics: any,
    priority: string = 'Medium'
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
  <div style="background: #4f46e5; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">🎫 Support Case</h1>
    <p style="margin: 5px 0 0 0;">New support request from AI Assistant Platform</p>
  </div>
  
  <div style="padding: 20px; background: #f9fafb;">
    <!-- Salesforce Support Case Template - Template ID: 20240718SFT -->
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 10px 0; border-radius: 8px;">
      <h3 style="margin-top: 0; color: #4f46e5;">📋 Template ID: 20240718SFT</h3>
      <p style="font-size: 12px; color: #92400e;">Official Salesforce Support Case Template - Copy content below for Case Description</p>
    </div>

    <!-- Quick Summary -->
    <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 10px 0; border-radius: 8px;">
      <h3 style="margin-top: 0; color: #3b82f6;">📊 Quick Summary</h3>
      <p><strong>Issue:</strong> ${description}</p>
      <p><strong>Browser:</strong> ${diagnostics.browserName} ${diagnostics.browserVersion}</p>
      <p><strong>URL:</strong> ${diagnostics.url}</p>
      <p><strong>Priority:</strong> ${priority}</p>
      ${diagnostics.screenRecording ? '<p><strong>📹 Video Recording:</strong> ✅ Attached (see screen-recording.mp4)</p>' : ''}
      <p style="font-size: 12px; color: #1e40af; margin: 10px 0 0 0;"><em>⬇️ Full template details below | Complete diagnostic data in attachments</em></p>
    </div>

    <div style="background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #4f46e5;">
      <h3 style="margin-top: 0; color: #4f46e5;">📝 Description of the Problem (20240718SFT)</h3>
      <p style="white-space: pre-wrap;">${description}</p>
    </div>

    <div style="background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #4f46e5;">
      <h3 style="margin-top: 0; color: #4f46e5;">✅ Expected Results</h3>
      <p>${diagnostics.expectedResults || 'Not specified - Feature should work as documented'}</p>
    </div>

    <div style="background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #4f46e5;">
      <h3 style="margin-top: 0; color: #4f46e5;">❌ Actual Results</h3>
      <p>${diagnostics.actualResults || description}</p>
    </div>

    <div style="background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #4f46e5;">
      <h3 style="margin-top: 0; color: #4f46e5;">🔧 Workaround</h3>
      <p>${diagnostics.workaround || 'None identified at this time'}</p>
    </div>

    <div style="background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #4f46e5;">
      <h3 style="margin-top: 0; color: #4f46e5;">⚠️ Impacts to Practice/Patients</h3>
      <p>${diagnostics.impacts || 'User unable to complete task as expected. Support request submitted via AI Assistant.'}</p>
    </div>

    <div style="background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #4f46e5;">
      <h3 style="margin-top: 0; color: #4f46e5;">🎯 Priority</h3>
      <p style="${priority === 'High' ? 'color: #dc2626;' : 'color: #f59e0b;'} font-weight: bold;">${priority || 'Medium'}</p>
    </div>

    <div style="background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #4f46e5;">
      <h3 style="margin-top: 0; color: #4f46e5;">📋 Steps to Reproduce</h3>
      <p><strong>Page URL:</strong> <a href="${diagnostics.url}">${diagnostics.url}</a></p>
      <p><strong>Page Title:</strong> ${diagnostics.pageTitle}</p>
      <p><strong>User Action:</strong> ${description}</p>
      <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
      ${diagnostics.userName ? `<p><strong>User:</strong> ${diagnostics.userName}${diagnostics.userCompany ? ` (${diagnostics.userCompany})` : ''}</p>` : ''}
    </div>

    <div style="background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #4f46e5;">
      <h3 style="margin-top: 0; color: #4f46e5;">🔍 Steps to Triage</h3>
      <p><strong>When did this start:</strong> ${new Date().toLocaleString()}</p>
      <p><strong>Browser:</strong> ${diagnostics.browserName} ${diagnostics.browserVersion} on ${diagnostics.platform}</p>
      <p><strong>Screen Resolution:</strong> ${diagnostics.screenResolution}</p>
      <p><strong>Extension Version:</strong> ${diagnostics.extensionVersion || 'N/A'}</p>
      <p><strong>Console Errors:</strong> ${diagnostics.consoleLogs ? diagnostics.consoleLogs.filter((log: any) => log.level === 'error').length : 0} error(s) found (see logs below)</p>
      <p><strong>Network Failures:</strong> ${diagnostics.failedRequests?.length || 0} failed request(s) (see network section below)</p>
    </div>

    <div style="background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #4f46e5;">
      <h3 style="margin-top: 0; color: #4f46e5;">🌐 Environment(s) Found</h3>
      <p><strong>Environment:</strong> Production</p>
      <p><strong>Does issue exist in Production:</strong> Yes</p>
      <p><strong>URL:</strong> ${diagnostics.url}</p>
    </div>

    <div style="background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #4f46e5;">
      <h3 style="margin-top: 0; color: #4f46e5;">💻 Affected Products</h3>
      <p><strong>Browser:</strong> ${diagnostics.browserName} ${diagnostics.browserVersion}</p>
      <p><strong>Platform:</strong> ${diagnostics.platform}</p>
      <p><strong>Browser Extension:</strong> Eyecare AI Assistant v${diagnostics.extensionVersion || '1.1'}</p>
    </div>

    <div style="background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #4f46e5;">
      <h3 style="margin-top: 0; color: #4f46e5;">📎 Additional Information</h3>
      <p><strong>Screenshots:</strong> ${diagnostics.screenshot ? '✅ Attached (screenshot.png)' : '❌ Not available'}</p>
      <p><strong>Screen Recording:</strong> ${diagnostics.screenRecording ? '✅ Attached (screen-recording.mp4) 🎬' : '❌ Not available'}</p>
      <p><strong>Console Logs:</strong> ${diagnostics.consoleLogs ? `✅ ${diagnostics.consoleLogs.length} log entries captured` : '❌ Not available'}</p>
      <p><strong>Network Data:</strong> ${diagnostics.networkRequests ? `✅ ${diagnostics.networkRequests.length} requests logged` : '❌ Not available'}</p>
      <p><strong>Diagnostic Data:</strong> ✅ Attached (diagnostics.json)</p>
      ${diagnostics.screenRecording ? `
      <div style="margin-top: 10px; padding: 10px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
        <strong>🎬 VIDEO OF ISSUE INCLUDED!</strong><br>
        <span style="font-size: 12px; color: #92400e;">The user recorded their screen (MP4 format) showing the exact steps that caused the issue. This video will help you quickly understand and reproduce the problem. The video has been automatically converted from WebM to MP4 for universal compatibility.</span>
      </div>
      ` : ''}
    </div>

    <div style="background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #4f46e5;">
      <h3 style="margin-top: 0; color: #4f46e5;">👤 Contact Information</h3>
      ${diagnostics.userName ? `<div style="padding: 5px 0; border-bottom: 1px solid #e5e7eb;"><span style="font-weight: bold; color: #6b7280; display: inline-block; width: 200px;">Name:</span><span style="color: #111827;">${diagnostics.userName}</span></div>` : '<p><em>User information not available from extension login</em></p>'}
      ${diagnostics.userEmail ? `<div style="padding: 5px 0; border-bottom: 1px solid #e5e7eb;"><span style="font-weight: bold; color: #6b7280; display: inline-block; width: 200px;">Email:</span><span style="color: #111827;">${diagnostics.userEmail}</span></div>` : ''}
      ${diagnostics.userCompany ? `<div style="padding: 5px 0; border-bottom: 1px solid #e5e7eb;"><span style="font-weight: bold; color: #6b7280; display: inline-block; width: 200px;">Company:</span><span style="color: #111827;">${diagnostics.userCompany}</span></div>` : ''}
      ${diagnostics.userPhone ? `<div style="padding: 5px 0; border-bottom: 1px solid #e5e7eb;"><span style="font-weight: bold; color: #6b7280; display: inline-block; width: 200px;">Phone:</span><span style="color: #111827;">${diagnostics.userPhone}</span></div>` : ''}
    </div>

    <div style="background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #4f46e5;">
      <h3 style="margin-top: 0; color: #4f46e5;">🌐 Technical Details</h3>
      <p><strong>Browser:</strong> ${diagnostics.browserName} ${diagnostics.browserVersion} on ${diagnostics.platform}</p>
      <p><strong>Screen:</strong> ${diagnostics.screenResolution}</p>
      <p><strong>Page:</strong> <a href="${diagnostics.url}">${diagnostics.pageTitle}</a></p>
      <p style="font-size: 12px; color: #6b7280;"><em>Full technical details in diagnostics.json</em></p>
    </div>

    ${diagnostics.consoleLogs && diagnostics.consoleLogs.length > 0 ? `
    <div style="background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #4f46e5;">
      <h3 style="margin-top: 0; color: #4f46e5;">📋 Console Logs</h3>
      <p><strong>Total Entries:</strong> ${diagnostics.consoleLogs.length} (see diagnostics.json for full details)</p>
      <p><strong>Errors:</strong> ${diagnostics.consoleLogs.filter((log: any) => log.level === 'error').length}</p>
      <p><strong>Warnings:</strong> ${diagnostics.consoleLogs.filter((log: any) => log.level === 'warn').length}</p>
      <p style="font-size: 12px; color: #6b7280;"><em>Full console logs are available in the attached diagnostics.json file</em></p>
    </div>
    ` : ''}

    ${diagnostics.networkRequests && diagnostics.networkRequests.length > 0 ? `
    <div style="background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #4f46e5;">
      <h3 style="margin-top: 0; color: #4f46e5;">🌐 Network Requests</h3>
      <p><strong>Total Requests:</strong> ${diagnostics.networkRequests.length} (see diagnostics.json for full details)</p>
      <p><strong>Failed Requests:</strong> ${diagnostics.failedRequests?.length || 0}</p>
      <p style="font-size: 12px; color: #6b7280;"><em>Full network logs are available in the attached diagnostics.json file</em></p>
    </div>
    ` : ''}

    ${diagnostics.networkErrors && diagnostics.networkErrors.length > 0 ? `
    <div style="background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #dc2626;">
      <h3 style="margin-top: 0; color: #dc2626;">⚠️ Network Errors</h3>
      <p><strong>Total Errors:</strong> ${diagnostics.networkErrors.length}</p>
      <p><strong>First Error:</strong> ${diagnostics.networkErrors[0].type.toUpperCase()} - ${diagnostics.networkErrors[0].url.substring(0, 100)}${diagnostics.networkErrors[0].url.length > 100 ? '...' : ''}</p>
      <p style="font-size: 12px; color: #6b7280;"><em>Full error details are available in the attached diagnostics.json file</em></p>
    </div>
    ` : ''}


    ${diagnostics.errorMessage ? `
    <div style="background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #4f46e5;">
      <h3 style="margin-top: 0; color: #4f46e5;">⚠️ Error Details</h3>
      <div style="padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
        <span style="font-weight: bold; color: #6b7280; display: inline-block; width: 200px;">Error:</span>
        <span style="color: #dc2626; font-weight: bold;">${diagnostics.errorMessage}</span>
      </div>
      ${diagnostics.errorStack ? `
      <div style="padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
        <span style="font-weight: bold; color: #6b7280; display: inline-block; width: 200px;">Stack:</span>
        <span style="color: #111827;"><pre style="font-size: 11px; overflow-x: auto;">${diagnostics.errorStack}</pre></span>
      </div>
      ` : ''}
    </div>
    ` : ''}


    <div style="background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #4f46e5;">
      <h3 style="margin-top: 0; color: #4f46e5;">📎 Attachments</h3>
      <p>• Full diagnostics JSON file attached</p>
      ${diagnostics.screenshot ? '<p>• Screenshot attached</p>' : ''}
    </div>
  </div>

  <div style="padding: 20px; text-align: center; color: #6b7280; font-size: 12px;">
    <p>This is an automated support request from the AI Assistant Platform</p>
    <p>Generated at ${new Date().toISOString()}</p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Create plain text version of support template for Gmail compatibility
   */
  private createPlainTextTemplate(
    subject: string,
    description: string,
    diagnostics: any,
    priority: string = 'Medium'
  ): string {
    return `
==============================================
SUPPORT CASE - Template ID: 20240718SFT
==============================================

SUBJECT: ${subject}

==============================================
SALESFORCE SUPPORT CASE TEMPLATE
Official Template ID: 20240718SFT
==============================================

📝 DESCRIPTION OF THE PROBLEM
${description}

✅ EXPECTED RESULTS
${diagnostics.expectedResults || 'Feature should work as documented'}

❌ ACTUAL RESULTS
${diagnostics.actualResults || description}

🔧 WORKAROUND
${diagnostics.workaround || 'None identified at this time'}

⚠️ IMPACTS TO PRACTICE/PATIENTS
${diagnostics.impacts || 'User unable to complete task as expected'}

🎯 PRIORITY
${priority}

📋 STEPS TO REPRODUCE
- Page URL: ${diagnostics.url}
- Page Title: ${diagnostics.pageTitle}
- User Action: ${description}
- Timestamp: ${new Date().toLocaleString()}
${diagnostics.userName ? `- User: ${diagnostics.userName}${diagnostics.userCompany ? ` (${diagnostics.userCompany})` : ''}` : ''}

🔍 STEPS TO TRIAGE
- When did this start: ${new Date().toLocaleString()}
- Browser: ${diagnostics.browserName} ${diagnostics.browserVersion} on ${diagnostics.platform}
- Screen Resolution: ${diagnostics.screenResolution}
- Extension Version: ${diagnostics.extensionVersion || 'N/A'}
- Console Errors: ${diagnostics.consoleLogs ? diagnostics.consoleLogs.filter((log: any) => log.level === 'error').length : 0} error(s) found
- Network Failures: ${diagnostics.failedRequests?.length || 0} failed request(s)

🌐 ENVIRONMENT(S) FOUND
- Environment: Production
- Does issue exist in Production: Yes
- URL: ${diagnostics.url}

💻 AFFECTED PRODUCTS
- Browser: ${diagnostics.browserName} ${diagnostics.browserVersion}
- Platform: ${diagnostics.platform}
- Browser Extension: Eyecare AI Assistant v${diagnostics.extensionVersion || '1.1'}

📎 ADDITIONAL INFORMATION
- Screenshots: ${diagnostics.screenshot ? 'Yes (attached)' : 'No'}
- Screen Recording: ${diagnostics.screenRecording ? 'Yes (MP4 attached - see attachments)' : 'No'}
- Console Logs: ${diagnostics.consoleLogs ? `Yes (${diagnostics.consoleLogs.length} entries)` : 'No'}
- Network Data: ${diagnostics.networkRequests ? `Yes (${diagnostics.networkRequests.length} requests)` : 'No'}
- Diagnostic Data: Yes (JSON attached)

${diagnostics.screenRecording ? `
🎬 VIDEO OF ISSUE INCLUDED!
A screen recording (MP4 format) is attached showing the exact steps
that caused the issue. This will help you quickly understand and
reproduce the problem.
` : ''}

👤 CONTACT INFORMATION
${diagnostics.userName ? `Name: ${diagnostics.userName}` : 'User information not available'}
${diagnostics.userEmail ? `Email: ${diagnostics.userEmail}` : ''}
${diagnostics.userCompany ? `Company: ${diagnostics.userCompany}` : ''}
${diagnostics.userPhone ? `Phone: ${diagnostics.userPhone}` : ''}

🌐 BROWSER INFORMATION
- Browser: ${diagnostics.browserName} ${diagnostics.browserVersion}
- Platform: ${diagnostics.platform}
- User Agent: ${diagnostics.userAgent}

📱 SCREEN & DISPLAY
- Resolution: ${diagnostics.screenResolution}
- Viewport: ${diagnostics.viewport}

🔗 PAGE CONTEXT
- URL: ${diagnostics.url}
- Page Title: ${diagnostics.pageTitle}
${diagnostics.referrer ? `- Referrer: ${diagnostics.referrer}` : ''}

📎 ATTACHMENTS
• Full diagnostics JSON file attached
${diagnostics.screenshot ? '• Screenshot attached' : ''}
${diagnostics.screenRecording ? '• Screen recording (MP4) attached' : ''}

==============================================
Generated: ${new Date().toISOString()}
This is an automated support request from the AI Assistant Platform
==============================================
`;
  }

  /**
   * Strip HTML tags for plain text version
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }
}

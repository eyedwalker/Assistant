/**
 * SMSManager - VBD Manager Layer
 * 
 * Orchestrates SMS business logic for eyecare workflows
 * Handles volatile, domain-specific SMS operations with user permissions
 */

import { TwilioAccessor, SMSMessage, SMSResult } from '../accessors/TwilioAccessor';
import { MongoDBAccessor } from '../accessors/MongoDBAccessor';

export interface SMSNotificationRequest {
  userId?: string;
  tenantId: string;
  recipients: string[];
  type: 'appointment_reminder' | 'prescription_ready' | 'contact_lens_reorder' | 'price_alert' | 'system_alert' | 'custom';
  templateData?: {
    patientName?: string;
    appointmentDate?: string;
    practiceName?: string;
    practicePhone?: string;
    productName?: string;
    savings?: string;
    retailer?: string;
    message?: string;
  };
  customMessage?: string;
  scheduleFor?: Date;
}

export interface SMSNotificationResult {
  success: boolean;
  totalSent: number;
  results: Array<{
    recipient: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
  error?: string;
}

export interface SMSSettings {
  userId: string;
  tenantId: string;
  phoneNumber: string;
  optedIn: boolean;
  notificationTypes: string[];
  quietHours?: {
    start: string; // HH:MM format
    end: string;   // HH:MM format
    timezone: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface SMSLog {
  messageId: string;
  userId?: string;
  tenantId: string;
  recipient: string;
  type: string;
  content: string;
  status: string;
  sentAt: Date;
  deliveredAt?: Date;
  error?: string;
}

export class SMSManager {
  private twilioAccessor: TwilioAccessor;
  private mongoAccessor: MongoDBAccessor;

  constructor(mongoAccessor: MongoDBAccessor) {
    this.twilioAccessor = new TwilioAccessor();
    this.mongoAccessor = mongoAccessor;
  }

  /**
   * Send SMS notification with business logic
   */
  async sendNotification(request: SMSNotificationRequest): Promise<SMSNotificationResult> {
    try {
      await this.mongoAccessor.connect();

      // Validate recipients and get their SMS preferences
      const validRecipients = await this.getValidRecipients(request.recipients, request.type, request.tenantId);
      
      if (validRecipients.length === 0) {
        return {
          success: false,
          totalSent: 0,
          results: [],
          error: 'No valid recipients found'
        };
      }

      // Generate message content
      const messageContent = this.generateMessageContent(request.type, request.templateData, request.customMessage);
      
      // Check quiet hours for each recipient
      const recipientsToSend = await this.filterByQuietHours(validRecipients);

      // Send SMS messages
      const smsMessages: SMSMessage[] = recipientsToSend.map(recipient => ({
        to: recipient.phoneNumber,
        body: messageContent
      }));

      const results = await this.twilioAccessor.sendBulkSMS(smsMessages);
      
      // Log all SMS attempts
      await this.logSMSAttempts(request, recipientsToSend, results, messageContent);

      // Update user SMS history
      await this.updateSMSHistory(request.tenantId, results);

      const successfulSends = results.filter(r => r.success).length;

      return {
        success: successfulSends > 0,
        totalSent: successfulSends,
        results: results.map((result, index) => ({
          recipient: recipientsToSend[index]?.phoneNumber || 'unknown',
          success: result.success,
          messageId: result.messageId,
          error: result.error
        }))
      };
    } catch (error) {
      return {
        success: false,
        totalSent: 0,
        results: [],
        error: error instanceof Error ? error.message : 'Failed to send SMS notifications'
      };
    } finally {
      await this.mongoAccessor.disconnect();
    }
  }

  /**
   * Update user SMS preferences
   */
  async updateSMSSettings(settings: Omit<SMSSettings, 'createdAt' | 'updatedAt'>): Promise<boolean> {
    try {
      await this.mongoAccessor.connect();

      // Validate phone number format
      const formattedPhone = this.twilioAccessor.formatPhoneNumber(settings.phoneNumber);
      const validation = await this.twilioAccessor.validatePhoneNumber(formattedPhone);
      
      if (!validation.isValid) {
        throw new Error('Invalid phone number format');
      }

      const smsSettings: SMSSettings = {
        ...settings,
        phoneNumber: formattedPhone,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Upsert SMS settings
      const existingSettings = await this.mongoAccessor.find('smsSettings', {
        userId: settings.userId,
        tenantId: settings.tenantId
      });

      if (existingSettings.length > 0) {
        await this.mongoAccessor.update('smsSettings', existingSettings[0]._id, {
          ...smsSettings,
          createdAt: existingSettings[0].createdAt,
          updatedAt: new Date()
        });
      } else {
        await this.mongoAccessor.create('smsSettings', smsSettings);
      }

      return true;
    } catch (error) {
      console.error('Failed to update SMS settings:', error);
      return false;
    } finally {
      await this.mongoAccessor.disconnect();
    }
  }

  /**
   * Get user SMS settings
   */
  async getSMSSettings(userId: string, tenantId: string): Promise<SMSSettings | null> {
    try {
      await this.mongoAccessor.connect();

      const settings = await this.mongoAccessor.find('smsSettings', { userId, tenantId });
      return settings.length > 0 ? settings[0] : null;
    } catch (error) {
      console.error('Failed to get SMS settings:', error);
      return null;
    } finally {
      await this.mongoAccessor.disconnect();
    }
  }

  /**
   * Opt user out of SMS notifications
   */
  async optOut(phoneNumber: string, tenantId: string): Promise<boolean> {
    try {
      await this.mongoAccessor.connect();

      const formattedPhone = this.twilioAccessor.formatPhoneNumber(phoneNumber);
      
      const existingSettings = await this.mongoAccessor.find('smsSettings', { phoneNumber: formattedPhone, tenantId });
      if (existingSettings.length > 0) {
        await this.mongoAccessor.update('smsSettings', existingSettings[0]._id, { 
          optedIn: false, 
          updatedAt: new Date() 
        });
      }

      // Log opt-out event
      await this.mongoAccessor.create('smsLogs', {
        tenantId,
        recipient: formattedPhone,
        type: 'opt_out',
        content: 'User opted out of SMS notifications',
        status: 'processed',
        sentAt: new Date()
      });

      return true;
    } catch (error) {
      console.error('Failed to opt out user:', error);
      return false;
    } finally {
      await this.mongoAccessor.disconnect();
    }
  }

  /**
   * Get SMS usage statistics
   */
  async getSMSStats(tenantId: string, startDate?: Date, endDate?: Date): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
    byType: Record<string, number>;
    cost: string;
  }> {
    try {
      await this.mongoAccessor.connect();

      const query: any = { tenantId };
      if (startDate || endDate) {
        query.sentAt = {};
        if (startDate) query.sentAt.$gte = startDate;
        if (endDate) query.sentAt.$lte = endDate;
      }

      const logs = await this.mongoAccessor.find('smsLogs', query);
      
      const stats = logs.reduce((acc: any, log: any) => {
        acc.totalSent++;
        if (log.status === 'delivered') acc.totalDelivered++;
        if (log.status === 'failed') acc.totalFailed++;
        acc.byType[log.type] = (acc.byType[log.type] || 0) + 1;
        return acc;
      }, {
        totalSent: 0,
        totalDelivered: 0,
        totalFailed: 0,
        byType: {},
        cost: '0.00'
      });

      // Get Twilio usage stats for cost
      const twilioStats = await this.twilioAccessor.getUsageStats();
      if (twilioStats) {
        stats.cost = twilioStats.cost;
      }

      return stats;
    } catch (error) {
      console.error('Failed to get SMS stats:', error);
      return {
        totalSent: 0,
        totalDelivered: 0,
        totalFailed: 0,
        byType: {},
        cost: '0.00'
      };
    } finally {
      await this.mongoAccessor.disconnect();
    }
  }

  /**
   * Private: Get valid recipients based on opt-in status
   */
  private async getValidRecipients(
    phoneNumbers: string[], 
    notificationType: string, 
    tenantId: string
  ): Promise<Array<{ phoneNumber: string; userId?: string }>> {
    const validRecipients: Array<{ phoneNumber: string; userId?: string }> = [];

    for (const phone of phoneNumbers) {
      const formattedPhone = this.twilioAccessor.formatPhoneNumber(phone);
      
      // Check if user has opted in for this type of notification
      const settings = await this.mongoAccessor.find('smsSettings', {
        phoneNumber: formattedPhone,
        tenantId,
        optedIn: true
      });

      if (settings.length > 0) {
        const userSettings = settings[0];
        if (userSettings.notificationTypes.includes(notificationType) || userSettings.notificationTypes.includes('all')) {
          validRecipients.push({
            phoneNumber: formattedPhone,
            userId: userSettings.userId
          });
        }
      }
    }

    return validRecipients;
  }

  /**
   * Private: Filter recipients by quiet hours
   */
  private async filterByQuietHours(
    recipients: Array<{ phoneNumber: string; userId?: string }>
  ): Promise<Array<{ phoneNumber: string; userId?: string }>> {
    // For now, return all recipients - quiet hours filtering can be enhanced
    // with timezone support and user-specific quiet hour settings
    return recipients;
  }

  /**
   * Private: Generate message content based on type and template data
   */
  private generateMessageContent(
    type: string, 
    templateData?: any, 
    customMessage?: string
  ): string {
    if (customMessage) {
      return customMessage;
    }

    const templates = TwilioAccessor.createEyecareTemplates();

    switch (type) {
      case 'appointment_reminder':
        return templates.appointmentReminder(
          templateData?.patientName || 'Patient',
          templateData?.appointmentDate || 'your scheduled date',
          templateData?.practiceName || 'our practice'
        );
      case 'prescription_ready':
        return templates.prescriptionReady(
          templateData?.patientName || 'Patient',
          templateData?.practiceName || 'our practice'
        );
      case 'contact_lens_reorder':
        return templates.contactLensReorder(
          templateData?.patientName || 'Patient',
          templateData?.practicePhone || 'us'
        );
      case 'price_alert':
        return templates.priceAlert(
          templateData?.productName || 'Product',
          templateData?.savings || 'money',
          templateData?.retailer || 'retailer'
        );
      case 'system_alert':
        return templates.systemAlert(templateData?.message || 'System notification');
      default:
        return templateData?.message || 'Notification from your eyecare provider';
    }
  }

  /**
   * Private: Log SMS attempts to database
   */
  private async logSMSAttempts(
    request: SMSNotificationRequest,
    recipients: Array<{ phoneNumber: string; userId?: string }>,
    results: SMSResult[],
    content: string
  ): Promise<void> {
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      const result = results[i];

      const log: SMSLog = {
        messageId: result.messageId || 'failed',
        userId: recipient.userId,
        tenantId: request.tenantId,
        recipient: recipient.phoneNumber,
        type: request.type,
        content,
        status: result.success ? 'sent' : 'failed',
        sentAt: new Date(),
        error: result.error
      };

      await this.mongoAccessor.create('smsLogs', log);
    }
  }

  /**
   * Private: Update SMS history for analytics
   */
  private async updateSMSHistory(tenantId: string, results: SMSResult[]): Promise<void> {
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    // Update daily SMS counts
    const today = new Date().toISOString().split('T')[0];
    const existingHistory = await this.mongoAccessor.find('smsHistory', {
      tenantId,
      date: today
    });

    if (existingHistory.length > 0) {
      const history = existingHistory[0];
      await this.mongoAccessor.update('smsHistory', history._id, {
        sent: history.sent + successCount,
        failed: history.failed + failCount,
        updatedAt: new Date()
      });
    } else {
      await this.mongoAccessor.create('smsHistory', {
        tenantId,
        date: today,
        sent: successCount,
        failed: failCount,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }
}

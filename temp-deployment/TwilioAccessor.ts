/**
 * TwilioAccessor - VBD Accessor Layer
 * 
 * Handles all Twilio SMS operations - stable, technology-specific
 * Provides clean interface for SMS communication with no business logic
 */

import twilio from 'twilio';
import { Twilio } from 'twilio';

export interface SMSResult {
  success: boolean;
  messageId?: string;
  status?: string;
  error?: string;
}

export interface SMSMessage {
  to: string;
  body: string;
  from?: string;
  mediaUrl?: string[];
}

export interface SMSStatus {
  messageId: string;
  status: string;
  errorCode?: string;
  errorMessage?: string;
  dateCreated: Date;
  dateSent?: Date;
  dateUpdated: Date;
}

export interface SMSValidationResult {
  isValid: boolean;
  phoneNumber?: string;
  countryCode?: string;
  nationalFormat?: string;
  error?: string;
}

export class TwilioAccessor {
  private client: Twilio;
  private fromNumber: string;

  constructor(
    accountSid: string = process.env.TWILIO_ACCOUNT_SID!,
    authToken: string = process.env.TWILIO_AUTH_TOKEN!,
    fromNumber: string = process.env.TWILIO_PHONE_NUMBER!
  ) {
    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('Missing required Twilio credentials: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER');
    }

    this.client = twilio(accountSid, authToken);
    this.fromNumber = fromNumber;
  }

  /**
   * Send SMS message
   */
  async sendSMS(message: SMSMessage): Promise<SMSResult> {
    try {
      const twilioMessage = await this.client.messages.create({
        body: message.body,
        from: message.from || this.fromNumber,
        to: message.to,
        ...(message.mediaUrl && { mediaUrl: message.mediaUrl })
      });

      return {
        success: true,
        messageId: twilioMessage.sid,
        status: twilioMessage.status
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown Twilio SMS error'
      };
    }
  }

  /**
   * Send bulk SMS messages
   */
  async sendBulkSMS(messages: SMSMessage[]): Promise<SMSResult[]> {
    const results: SMSResult[] = [];
    
    // Process messages in batches to avoid rate limiting
    const batchSize = 10;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      
      const batchPromises = batch.map(message => this.sendSMS(message));
      const batchResults = await Promise.all(batchPromises);
      
      results.push(...batchResults);
      
      // Small delay between batches to respect rate limits
      if (i + batchSize < messages.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Get message status
   */
  async getMessageStatus(messageId: string): Promise<SMSStatus | null> {
    try {
      const message = await this.client.messages(messageId).fetch();

      return {
        messageId: message.sid,
        status: message.status,
        errorCode: message.errorCode?.toString() || undefined,
        errorMessage: message.errorMessage || undefined,
        dateCreated: new Date(message.dateCreated),
        dateSent: message.dateSent ? new Date(message.dateSent) : undefined,
        dateUpdated: new Date(message.dateUpdated)
      };
    } catch (error) {
      console.error('Failed to fetch message status:', error);
      return null;
    }
  }

  /**
   * Validate phone number format
   */
  async validatePhoneNumber(phoneNumber: string): Promise<SMSValidationResult> {
    try {
      const lookup = await this.client.lookups.v2.phoneNumbers(phoneNumber).fetch();

      return {
        isValid: lookup.valid || false,
        phoneNumber: lookup.phoneNumber,
        countryCode: lookup.countryCode,
        nationalFormat: lookup.nationalFormat,
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Phone validation failed'
      };
    }
  }

  /**
   * Format phone number to E.164 format
   */
  formatPhoneNumber(phoneNumber: string, defaultCountryCode: string = 'US'): string {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // If it starts with 1 and has 11 digits (US format), keep as is
    if (digits.length === 11 && digits.startsWith('1')) {
      return '+' + digits;
    }
    
    // If it has 10 digits, assume US and add +1
    if (digits.length === 10 && defaultCountryCode === 'US') {
      return '+1' + digits;
    }
    
    // If it doesn't start with +, add it
    if (!phoneNumber.startsWith('+')) {
      return '+' + digits;
    }
    
    return phoneNumber;
  }

  /**
   * Get account balance
   */
  async getAccountBalance(): Promise<{ balance: string; currency: string } | null> {
    try {
      const account = await this.client.api.accounts(this.client.accountSid).fetch();
      return {
        balance: account.balance,
        currency: account.balanceCurrency || 'USD'
      };
    } catch (error) {
      console.error('Failed to fetch account balance:', error);
      return null;
    }
  }

  /**
   * Get SMS usage for current month
   */
  async getUsageStats(): Promise<{ 
    messagesSent: number; 
    cost: string; 
    period: string; 
  } | null> {
    try {
      const usage = await this.client.usage.records.list({
        category: 'sms',
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        endDate: new Date()
      });

      if (usage.length === 0) {
        return { messagesSent: 0, cost: '0.00', period: 'current month' };
      }

      const totalUsage = usage.reduce((sum, record) => ({
        count: sum.count + parseInt(record.usage),
        price: sum.price + parseFloat(record.price)
      }), { count: 0, price: 0 });

      return {
        messagesSent: totalUsage.count,
        cost: totalUsage.price.toFixed(2),
        period: 'current month'
      };
    } catch (error) {
      console.error('Failed to fetch usage stats:', error);
      return null;
    }
  }

  /**
   * List recent messages
   */
  async getRecentMessages(limit: number = 20): Promise<Array<{
    messageId: string;
    to: string;
    from: string;
    body: string;
    status: string;
    dateCreated: Date;
  }>> {
    try {
      const messages = await this.client.messages.list({ limit });
      
      return messages.map(message => ({
        messageId: message.sid,
        to: message.to,
        from: message.from,
        body: message.body,
        status: message.status,
        dateCreated: new Date(message.dateCreated)
      }));
    } catch (error) {
      console.error('Failed to fetch recent messages:', error);
      return [];
    }
  }

  /**
   * Check if phone number can receive SMS
   */
  isValidSMSNumber(phoneNumber: string): boolean {
    // Basic validation - should be improved with actual Twilio lookup
    const e164Pattern = /^\+[1-9]\d{1,14}$/;
    return e164Pattern.test(phoneNumber);
  }

  /**
   * Create SMS template for common eyecare notifications
   */
  static createEyecareTemplates() {
    return {
      appointmentReminder: (patientName: string, appointmentDate: string, practiceName: string) => 
        `Hi ${patientName}, this is a reminder of your appointment at ${practiceName} on ${appointmentDate}. Reply STOP to opt out.`,
      
      prescriptionReady: (patientName: string, practiceName: string) => 
        `Hi ${patientName}, your prescription is ready for pickup at ${practiceName}. Reply STOP to opt out.`,
      
      contactLensReorder: (patientName: string, practicePhone: string) => 
        `Hi ${patientName}, it's time to reorder your contact lenses. Call us at ${practicePhone} or reply STOP to opt out.`,
      
      priceAlert: (productName: string, savings: string, retailer: string) => 
        `💰 Price Alert: ${productName} - Save ${savings} at ${retailer}! Reply STOP to opt out.`,
      
      systemAlert: (message: string) => 
        `🏥 System Alert: ${message}. Reply STOP to opt out.`
    };
  }
}

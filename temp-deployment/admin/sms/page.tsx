/**
 * SMS Admin Dashboard
 * /admin/sms
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Users, DollarSign, Send, Settings, BarChart3 } from 'lucide-react';

interface SMSStats {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  byType: Record<string, number>;
  cost: string;
}

interface SMSSettings {
  phoneNumber: string;
  optedIn: boolean;
  notificationTypes: string[];
}

export default function SMSAdminPage() {
  const [stats, setStats] = useState<SMSStats | null>(null);
  const [settings, setSettings] = useState<SMSSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Form states
  const [recipients, setRecipients] = useState('');
  const [messageType, setMessageType] = useState('custom');
  const [customMessage, setCustomMessage] = useState('');
  const [templateData, setTemplateData] = useState({
    patientName: '',
    appointmentDate: '',
    practiceName: '',
    practicePhone: '',
    productName: '',
    savings: '',
    retailer: ''
  });

  useEffect(() => {
    loadSMSData();
  }, []);

  const loadSMSData = async () => {
    try {
      // Load SMS stats
      const statsResponse = await fetch('/api/sms/stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.data);
      }

      // Load SMS settings
      const settingsResponse = await fetch('/api/sms/settings');
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        setSettings(settingsData.data);
      }
    } catch (error) {
      console.error('Failed to load SMS data:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendTestSMS = async () => {
    if (!recipients.trim()) {
      alert('Please enter at least one recipient phone number');
      return;
    }

    setSending(true);
    try {
      const recipientList = recipients.split(',').map(r => r.trim()).filter(Boolean);
      
      const payload = {
        recipients: recipientList,
        type: messageType,
        ...(messageType === 'custom' ? { customMessage } : { templateData })
      };

      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`SMS sent successfully to ${result.data.totalSent} recipients`);
        setRecipients('');
        setCustomMessage('');
        await loadSMSData(); // Refresh stats
      } else {
        alert(`Failed to send SMS: ${result.error}`);
      }
    } catch (error) {
      alert('Error sending SMS');
    } finally {
      setSending(false);
    }
  };

  const testTwilioConnection = async () => {
    try {
      const response = await fetch('/api/sms/test');
      const result = await response.json();
      
      if (result.success) {
        alert(`Twilio Connection Test:\n${JSON.stringify(result.data, null, 2)}`);
      } else {
        alert(`Twilio Connection Failed:\n${result.error}`);
      }
    } catch (error) {
      alert('Error testing Twilio connection');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">SMS Management</h1>
        <Button onClick={testTwilioConnection} variant="outline">
          <Settings className="w-4 h-4 mr-2" />
          Test Connection
        </Button>
      </div>

      {/* SMS Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalSent || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.totalDelivered || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.totalFailed || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats?.cost || '0.00'}</div>
          </CardContent>
        </Card>
      </div>

      {/* Message Types Breakdown */}
      {stats?.byType && Object.keys(stats.byType).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Message Types</CardTitle>
            <CardDescription>Breakdown of SMS by notification type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byType).map(([type, count]) => (
                <Badge key={type} variant="secondary">
                  {type.replace('_', ' ')}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Send SMS Form */}
      <Card>
        <CardHeader>
          <CardTitle>Send SMS Campaign</CardTitle>
          <CardDescription>Send SMS notifications to patients</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="recipients">Recipients (comma-separated phone numbers)</Label>
            <Textarea
              id="recipients"
              placeholder="+1234567890, +0987654321"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="messageType">Message Type</Label>
            <Select value={messageType} onValueChange={setMessageType}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="appointment_reminder">Appointment Reminder</SelectItem>
                <SelectItem value="prescription_ready">Prescription Ready</SelectItem>
                <SelectItem value="contact_lens_reorder">Contact Lens Reorder</SelectItem>
                <SelectItem value="price_alert">Price Alert</SelectItem>
                <SelectItem value="system_alert">System Alert</SelectItem>
                <SelectItem value="custom">Custom Message</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {messageType === 'custom' ? (
            <div>
              <Label htmlFor="customMessage">Custom Message</Label>
              <Textarea
                id="customMessage"
                placeholder="Enter your custom message..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="mt-1"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <Label>Template Data</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="patientName">Patient Name</Label>
                  <Input
                    id="patientName"
                    value={templateData.patientName}
                    onChange={(e) => setTemplateData({...templateData, patientName: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="practiceName">Practice Name</Label>
                  <Input
                    id="practiceName"
                    value={templateData.practiceName}
                    onChange={(e) => setTemplateData({...templateData, practiceName: e.target.value})}
                  />
                </div>
                {messageType === 'appointment_reminder' && (
                  <div>
                    <Label htmlFor="appointmentDate">Appointment Date</Label>
                    <Input
                      id="appointmentDate"
                      type="datetime-local"
                      value={templateData.appointmentDate}
                      onChange={(e) => setTemplateData({...templateData, appointmentDate: e.target.value})}
                    />
                  </div>
                )}
                {messageType === 'contact_lens_reorder' && (
                  <div>
                    <Label htmlFor="practicePhone">Practice Phone</Label>
                    <Input
                      id="practicePhone"
                      value={templateData.practicePhone}
                      onChange={(e) => setTemplateData({...templateData, practicePhone: e.target.value})}
                    />
                  </div>
                )}
                {messageType === 'price_alert' && (
                  <>
                    <div>
                      <Label htmlFor="productName">Product Name</Label>
                      <Input
                        id="productName"
                        value={templateData.productName}
                        onChange={(e) => setTemplateData({...templateData, productName: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="savings">Savings</Label>
                      <Input
                        id="savings"
                        value={templateData.savings}
                        onChange={(e) => setTemplateData({...templateData, savings: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="retailer">Retailer</Label>
                      <Input
                        id="retailer"
                        value={templateData.retailer}
                        onChange={(e) => setTemplateData({...templateData, retailer: e.target.value})}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <Button onClick={sendTestSMS} disabled={sending} className="w-full">
            {sending ? 'Sending...' : 'Send SMS Campaign'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

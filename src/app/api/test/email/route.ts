/**
 * Test Email API - SendGrid Integration Test
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { EmailService } from '@/lib/integrations/email-service';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, subject = 'Test Email from AI Payroll System' } = await request.json();
    
    if (!to) {
      return NextResponse.json({ error: 'Recipient email required' }, { status: 400 });
    }

    const emailService = new EmailService({
      apiKey: process.env.SENDGRID_API_KEY || '',
      fromEmail: process.env.SENDGRID_FROM_EMAIL || '',
      fromName: 'AI Payroll System'
    });

    const result = await emailService.sendSystemNotification(
      subject,
      `Hello! This is a test email from your AI Payroll System.\n\n` +
      `✅ SendGrid integration is working correctly!\n` +
      `✅ Email service is properly configured\n` +
      `✅ System notifications will be delivered\n\n` +
      `Sent at: ${new Date().toISOString()}\n` +
      `From: ${process.env.SENDGRID_FROM_EMAIL}`,
      'normal'
    );

    return NextResponse.json({
      success: result.success,
      message: result.success ? 'Test email sent successfully!' : 'Failed to send test email',
      details: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Test email failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to send test email',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

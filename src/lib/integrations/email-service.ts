/**
 * Email Service Integration with SendGrid
 * Handles invoice delivery, payment notifications, and payout confirmations
 */

import sgMail from '@sendgrid/mail';

export interface EmailConfig {
  apiKey: string;
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
}

export interface EmailTemplate {
  templateId?: string;
  subject: string;
  html: string;
  text: string;
  dynamicData?: Record<string, any>;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType: string;
  disposition?: 'attachment' | 'inline';
}

export interface EmailRequest {
  to: string | string[];
  template: EmailTemplate;
  attachments?: EmailAttachment[];
  priority?: 'low' | 'normal' | 'high';
  sendAt?: Date;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  deliveryStatus?: 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed';
}

export class EmailService {
  private fromEmail: string;
  private fromName: string;
  private replyTo?: string;
  private initialized: boolean = false;

  constructor(config: EmailConfig) {
    this.fromEmail = config.fromEmail || process.env.SENDGRID_FROM_EMAIL || 'noreply@ai-payroll.com';
    this.fromName = config.fromName || 'Foss It System';
    this.replyTo = config.replyTo;
    
    const apiKey = config.apiKey || process.env.SENDGRID_API_KEY;
    
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.initialized = true;
    } else {
      console.warn('SendGrid API key not configured. Email operations will be simulated.');
    }
  }

  /**
   * Send invoice email to corporate user
   */
  async sendInvoiceEmail(
    invoiceId: string, 
    recipientEmail: string, 
    invoiceData: any
  ): Promise<EmailResult> {
    try {
      console.log(`Sending invoice email for ${invoiceId} to ${recipientEmail}`);
      
      const template = await this.generateInvoiceTemplate(invoiceData);
      const pdfAttachment = await this.generateInvoicePDF(invoiceData);
      
      const emailRequest: EmailRequest = {
        to: recipientEmail,
        template,
        attachments: pdfAttachment ? [pdfAttachment] : [],
        priority: 'high'
      };

      const result = await this.sendEmail(emailRequest);
      
      // Update invoice record
      await this.updateInvoiceEmailStatus(invoiceId, result.success, result.messageId);
      
      return result;
    } catch (error) {
      console.error('Invoice email failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Invoice email failed'
      };
    }
  }

  /**
   * Send payout confirmation to contributor
   */
  async sendPayoutConfirmation(
    payoutId: string,
    contributorEmail: string,
    payoutData: any
  ): Promise<EmailResult> {
    try {
      console.log(`Sending payout confirmation for ${payoutId} to ${contributorEmail}`);
      
      const template = await this.generatePayoutTemplate(payoutData);
      
      const emailRequest: EmailRequest = {
        to: contributorEmail,
        template,
        priority: 'normal'
      };

      return await this.sendEmail(emailRequest);
    } catch (error) {
      console.error('Payout confirmation email failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payout confirmation failed'
      };
    }
  }

  /**
   * Send batch payout notifications to all contributors
   */
  async sendBatchPayoutNotifications(runId: string): Promise<EmailResult[]> {
    try {
      const { prisma } = await import('@/lib/db');
      
      // Get payroll run with payouts and contributor info
      const run = await prisma.payrollRun.findUnique({
        where: { id: runId },
        include: {
          payouts: {
            include: {
              contributor: {
                include: { user: true }
              }
            }
          },
          repositories: true
        }
      });

      if (!run) {
        throw new Error('Payroll run not found');
      }

      const results: EmailResult[] = [];

      // Send email to each contributor
      for (const payout of run.payouts) {
        if (payout.contributor?.user?.email) {
          const payoutData = {
            runId: run.id,
            runNumber: run.runNumber,
            period: {
              startDate: run.startDate,
              endDate: run.endDate
            },
            repositories: run.repositories.map(r => r.fullName),
            payout: {
              usdAmount: payout.usdAmount,
              nativeAmount: payout.nativeAmount,
              asset: run.asset,
              prCount: payout.prCount,
              shareRatio: payout.shareRatio,
              transactionId: payout.txId,
              status: payout.status
            },
            contributor: {
              githubHandle: payout.contributor.githubHandle,
              hederaAccountId: payout.contributor.hederaAccountId
            }
          };

          const result = await this.sendPayoutConfirmation(
            payout.id,
            payout.contributor.user.email,
            payoutData
          );
          
          results.push(result);
        }
      }

      return results;
    } catch (error) {
      console.error('Batch payout notifications failed:', error);
      return [{
        success: false,
        error: error instanceof Error ? error.message : 'Batch notifications failed'
      }];
    }
  }

  /**
   * Send payment reminder for overdue invoices
   */
  async sendPaymentReminder(invoiceId: string): Promise<EmailResult> {
    try {
      const { prisma } = await import('@/lib/db');
      
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          corporateUser: true,
          agent: {
            include: { repository: true }
          }
        }
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const template = await this.generateReminderTemplate(invoice);
      
      const recipientEmail = invoice.corporateUser?.email || 'billing@company.com';
      
      const emailRequest: EmailRequest = {
        to: recipientEmail,
        template,
        priority: 'high'
      };

      return await this.sendEmail(emailRequest);
    } catch (error) {
      console.error('Payment reminder failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment reminder failed'
      };
    }
  }

  /**
   * Send system notification to admin
   */
  async sendSystemNotification(
    subject: string,
    message: string,
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): Promise<EmailResult> {
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@ai-payroll.com';
      
      const template: EmailTemplate = {
        subject: `[Foss It System] ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">System Notification</h2>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 5px;">
              <p><strong>Subject:</strong> ${subject}</p>
              <p><strong>Priority:</strong> ${priority.toUpperCase()}</p>
              <p><strong>Time:</strong> ${new Date().toISOString()}</p>
            </div>
            <div style="margin-top: 20px; padding: 20px; border-left: 4px solid #007cba;">
              ${message}
            </div>
          </div>
        `,
        text: `System Notification\n\nSubject: ${subject}\nPriority: ${priority}\nTime: ${new Date().toISOString()}\n\n${message}`
      };

      const emailRequest: EmailRequest = {
        to: adminEmail,
        template,
        priority
      };

      return await this.sendEmail(emailRequest);
    } catch (error) {
      console.error('System notification failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'System notification failed'
      };
    }
  }

  /**
   * Core email sending method
   */
  private async sendEmail(request: EmailRequest): Promise<EmailResult> {
    try {
      if (!this.initialized) {
        return await this.simulateEmailSend(request);
      }

      const message: any = {
        to: request.to,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject: request.template.subject,
        text: request.template.text,
        html: request.template.html
      };

      if (this.replyTo) {
        message.replyTo = this.replyTo;
      }

      if (request.attachments && request.attachments.length > 0) {
        message.attachments = request.attachments.map(att => ({
          filename: att.filename,
          content: typeof att.content === 'string' 
            ? att.content 
            : att.content.toString('base64'),
          type: att.contentType,
          disposition: att.disposition || 'attachment'
        }));
      }

      if (request.template.dynamicData) {
        message.dynamicTemplateData = request.template.dynamicData;
      }

      if (request.template.templateId) {
        message.templateId = request.template.templateId;
      }

      const response = await sgMail.send(message);
      
      return {
        success: true,
        messageId: response[0]?.headers?.['x-message-id'] || 'sent',
        deliveryStatus: 'queued'
      };
    } catch (error) {
      console.error('Email send failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Email send failed'
      };
    }
  }

  /**
   * Generate invoice email template
   */
  private async generateInvoiceTemplate(invoiceData: any): Promise<EmailTemplate> {
    const dueDate = new Date(invoiceData.dueDate).toLocaleDateString();
    
    return {
      subject: `Invoice ${invoiceData.invoiceNumber} - Repository Usage Billing`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #007cba;">Foss It System</h1>
          <h2>Invoice ${invoiceData.invoiceNumber}</h2>
          
          <div style="background: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3>Bill To:</h3>
            <p><strong>${invoiceData.organizationName}</strong></p>
            <p>Repository Usage Period: ${invoiceData.period}</p>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #007cba; color: white;">
              <th style="padding: 10px; text-align: left;">Description</th>
              <th style="padding: 10px; text-align: right;">Amount</th>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">
                Repository usage and corporate access
              </td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">
                $${invoiceData.amount.toFixed(2)} ${invoiceData.currency}
              </td>
            </tr>
          </table>
          
          <div style="text-align: right; margin: 20px 0;">
            <h3>Total: $${invoiceData.amount.toFixed(2)} ${invoiceData.currency}</h3>
          </div>
          
          <div style="background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107;">
            <p><strong>Due Date:</strong> ${dueDate}</p>
            <p><strong>Payment Method:</strong> Cryptocurrency transfer</p>
            ${invoiceData.walletAddress ? `<p><strong>Wallet Address:</strong> ${invoiceData.walletAddress}</p>` : ''}
          </div>
          
          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            This invoice was automatically generated by Foss It System.
            For questions, please contact support@ai-payroll.com
          </p>
        </div>
      `,
      text: `
Invoice ${invoiceData.invoiceNumber}

Bill To: ${invoiceData.organizationName}
Period: ${invoiceData.period}
Amount: $${invoiceData.amount.toFixed(2)} ${invoiceData.currency}
Due Date: ${dueDate}

${invoiceData.walletAddress ? `Payment Wallet: ${invoiceData.walletAddress}` : ''}

This invoice was automatically generated by Foss It System.
      `
    };
  }

  /**
   * Generate payout confirmation template
   */
  private async generatePayoutTemplate(payoutData: any): Promise<EmailTemplate> {
    return {
      subject: `Payout Confirmation - Run #${payoutData.runNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #28a745;">🎉 Payout Confirmed!</h1>
          
          <div style="background: #d4edda; padding: 20px; border-radius: 5px; border-left: 4px solid #28a745;">
            <h3>Your contribution has been rewarded!</h3>
            <p>Payroll Run #${payoutData.runNumber} has been processed successfully.</p>
          </div>
          
          <div style="margin: 30px 0;">
            <h3>Payout Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Period:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">
                  ${new Date(payoutData.period.startDate).toLocaleDateString()} - 
                  ${new Date(payoutData.period.endDate).toLocaleDateString()}
                </td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Repositories:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">
                  ${payoutData.repositories.join(', ')}
                </td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>PRs Merged:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${payoutData.payout.prCount}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Your Share:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">
                  ${(payoutData.payout.shareRatio * 100).toFixed(2)}%
                </td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Amount (USD):</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">$${payoutData.payout.usdAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Amount (${payoutData.payout.asset}):</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${payoutData.payout.nativeAmount}</td>
              </tr>
              ${payoutData.payout.transactionId ? `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Transaction ID:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd; font-family: monospace; font-size: 12px;">
                  ${payoutData.payout.transactionId}
                </td>
              </tr>` : ''}
            </table>
          </div>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
            <p><strong>Hedera Account:</strong> ${payoutData.contributor.hederaAccountId}</p>
            <p><strong>Status:</strong> ${payoutData.payout.status}</p>
          </div>
          
          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            Thank you for your contributions! Keep up the great work.
          </p>
        </div>
      `,
      text: `
🎉 Payout Confirmed!

Your contribution has been rewarded!
Payroll Run #${payoutData.runNumber} has been processed successfully.

Payout Details:
- Period: ${new Date(payoutData.period.startDate).toLocaleDateString()} - ${new Date(payoutData.period.endDate).toLocaleDateString()}
- Repositories: ${payoutData.repositories.join(', ')}
- PRs Merged: ${payoutData.payout.prCount}
- Your Share: ${(payoutData.payout.shareRatio * 100).toFixed(2)}%
- Amount (USD): $${payoutData.payout.usdAmount.toFixed(2)}
- Amount (${payoutData.payout.asset}): ${payoutData.payout.nativeAmount}
${payoutData.payout.transactionId ? `- Transaction ID: ${payoutData.payout.transactionId}` : ''}

Hedera Account: ${payoutData.contributor.hederaAccountId}
Status: ${payoutData.payout.status}

Thank you for your contributions!
      `
    };
  }

  /**
   * Generate payment reminder template
   */
  private async generateReminderTemplate(invoice: any): Promise<EmailTemplate> {
    const daysOverdue = Math.floor((new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 3600 * 24));
    
    return {
      subject: `Payment Reminder - Invoice ${invoice.invoiceNumber} (${daysOverdue} days overdue)`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #dc3545;">Payment Reminder</h1>
          
          <div style="background: #f8d7da; padding: 20px; border-radius: 5px; border-left: 4px solid #dc3545;">
            <h3>Invoice ${invoice.invoiceNumber} is ${daysOverdue} days overdue</h3>
            <p>Organization: ${invoice.organizationName}</p>
            <p>Amount Due: $${invoice.amount.toFixed(2)} ${invoice.currency}</p>
            <p>Original Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}</p>
          </div>
          
          <div style="margin: 30px 0;">
            <h3>Repository Usage Details</h3>
            <p>Period: ${invoice.period}</p>
            <p>Repository: ${invoice.agent.repository.fullName}</p>
          </div>
          
          <div style="background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107;">
            <p><strong>Please submit payment to avoid service disruption.</strong></p>
            ${invoice.walletAddress ? `<p><strong>Payment Wallet:</strong> ${invoice.walletAddress}</p>` : ''}
          </div>
          
          <p style="margin-top: 30px;">
            If you have already submitted payment, please disregard this notice.
            For questions, contact support@ai-payroll.com
          </p>
        </div>
      `,
      text: `
Payment Reminder

Invoice ${invoice.invoiceNumber} is ${daysOverdue} days overdue

Organization: ${invoice.organizationName}
Amount Due: $${invoice.amount.toFixed(2)} ${invoice.currency}
Original Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}

Repository: ${invoice.agent.repository.fullName}
Period: ${invoice.period}

Please submit payment to avoid service disruption.
${invoice.walletAddress ? `Payment Wallet: ${invoice.walletAddress}` : ''}

If you have already submitted payment, please disregard this notice.
      `
    };
  }

  /**
   * Generate invoice PDF (placeholder)
   */
  private async generateInvoicePDF(invoiceData: any): Promise<EmailAttachment | null> {
    try {
      // In a real implementation, this would use a PDF library like puppeteer or jsPDF
      // For now, we'll return null (no PDF attachment)
      return null;
    } catch (error) {
      console.error('PDF generation failed:', error);
      return null;
    }
  }

  /**
   * Update invoice email status in database
   */
  private async updateInvoiceEmailStatus(
    invoiceId: string, 
    success: boolean, 
    messageId?: string
  ): Promise<void> {
    try {
      const { prisma } = await import('@/lib/db');
      
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          emailSent: success,
          emailSentAt: success ? new Date() : undefined,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Failed to update invoice email status:', error);
    }
  }

  /**
   * Simulate email sending for development
   */
  private async simulateEmailSend(request: EmailRequest): Promise<EmailResult> {
    // Simulate email delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const messageId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('Simulated email send:', {
      to: request.to,
      subject: request.template.subject,
      messageId
    });
    
    return {
      success: true,
      messageId,
      deliveryStatus: 'sent'
    };
  }
}

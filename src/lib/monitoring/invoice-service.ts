/**
 * Automated Invoice Generation and Management Service
 * Handles corporate user invoicing, PDF generation, and email delivery
 */

import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/auth';

export interface InvoiceData {
  organizationName: string;
  amount: number;
  currency?: string;
  period: string;
  dueDate: Date;
  usageData: Record<string, any>;
  corporateUserId?: string;
  walletAddress?: string;
  paymentMethod?: string;
}

export interface EmailTemplate {
  subject: string;
  htmlContent: string;
  textContent: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType: string;
  }>;
}

export class InvoiceService {
  /**
   * Generate and send invoice for corporate usage
   */
  static async generateInvoice(
    agentId: string,
    invoiceData: InvoiceData,
    userId?: string
  ): Promise<string> {
    try {
      // Generate unique invoice number
      const invoiceNumber = await this.generateInvoiceNumber();

      // Create invoice record
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          agentId,
          corporateUserId: invoiceData.corporateUserId,
          organizationName: invoiceData.organizationName,
          amount: invoiceData.amount,
          currency: invoiceData.currency || 'USD',
          period: invoiceData.period,
          dueDate: invoiceData.dueDate,
          paymentMethod: invoiceData.paymentMethod,
          walletAddress: invoiceData.walletAddress,
          usageData: JSON.stringify(invoiceData.usageData),
          status: 'PENDING'
        }
      });

      // Generate PDF
      const pdfPath = await this.generateInvoicePDF(invoice.id, invoiceData);
      
      // Update invoice with PDF path
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { pdfPath }
      });

      // Queue email for sending
      await this.queueInvoiceEmail(invoice.id, invoiceData, pdfPath);

      // Audit log
      if (userId) {
        await createAuditLog(
          userId,
          'INVOICE_GENERATED',
          invoice.id,
          { 
            invoiceNumber, 
            organization: invoiceData.organizationName, 
            amount: invoiceData.amount 
          }
        );
      }

      return invoice.id;
    } catch (error) {
      console.error('Error generating invoice:', error);
      throw new Error('Failed to generate invoice');
    }
  }

  /**
   * Generate unique invoice number
   */
  private static async generateInvoiceNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    // Get count of invoices this month
    const startOfMonth = new Date(year, date.getMonth(), 1);
    const endOfMonth = new Date(year, date.getMonth() + 1, 0);
    
    const count = await prisma.invoice.count({
      where: {
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      }
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `INV-${year}${month}-${sequence}`;
  }

  /**
   * Generate PDF invoice
   */
  private static async generateInvoicePDF(
    invoiceId: string,
    invoiceData: InvoiceData
  ): Promise<string> {
    // This would integrate with a PDF generation library like jsPDF, Puppeteer, or external service
    // For now, we'll create a placeholder path
    
    const filename = `invoice-${invoiceId}.pdf`;
    const filepath = `/invoices/${filename}`;
    
    // TODO: Implement actual PDF generation
    // const pdfBuffer = await this.createPDFBuffer(invoiceData);
    // await this.savePDF(filepath, pdfBuffer);
    
    return filepath;
  }

  /**
   * Queue invoice email for sending
   */
  private static async queueInvoiceEmail(
    invoiceId: string,
    invoiceData: InvoiceData,
    pdfPath: string
  ): Promise<void> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        corporateUser: true,
        agent: {
          include: { repository: true }
        }
      }
    });

    if (!invoice) return;

    // Determine recipient email
    const recipientEmail = invoice.corporateUser?.email || 
                          this.inferEmailFromOrganization(invoice.organizationName);

    if (!recipientEmail) {
      console.warn(`No email found for invoice ${invoice.invoiceNumber}`);
      return;
    }

    // Generate email content
    const emailTemplate = this.generateEmailTemplate(invoice, invoiceData);

    // Queue email
    await prisma.notificationQueue.create({
      data: {
        type: 'email',
        recipient: recipientEmail,
        subject: emailTemplate.subject,
        content: emailTemplate.htmlContent,
        templateId: 'invoice_email',
        templateData: JSON.stringify({
          invoiceNumber: invoice.invoiceNumber,
          organizationName: invoice.organizationName,
          amount: invoice.amount,
          currency: invoice.currency,
          dueDate: invoice.dueDate,
          repository: invoice.agent.repository.fullName,
          pdfPath
        }),
        priority: 5
      }
    });
  }

  /**
   * Generate email template for invoice
   */
  private static generateEmailTemplate(
    invoice: any,
    invoiceData: InvoiceData
  ): EmailTemplate {
    const subject = `Invoice ${invoice.invoiceNumber} - ${invoice.organizationName}`;
    
    const htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2563eb;">Foss It Invoice</h1>
            
            <p>Dear ${invoice.organizationName} team,</p>
            
            <p>We hope this email finds you well. Please find attached your invoice for repository usage during ${invoice.period}.</p>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="margin-top: 0;">Invoice Details</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Invoice Number:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${invoice.invoiceNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Repository:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${invoice.agent.repository.fullName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Period:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${invoice.period}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Amount:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>${invoice.amount} ${invoice.currency}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Due Date:</strong></td>
                  <td style="padding: 8px 0;">${new Date(invoice.dueDate).toLocaleDateString()}</td>
                </tr>
              </table>
            </div>
            
            ${invoice.walletAddress ? `
              <div style="background: #ecfccb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #365314;">Payment Instructions</h3>
                <p>Please send payment to the following wallet address:</p>
                <p style="font-family: monospace; background: white; padding: 10px; border-radius: 4px; font-size: 14px;">
                  ${invoice.walletAddress}
                </p>
                <p style="font-size: 14px; color: #65a30d;">
                  <strong>Network:</strong> ${invoice.paymentMethod || 'Hedera Hashgraph (HBAR)'}
                </p>
              </div>
            ` : ''}
            
            <h3>Usage Summary</h3>
            <p>This invoice covers the following usage of the ${invoice.agent.repository.fullName} repository:</p>
            <ul>
              ${this.formatUsageData(JSON.parse(invoice.usageData))}
            </ul>
            
            <p>Thank you for using our open-source project! Your payment helps support ongoing development and maintenance.</p>
            
            <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>
            
            <p>Best regards,<br>
            The Foss It Team</p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">
            <p style="font-size: 12px; color: #64748b;">
              This is an automated invoice. Please save this email for your records.
            </p>
          </div>
        </body>
      </html>
    `;

    const textContent = `
Invoice ${invoice.invoiceNumber} - ${invoice.organizationName}

Dear ${invoice.organizationName} team,

Please find your invoice for repository usage during ${invoice.period}.

Invoice Details:
- Invoice Number: ${invoice.invoiceNumber}
- Repository: ${invoice.agent.repository.fullName}
- Period: ${invoice.period}
- Amount: ${invoice.amount} ${invoice.currency}
- Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}

${invoice.walletAddress ? `
Payment Instructions:
Please send payment to: ${invoice.walletAddress}
Network: ${invoice.paymentMethod || 'Hedera Hashgraph (HBAR)'}
` : ''}

Thank you for using our open-source project!

Best regards,
The Foss It Team
    `;

    return {
      subject,
      htmlContent,
      textContent
    };
  }

  /**
   * Format usage data for email display
   */
  private static formatUsageData(usageData: Record<string, any>): string {
    const items: string[] = [];
    
    if (usageData.clones) {
      items.push(`<li>Repository Clones: ${usageData.clones}</li>`);
    }
    
    if (usageData.views) {
      items.push(`<li>Repository Views: ${usageData.views}</li>`);
    }
    
    if (usageData.downloads) {
      items.push(`<li>Downloads: ${usageData.downloads}</li>`);
    }
    
    if (usageData.apiCalls) {
      items.push(`<li>API Calls: ${usageData.apiCalls}</li>`);
    }
    
    if (usageData.contributors) {
      items.push(`<li>Contributing Developers: ${usageData.contributors}</li>`);
    }
    
    return items.join('\n              ') || '<li>General repository usage</li>';
  }

  /**
   * Infer email from organization name
   */
  private static inferEmailFromOrganization(orgName: string): string | null {
    // Simple heuristics to infer email
    const cleanName = orgName.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '');
    
    // Common patterns
    const possibleDomains = [
      `${cleanName}.com`,
      `${cleanName}.org`,
      `${cleanName}.io`,
      `${cleanName}.co`
    ];

    // Return first possible domain (in reality, you'd validate these)
    return `billing@${possibleDomains[0]}`;
  }

  /**
   * Mark invoice as sent
   */
  static async markInvoiceAsSent(invoiceId: string): Promise<void> {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        emailSent: true,
        emailSentAt: new Date(),
        status: 'SENT'
      }
    });
  }

  /**
   * Process payment for invoice
   */
  static async processPayment(
    invoiceId: string,
    paymentData: {
      amount: number;
      cryptoAmount?: string;
      cryptoCurrency?: string;
      transactionHash: string;
      fromAddress: string;
      toAddress: string;
      network: string;
    }
  ): Promise<void> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId }
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        invoiceId,
        amount: paymentData.amount,
        cryptoAmount: paymentData.cryptoAmount,
        cryptoCurrency: paymentData.cryptoCurrency,
        transactionHash: paymentData.transactionHash,
        fromAddress: paymentData.fromAddress,
        toAddress: paymentData.toAddress,
        network: paymentData.network,
        status: 'CONFIRMED'
      }
    });

    // Update invoice status
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID',
        paidAmount: paymentData.amount,
        paidAt: new Date(),
        transactionHash: paymentData.transactionHash
      }
    });

    // Queue payment confirmation notification
    await this.queuePaymentConfirmation(invoiceId, payment.id);
  }

  /**
   * Queue payment confirmation email
   */
  private static async queuePaymentConfirmation(
    invoiceId: string,
    paymentId: string
  ): Promise<void> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        corporateUser: true,
        payments: { where: { id: paymentId } },
        agent: { include: { repository: true } }
      }
    });

    if (!invoice || !invoice.payments[0]) return;

    const payment = invoice.payments[0];
    const recipientEmail = invoice.corporateUser?.email || 
                          this.inferEmailFromOrganization(invoice.organizationName);

    if (!recipientEmail) return;

    await prisma.notificationQueue.create({
      data: {
        type: 'email',
        recipient: recipientEmail,
        subject: `Payment Confirmation - Invoice ${invoice.invoiceNumber}`,
        content: `Your payment of ${payment.amount} ${invoice.currency} has been confirmed.`,
        templateId: 'payment_confirmation',
        templateData: JSON.stringify({
          invoiceNumber: invoice.invoiceNumber,
          amount: payment.amount,
          transactionHash: payment.transactionHash,
          repository: invoice.agent.repository.fullName
        }),
        priority: 7
      }
    });
  }

  /**
   * Get invoice statistics for dashboard
   */
  static async getInvoiceStats(agentId: string) {
    const invoices = await prisma.invoice.findMany({
      where: { agentId },
      include: { payments: true }
    });

    const stats = {
      total: invoices.length,
      pending: invoices.filter(i => i.status === 'PENDING').length,
      sent: invoices.filter(i => i.status === 'SENT').length,
      paid: invoices.filter(i => i.status === 'PAID').length,
      overdue: invoices.filter(i => 
        i.status !== 'PAID' && new Date(i.dueDate) < new Date()
      ).length,
      totalAmount: invoices.reduce((sum, i) => sum + i.amount, 0),
      paidAmount: invoices
        .filter(i => i.status === 'PAID')
        .reduce((sum, i) => sum + (i.paidAmount || 0), 0)
    };

    return stats;
  }

  /**
   * Get recent invoices
   */
  static async getRecentInvoices(agentId: string, limit: number = 10) {
    return prisma.invoice.findMany({
      where: { agentId },
      include: {
        corporateUser: true,
        payments: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }
}

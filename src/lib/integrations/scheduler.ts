/**
 * Background Job Scheduler for Automated Tasks
 * Handles periodic sync, invoice generation, and payment processing
 */

import * as cron from 'node-cron';

export interface ScheduledJob {
  id: string;
  name: string;
  schedule: string; // cron expression
  handler: () => Promise<void>;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  status: 'idle' | 'running' | 'error';
  error?: string;
}

export class TaskScheduler {
  private jobs: Map<string, ScheduledJob> = new Map();
  private cronTasks: Map<string, cron.ScheduledTask> = new Map();
  private isInitialized: boolean = false;

  /**
   * Initialize the task scheduler
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('Initializing task scheduler...');

    // Register core system tasks
    await this.registerCoreJobs();
    
    // Start all enabled jobs
    this.startAllJobs();
    
    this.isInitialized = true;
    console.log(`Task scheduler initialized with ${this.jobs.size} jobs`);
  }

  /**
   * Register a scheduled job
   */
  registerJob(job: Omit<ScheduledJob, 'status' | 'lastRun' | 'nextRun'>): void {
    const scheduledJob: ScheduledJob = {
      ...job,
      status: 'idle',
      nextRun: this.calculateNextRun(job.schedule)
    };

    this.jobs.set(job.id, scheduledJob);
    
    if (job.enabled) {
      this.startJob(job.id);
    }

    console.log(`Registered job: ${job.name} (${job.schedule})`);
  }

  /**
   * Start a specific job
   */
  startJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      console.error(`Job ${jobId} not found`);
      return false;
    }

    if (this.cronTasks.has(jobId)) {
      console.log(`Job ${jobId} is already running`);
      return true;
    }

    try {
      const task = cron.schedule(job.schedule, async () => {
        await this.executeJob(jobId);
      }, {
        scheduled: true,
        timezone: 'UTC'
      });

      this.cronTasks.set(jobId, task);
      job.enabled = true;
      job.nextRun = this.calculateNextRun(job.schedule);
      
      console.log(`Started job: ${job.name}`);
      return true;
    } catch (error) {
      console.error(`Failed to start job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Stop a specific job
   */
  stopJob(jobId: string): boolean {
    const task = this.cronTasks.get(jobId);
    const job = this.jobs.get(jobId);
    
    if (task) {
      task.stop();
      this.cronTasks.delete(jobId);
    }
    
    if (job) {
      job.enabled = false;
      job.status = 'idle';
    }
    
    console.log(`Stopped job: ${jobId}`);
    return true;
  }

  /**
   * Execute a job manually
   */
  async executeJobNow(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) {
      console.error(`Job ${jobId} not found`);
      return false;
    }

    console.log(`Manually executing job: ${job.name}`);
    return await this.executeJob(jobId);
  }

  /**
   * Get job status
   */
  getJob(jobId: string): ScheduledJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): ScheduledJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Start all enabled jobs
   */
  private startAllJobs(): void {
    for (const [jobId, job] of this.jobs) {
      if (job.enabled) {
        this.startJob(jobId);
      }
    }
  }

  /**
   * Execute a specific job
   */
  private async executeJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === 'running') {
      console.log(`Job ${job.name} is already running, skipping...`);
      return false;
    }

    try {
      job.status = 'running';
      job.lastRun = new Date();
      job.nextRun = this.calculateNextRun(job.schedule);
      job.error = undefined;

      console.log(`Executing job: ${job.name}`);
      await job.handler();
      
      job.status = 'idle';
      console.log(`Job completed: ${job.name}`);
      return true;
    } catch (error) {
      job.status = 'error';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`Job failed: ${job.name}`, error);
      
      // Send error notification
      await this.sendJobErrorNotification(job, error);
      return false;
    }
  }

  /**
   * Register core system jobs
   */
  private async registerCoreJobs(): Promise<void> {
    // Analytics sync job - every 2 hours
    this.registerJob({
      id: 'analytics_sync',
      name: 'Repository Analytics Sync',
      schedule: '0 */2 * * *',
      enabled: true,
      handler: async () => {
        await this.syncAllRepositoryAnalytics();
      }
    });

    // Corporate detection job - daily at 6 AM UTC
    this.registerJob({
      id: 'corporate_detection',
      name: 'Corporate Usage Detection',
      schedule: '0 6 * * *',
      enabled: true,
      handler: async () => {
        await this.detectCorporateUsage();
      }
    });

    // Invoice generation job - daily at 9 AM UTC
    this.registerJob({
      id: 'invoice_generation',
      name: 'Automated Invoice Generation',
      schedule: '0 9 * * *',
      enabled: true,
      handler: async () => {
        await this.generatePendingInvoices();
      }
    });

    // Payment monitoring job - every 15 minutes
    this.registerJob({
      id: 'payment_monitoring',
      name: 'Payment Detection and Processing',
      schedule: '*/15 * * * *',
      enabled: true,
      handler: async () => {
        await this.monitorIncomingPayments();
      }
    });

    // CID verification job - daily at 2 AM UTC
    this.registerJob({
      id: 'cid_verification',
      name: 'IPFS/Lighthouse CID Verification',
      schedule: '0 2 * * *',
      enabled: true,
      handler: async () => {
        await this.verifyCIDs();
      }
    });

    // Overdue invoice reminders - daily at 10 AM UTC
    this.registerJob({
      id: 'overdue_reminders',
      name: 'Overdue Invoice Reminders',
      schedule: '0 10 * * *',
      enabled: true,
      handler: async () => {
        await this.sendOverdueReminders();
      }
    });

    // System health check - every hour
    this.registerJob({
      id: 'health_check',
      name: 'System Health Check',
      schedule: '0 * * * *',
      enabled: true,
      handler: async () => {
        await this.performHealthCheck();
      }
    });
  }

  /**
   * Sync analytics for all active repositories
   */
  private async syncAllRepositoryAnalytics(): Promise<void> {
    try {
      const { prisma } = await import('@/lib/db');
      const { FetchAIAgentService } = await import('./fetch-ai-agent');
      
      const activeAgents = await prisma.repoAgent.findMany({
        where: { status: 'ACTIVE' },
        include: { repository: true }
      });

      const fetchAIService = new FetchAIAgentService();
      
      for (const agent of activeAgents) {
        try {
          await fetchAIService.executeAnalyticsSync(agent.repositoryId);
          console.log(`Analytics synced for ${agent.repository.fullName}`);
        } catch (error) {
          console.error(`Failed to sync analytics for ${agent.repository.fullName}:`, error);
        }
      }

      console.log(`Analytics sync completed for ${activeAgents.length} repositories`);
    } catch (error) {
      console.error('Analytics sync job failed:', error);
      throw error;
    }
  }

  /**
   * Detect corporate usage across all repositories
   */
  private async detectCorporateUsage(): Promise<void> {
    try {
      const { prisma } = await import('@/lib/db');
      const { FetchAIAgentService } = await import('./fetch-ai-agent');
      
      const activeAgents = await prisma.repoAgent.findMany({
        where: { status: 'ACTIVE' },
        include: { repository: true }
      });

      const fetchAIService = new FetchAIAgentService();
      let totalDetected = 0;
      
      for (const agent of activeAgents) {
        try {
          const result = await fetchAIService.executeCorporateDetection(agent.repositoryId);
          if (result.success && result.data) {
            totalDetected += result.data.detected || 0;
          }
        } catch (error) {
          console.error(`Failed corporate detection for ${agent.repository.fullName}:`, error);
        }
      }

      console.log(`Corporate detection completed: ${totalDetected} new corporate users detected`);
    } catch (error) {
      console.error('Corporate detection job failed:', error);
      throw error;
    }
  }

  /**
   * Generate invoices for verified corporate users
   */
  private async generatePendingInvoices(): Promise<void> {
    try {
      const { prisma } = await import('@/lib/db');
      const { InvoiceService } = await import('../monitoring/invoice-service');
      
      // Get corporate users that need invoicing
      const pendingUsers = await prisma.corporateUser.findMany({
        where: {
          status: 'VERIFIED',
          confidence: { gte: 0.8 }
        },
        include: { agent: { include: { repository: true } } }
      });

      let invoicesGenerated = 0;
      
      for (const user of pendingUsers) {
        try {
          // Calculate usage-based billing amount
          const usageMetrics = JSON.parse(user.usageMetrics || '{}');
          const baseAmount = 100; // $100 base fee
          const usageMultiplier = Math.max(1, (usageMetrics.totalActivity || 1) / 10);
          const amount = Math.min(baseAmount * usageMultiplier, 1000); // Cap at $1000

          await InvoiceService.generateInvoice(user.agentId, {
            organizationName: user.organizationName || 'Unknown Organization',
            amount,
            period: `Monthly usage - ${new Date().toLocaleDateString()}`,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            usageData: usageMetrics,
            corporateUserId: user.id
          });

          // Update user status
          await prisma.corporateUser.update({
            where: { id: user.id },
            data: { status: 'INVOICED' }
          });

          invoicesGenerated++;
        } catch (error) {
          console.error(`Failed to generate invoice for ${user.organizationName}:`, error);
        }
      }

      console.log(`Invoice generation completed: ${invoicesGenerated} invoices generated`);
    } catch (error) {
      console.error('Invoice generation job failed:', error);
      throw error;
    }
  }

  /**
   * Monitor for incoming payments
   */
  private async monitorIncomingPayments(): Promise<void> {
    try {
      const { HederaAgentService } = await import('./hedera-agent');
      
      const hederaConfig = {
        network: (process.env.HEDERA_NETWORK as 'testnet' | 'mainnet') || 'testnet',
        operatorAccountId: process.env.HEDERA_OPERATOR_ACCOUNT_ID || '',
        operatorPrivateKey: process.env.HEDERA_OPERATOR_PRIVATE_KEY || '',
        treasuryAccountId: process.env.HEDERA_TREASURY_ACCOUNT_ID || ''
      };

      if (!hederaConfig.operatorAccountId || !hederaConfig.operatorPrivateKey) {
        console.log('Hedera configuration missing, skipping payment monitoring');
        return;
      }

      const hederaService = new HederaAgentService(hederaConfig);
      const payments = await hederaService.monitorIncomingPayments(
        hederaConfig.treasuryAccountId,
        new Date(Date.now() - 15 * 60 * 1000) // Last 15 minutes
      );

      if (payments.length > 0) {
        console.log(`Detected ${payments.length} incoming payments`);
        // Process payments and match to invoices
        // This would involve invoice matching and status updates
      }

      hederaService.close();
    } catch (error) {
      console.error('Payment monitoring job failed:', error);
      throw error;
    }
  }

  /**
   * Verify IPFS CIDs for artifacts
   */
  private async verifyCIDs(): Promise<void> {
    try {
      const { prisma } = await import('@/lib/db');
      const { LighthouseStorageService } = await import('./lighthouse-storage');
      
      const artifacts = await prisma.artifact.findMany({
        where: {
          OR: [
            { verified: false },
            { lastCheckedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
          ]
        }
      });

      const storageService = new LighthouseStorageService({
        apiKey: process.env.LIGHTHOUSE_API_KEY || ''
      });

      const cids = artifacts.map(a => a.cid);
      const verifications = await storageService.batchVerifyCIDs(cids);

      console.log(`CID verification completed for ${verifications.length} artifacts`);
    } catch (error) {
      console.error('CID verification job failed:', error);
      throw error;
    }
  }

  /**
   * Send overdue payment reminders
   */
  private async sendOverdueReminders(): Promise<void> {
    try {
      const { prisma } = await import('@/lib/db');
      const { EmailService } = await import('./email-service');
      
      const overdueInvoices = await prisma.invoice.findMany({
        where: {
          status: 'SENT',
          dueDate: { lt: new Date() },
          emailSent: true
        },
        include: {
          corporateUser: true,
          agent: { include: { repository: true } }
        }
      });

      const emailService = new EmailService({
        apiKey: process.env.SENDGRID_API_KEY || '',
        fromEmail: process.env.SENDGRID_FROM_EMAIL || ''
      });

      let remindersSent = 0;
      
      for (const invoice of overdueInvoices) {
        try {
          await emailService.sendPaymentReminder(invoice.id);
          remindersSent++;
        } catch (error) {
          console.error(`Failed to send reminder for invoice ${invoice.invoiceNumber}:`, error);
        }
      }

      console.log(`Overdue reminders sent: ${remindersSent}`);
    } catch (error) {
      console.error('Overdue reminders job failed:', error);
      throw error;
    }
  }

  /**
   * Perform system health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const health = {
        database: false,
        graph: false,
        storage: false,
        email: false,
        timestamp: new Date().toISOString()
      };

      // Check database
      try {
        const { prisma } = await import('@/lib/db');
        await prisma.systemConfig.findFirst();
        health.database = true;
      } catch (error) {
        console.error('Database health check failed:', error);
      }

      // Check Graph client
      try {
        const { GraphClient } = await import('./graph-client');
        const graphClient = new GraphClient();
        const result = await graphClient.healthCheck();
        health.graph = result.status === 'healthy';
      } catch (error) {
        console.error('Graph health check failed:', error);
      }

      // Store health status
      const { prisma } = await import('@/lib/db');
      await prisma.systemConfig.upsert({
        where: { key: 'system_health' },
        update: { value: JSON.stringify(health) },
        create: {
          key: 'system_health',
          value: JSON.stringify(health),
          description: 'System health status'
        }
      });

      console.log('System health check completed:', health);
    } catch (error) {
      console.error('Health check job failed:', error);
      throw error;
    }
  }

  /**
   * Send error notification for failed jobs
   */
  private async sendJobErrorNotification(job: ScheduledJob, error: any): Promise<void> {
    try {
      const { EmailService } = await import('./email-service');
      const emailService = new EmailService({
        apiKey: process.env.SENDGRID_API_KEY || '',
        fromEmail: process.env.SENDGRID_FROM_EMAIL || ''
      });

      await emailService.sendSystemNotification(
        `Scheduled Job Failed: ${job.name}`,
        `The scheduled job "${job.name}" has failed.\n\n` +
        `Job ID: ${job.id}\n` +
        `Schedule: ${job.schedule}\n` +
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n` +
        `Timestamp: ${new Date().toISOString()}\n\n` +
        `Please check the system logs and resolve the issue.`,
        'high'
      );
    } catch (emailError) {
      console.error('Failed to send job error notification:', emailError);
    }
  }

  /**
   * Calculate next run time for a cron expression
   */
  private calculateNextRun(cronExpression: string): Date {
    try {
      // Simple implementation - in production use a proper cron parser
      return new Date(Date.now() + 60 * 60 * 1000); // Default to 1 hour from now
    } catch (error) {
      console.error('Failed to calculate next run:', error);
      return new Date(Date.now() + 60 * 60 * 1000);
    }
  }

  /**
   * Shutdown the scheduler gracefully
   */
  shutdown(): void {
    console.log('Shutting down task scheduler...');
    
    for (const [jobId, task] of this.cronTasks) {
      task.stop();
      console.log(`Stopped job: ${jobId}`);
    }
    
    this.cronTasks.clear();
    this.isInitialized = false;
    
    console.log('Task scheduler shutdown complete');
  }
}

// Export singleton instance
export const taskScheduler = new TaskScheduler();

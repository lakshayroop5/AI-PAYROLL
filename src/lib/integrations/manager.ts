/**
 * Integration Manager
 * Coordinates all external service integrations and initializes the system
 */

import { GraphClient } from './graph-client';
import { FetchAIAgentService } from './fetch-ai-agent';
import { HederaAgentService } from './hedera-agent';
import { LighthouseStorageService } from './lighthouse-storage';
import { EmailService } from './email-service';
import { taskScheduler } from './scheduler';

export interface IntegrationStatus {
  service: string;
  status: 'healthy' | 'unhealthy' | 'not_configured';
  lastCheck: Date;
  error?: string;
  metadata?: Record<string, any>;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  integrations: IntegrationStatus[];
  lastUpdated: Date;
  uptime: number;
}

export class IntegrationManager {
  private static instance: IntegrationManager;
  private initialized = false;
  private startTime = Date.now();

  // Service instances
  private graphClient?: GraphClient;
  private fetchAIService?: FetchAIAgentService;
  private hederaService?: HederaAgentService;
  private storageService?: LighthouseStorageService;
  private emailService?: EmailService;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): IntegrationManager {
    if (!IntegrationManager.instance) {
      IntegrationManager.instance = new IntegrationManager();
    }
    return IntegrationManager.instance;
  }

  /**
   * Initialize all integrations
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('Integration manager already initialized');
      return;
    }

    console.log('Initializing integration manager...');

    try {
      // Initialize services
      await this.initializeServices();
      
      // Initialize task scheduler
      await taskScheduler.initialize();
      
      // Perform initial health check
      await this.performHealthCheck();
      
      this.initialized = true;
      console.log('Integration manager initialized successfully');
      
      // Send startup notification
      await this.sendStartupNotification();
    } catch (error) {
      console.error('Failed to initialize integration manager:', error);
      throw error;
    }
  }

  /**
   * Initialize all service instances
   */
  private async initializeServices(): Promise<void> {
    console.log('Initializing service instances...');

    // Initialize The Graph client
    this.graphClient = new GraphClient(process.env.GITHUB_SUBGRAPH_URL);

    // Initialize Fetch.ai service
    this.fetchAIService = new FetchAIAgentService();

    // Initialize Hedera service
    if (process.env.HEDERA_OPERATOR_ACCOUNT_ID && process.env.HEDERA_OPERATOR_PRIVATE_KEY) {
      this.hederaService = new HederaAgentService({
        network: (process.env.HEDERA_NETWORK as 'testnet' | 'mainnet') || 'testnet',
        operatorAccountId: process.env.HEDERA_OPERATOR_ACCOUNT_ID,
        operatorPrivateKey: process.env.HEDERA_OPERATOR_PRIVATE_KEY,
        treasuryAccountId: process.env.HEDERA_TREASURY_ACCOUNT_ID
      });
    }

    // Initialize Lighthouse storage
    this.storageService = new LighthouseStorageService({
      apiKey: process.env.LIGHTHOUSE_API_KEY || ''
    });

    // Initialize email service
    this.emailService = new EmailService({
      apiKey: process.env.SENDGRID_API_KEY || '',
      fromEmail: process.env.SENDGRID_FROM_EMAIL || '',
      fromName: 'AI Payroll System'
    });

    console.log('Service instances initialized');
  }

  /**
   * Get service instances
   */
  getServices() {
    return {
      graph: this.graphClient,
      fetchAI: this.fetchAIService,
      hedera: this.hederaService,
      storage: this.storageService,
      email: this.emailService
    };
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<SystemHealth> {
    console.log('Performing system health check...');

    const integrations: IntegrationStatus[] = [];

    // Check The Graph
    try {
      if (this.graphClient) {
        const result = await this.graphClient.healthCheck();
        integrations.push({
          service: 'The Graph',
          status: result.status === 'healthy' ? 'healthy' : 'unhealthy',
          lastCheck: new Date(),
          metadata: { latency: result.latency }
        });
      } else {
        integrations.push({
          service: 'The Graph',
          status: 'not_configured',
          lastCheck: new Date()
        });
      }
    } catch (error) {
      integrations.push({
        service: 'The Graph',
        status: 'unhealthy',
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Check Hedera
    try {
      if (this.hederaService) {
        const balance = await this.hederaService.getAccountBalance(
          process.env.HEDERA_OPERATOR_ACCOUNT_ID || ''
        );
        integrations.push({
          service: 'Hedera',
          status: 'healthy',
          lastCheck: new Date(),
          metadata: { balance: balance.hbar }
        });
      } else {
        integrations.push({
          service: 'Hedera',
          status: 'not_configured',
          lastCheck: new Date()
        });
      }
    } catch (error) {
      integrations.push({
        service: 'Hedera',
        status: 'unhealthy',
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Check Email Service
    try {
      if (process.env.SENDGRID_API_KEY) {
        integrations.push({
          service: 'Email (SendGrid)',
          status: 'healthy',
          lastCheck: new Date(),
          metadata: { configured: true }
        });
      } else {
        integrations.push({
          service: 'Email (SendGrid)',
          status: 'not_configured',
          lastCheck: new Date()
        });
      }
    } catch (error) {
      integrations.push({
        service: 'Email (SendGrid)',
        status: 'unhealthy',
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Check Database
    try {
      const { prisma } = await import('@/lib/db');
      await prisma.systemConfig.findFirst();
      integrations.push({
        service: 'Database',
        status: 'healthy',
        lastCheck: new Date()
      });
    } catch (error) {
      integrations.push({
        service: 'Database',
        status: 'unhealthy',
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Determine overall health
    const healthyServices = integrations.filter(i => i.status === 'healthy').length;
    const totalServices = integrations.length;
    const unhealthyServices = integrations.filter(i => i.status === 'unhealthy').length;
    
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyServices === 0) {
      overall = 'healthy';
    } else if (healthyServices > unhealthyServices) {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }

    const health: SystemHealth = {
      overall,
      integrations,
      lastUpdated: new Date(),
      uptime: Date.now() - this.startTime
    };

    // Store health status in database
    await this.storeHealthStatus(health);

    return health;
  }

  /**
   * Process repository setup with full integration pipeline
   */
  async processRepositorySetup(repositoryId: string): Promise<{
    success: boolean;
    agentId?: string;
    integrations: Record<string, any>;
    error?: string;
  }> {
    try {
      console.log(`Processing full repository setup for ${repositoryId}`);

      const { prisma } = await import('@/lib/db');
      
      // Get repository details
      const repository = await prisma.repository.findUnique({
        where: { id: repositoryId }
      });

      if (!repository) {
        throw new Error('Repository not found');
      }

      const integrations: Record<string, any> = {};

      // 1. Deploy subgraph
      if (this.graphClient) {
        console.log('Deploying The Graph subgraph...');
        const [owner, name] = repository.fullName.split('/');
        const subgraphUrl = await this.graphClient.deploySubgraph({
          repositoryId,
          owner,
          name,
          githubToken: process.env.GITHUB_TOKEN
        });
        integrations.graph = { subgraphUrl };
      }

      // 2. Initialize Fetch.ai agent
      if (this.fetchAIService) {
        console.log('Initializing Fetch.ai agent...');
        const fetchAIAgentId = await this.fetchAIService.initializeAgent({
          name: `repo-${repository.fullName.replace('/', '-')}`,
          repositoryId,
          tasks: [],
          schedule: {
            analytics: '0 */2 * * *',
            invoicing: '0 6 * * *',
            payroll: '0 9 * * 1'
          }
        });
        integrations.fetchAI = { agentId: fetchAIAgentId };
      }

      // 3. Setup payment processing
      if (this.hederaService) {
        console.log('Configuring Hedera payment processing...');
        const balance = await this.hederaService.getAccountBalance(
          process.env.HEDERA_OPERATOR_ACCOUNT_ID || ''
        );
        integrations.hedera = { configured: true, balance: balance.hbar };
      }

      // 4. Initialize storage
      console.log('Setting up decentralized storage...');
      integrations.storage = { configured: true, provider: 'Lighthouse/IPFS' };

      // 5. Configure notifications
      console.log('Setting up email notifications...');
      integrations.email = { configured: !!process.env.SENDGRID_API_KEY };

      // Update agent with integration metadata
      const agent = await prisma.repoAgent.findUnique({
        where: { repositoryId }
      });

      if (agent) {
        await prisma.repoAgent.update({
          where: { id: agent.id },
          data: {
            metadata: JSON.stringify({
              integrations,
              setupCompletedAt: new Date().toISOString(),
              version: '2.0.0'
            })
          }
        });
      }

      return {
        success: true,
        agentId: agent?.id,
        integrations
      };
    } catch (error) {
      console.error('Repository setup failed:', error);
      return {
        success: false,
        integrations: {},
        error: error instanceof Error ? error.message : 'Setup failed'
      };
    }
  }

  /**
   * Execute end-to-end payroll process
   */
  async executePayrollProcess(runId: string): Promise<{
    success: boolean;
    artifacts: string[];
    payments: number;
    error?: string;
  }> {
    try {
      console.log(`Executing end-to-end payroll process for run ${runId}`);

      const artifacts: string[] = [];
      
      // 1. Generate and upload payroll report
      if (this.storageService) {
        console.log('Generating and uploading payroll report...');
        const reportResult = await this.storageService.uploadPayrollReport(runId, {});
        if (reportResult.success && reportResult.cid) {
          artifacts.push(reportResult.cid);
        }
      }

      // 2. Generate audit trail
      if (this.storageService) {
        console.log('Generating audit trail...');
        const auditResult = await this.storageService.generateAuditTrail(runId);
        if (auditResult.success && auditResult.cid) {
          artifacts.push(auditResult.cid);
        }
      }

      // 3. Execute batch payments
      let paymentsProcessed = 0;
      if (this.hederaService) {
        console.log('Processing batch payments...');
        const { prisma } = await import('@/lib/db');
        
        const run = await prisma.payrollRun.findUnique({
          where: { id: runId },
          include: {
            payouts: {
              include: { contributor: true }
            }
          }
        });

        if (run && run.payouts.length > 0) {
          const batchRequest = {
            runId,
            payouts: run.payouts.map(payout => ({
              contributorId: payout.contributorId,
              hederaAccountId: payout.contributor?.hederaAccountId || '',
              amount: payout.nativeAmount,
              asset: run.asset
            })),
            memo: `Payroll run ${run.runNumber}`
          };

          const paymentResults = await this.hederaService.executeBatchPayouts(batchRequest);
          paymentsProcessed = paymentResults.filter(r => r.success).length;
        }
      }

      // 4. Send payout notifications
      if (this.emailService) {
        console.log('Sending payout notifications...');
        await this.emailService.sendBatchPayoutNotifications(runId);
      }

      return {
        success: true,
        artifacts,
        payments: paymentsProcessed
      };
    } catch (error) {
      console.error('Payroll process failed:', error);
      return {
        success: false,
        artifacts: [],
        payments: 0,
        error: error instanceof Error ? error.message : 'Payroll process failed'
      };
    }
  }

  /**
   * Get system status for dashboard
   */
  async getSystemStatus(): Promise<{
    health: SystemHealth;
    scheduler: {
      initialized: boolean;
      activeJobs: number;
      lastJobRun?: Date;
    };
    integrations: Record<string, any>;
  }> {
    const health = await this.performHealthCheck();
    
    const schedulerJobs = taskScheduler.getAllJobs();
    
    return {
      health,
      scheduler: {
        initialized: true,
        activeJobs: schedulerJobs.filter(j => j.enabled).length,
        lastJobRun: schedulerJobs
          .filter(j => j.lastRun)
          .sort((a, b) => (b.lastRun?.getTime() || 0) - (a.lastRun?.getTime() || 0))[0]?.lastRun
      },
      integrations: {
        graph: !!this.graphClient,
        fetchAI: !!this.fetchAIService,
        hedera: !!this.hederaService,
        storage: !!this.storageService,
        email: !!this.emailService
      }
    };
  }

  /**
   * Store health status in database
   */
  private async storeHealthStatus(health: SystemHealth): Promise<void> {
    try {
      const { prisma } = await import('@/lib/db');
      
      await prisma.systemConfig.upsert({
        where: { key: 'system_health' },
        update: {
          value: JSON.stringify(health),
          updatedAt: new Date()
        },
        create: {
          key: 'system_health',
          value: JSON.stringify(health),
          description: 'System health status and integration monitoring'
        }
      });
    } catch (error) {
      console.error('Failed to store health status:', error);
    }
  }

  /**
   * Send startup notification
   */
  private async sendStartupNotification(): Promise<void> {
    try {
      if (this.emailService) {
        await this.emailService.sendSystemNotification(
          'AI Payroll System Started',
          `The AI Payroll System has been successfully started.\n\n` +
          `Startup time: ${new Date().toISOString()}\n` +
          `Integrations initialized:\n` +
          `- The Graph: ${this.graphClient ? '✅' : '❌'}\n` +
          `- Fetch.ai: ${this.fetchAIService ? '✅' : '❌'}\n` +
          `- Hedera: ${this.hederaService ? '✅' : '❌'}\n` +
          `- Storage: ${this.storageService ? '✅' : '❌'}\n` +
          `- Email: ${this.emailService ? '✅' : '❌'}\n` +
          `- Task Scheduler: ✅\n\n` +
          `System is ready for repository monitoring and automated payroll processing.`,
          'normal'
        );
      }
    } catch (error) {
      console.error('Failed to send startup notification:', error);
    }
  }

  /**
   * Shutdown integration manager gracefully
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down integration manager...');
    
    // Shutdown scheduler
    taskScheduler.shutdown();
    
    // Close Hedera connection
    if (this.hederaService) {
      this.hederaService.close();
    }
    
    this.initialized = false;
    console.log('Integration manager shutdown complete');
  }
}

// Export singleton instance
export const integrationManager = IntegrationManager.getInstance();

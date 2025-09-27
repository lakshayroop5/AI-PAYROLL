/**
 * Repository Agent Management Service
 * Handles initialization and management of monitoring agents for repositories
 */

import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/auth';

export interface AgentConfig {
  syncInterval?: number;
  enableAnalytics?: boolean;
  enableCorporateDetection?: boolean;
  subgraphDeployment?: string;
  asiAgentConfig?: Record<string, any>;
}

export interface AnalyticsSnapshot {
  totalContributors: number;
  totalPRs: number;
  totalCommits: number;
  totalStars: number;
  totalForks: number;
  totalClones: number;
  totalViews: number;
  newContributors: number;
  activeContributors: number;
  corporateActivity: number;
  contributorStats: Record<string, any>;
  rawData: Record<string, any>;
}

export class RepoAgentService {
  /**
   * Initialize monitoring agent for a repository
   */
  static async initializeAgent(
    repositoryId: string,
    userId: string,
    config: AgentConfig = {}
  ): Promise<string> {
    try {
      // Check if agent already exists
      const existingAgent = await prisma.repoAgent.findUnique({
        where: { repositoryId }
      });

      if (existingAgent) {
        // Reactivate if stopped
        if (existingAgent.status === 'STOPPED') {
          await prisma.repoAgent.update({
            where: { id: existingAgent.id },
            data: {
              status: 'ACTIVE',
              metadata: JSON.stringify(config),
              updatedAt: new Date()
            }
          });
          
          await createAuditLog(
            userId,
            'REPO_AGENT_REACTIVATED',
            repositoryId,
            { agentId: existingAgent.id }
          );
        }
        
        return existingAgent.id;
      }

      // Create new agent
      const agent = await prisma.repoAgent.create({
        data: {
          repositoryId,
          status: 'INITIALIZING',
          syncInterval: config.syncInterval || 3600,
          metadata: JSON.stringify(config),
        }
      });

      // Perform direct setup instead of scheduling via webhooks
      await this.performDirectSetup(agent.id, repositoryId, config);

      await createAuditLog(
        userId,
        'REPO_AGENT_INITIALIZED',
        repositoryId,
        { agentId: agent.id, config }
      );

      return agent.id;
    } catch (error) {
      console.error('Error initializing repo agent:', error);
      throw new Error('Failed to initialize monitoring agent');
    }
  }

  /**
   * Perform direct agent setup with full integration support
   */
  static async performDirectSetup(
    agentId: string,
    repositoryId: string,
    config: AgentConfig
  ): Promise<void> {
    try {
      console.log(`Setting up integrated agent for repository ${repositoryId}`);
      
      // Get repository details
      const repository = await prisma.repository.findUnique({
        where: { id: repositoryId }
      });
      
      if (!repository) {
        throw new Error('Repository not found');
      }

      // 1. Deploy The Graph subgraph
      console.log(`Setting up subgraph for ${repository.fullName}`);
      const { GraphClient } = await import('../integrations/graph-client');
      const graphClient = new GraphClient();
      
      const [owner, name] = repository.fullName.split('/');
      const subgraphUrl = await graphClient.deploySubgraph({
        repositoryId,
        owner,
        name,
        githubToken: process.env.GITHUB_TOKEN
      });
      
      // 2. Initialize Fetch.ai agent
      console.log(`Initializing Fetch.ai agent for ${repository.fullName}`);
      const { FetchAIAgentService } = await import('../integrations/fetch-ai-agent');
      const fetchAIService = new FetchAIAgentService();
      
      const fetchAIAgentId = await fetchAIService.initializeAgent({
        name: `repo-agent-${repository.fullName.replace('/', '-')}`,
        repositoryId,
        tasks: [],
        schedule: {
          analytics: '0 */2 * * *', // Every 2 hours
          invoicing: '0 6 * * *',  // Daily at 6 AM
          payroll: '0 9 * * 1'     // Weekly on Monday at 9 AM
        }
      });
      
      // 3. Initial analytics sync
      console.log(`Performing initial analytics sync for ${repository.fullName}`);
      await fetchAIService.executeAnalyticsSync(repositoryId);
      
      // 4. Schedule recurring tasks
      console.log(`Scheduling recurring tasks for agent ${fetchAIAgentId}`);
      await fetchAIService.scheduleTasks(fetchAIAgentId, repositoryId);
      
      // Update agent status to ACTIVE with integration details
      await prisma.repoAgent.update({
        where: { id: agentId },
        data: {
          status: 'ACTIVE',
          agentId: fetchAIAgentId,
          subgraphUrl: subgraphUrl,
          activatedAt: new Date(),
          lastSyncAt: new Date(),
          metadata: JSON.stringify({
            ...config,
            integrations: {
              graph: { subgraphUrl },
              fetchAI: { agentId: fetchAIAgentId },
              setupCompletedAt: new Date().toISOString()
            }
          }),
          updatedAt: new Date()
        }
      });
      
      // Send system notification about successful setup
      const { EmailService } = await import('../integrations/email-service');
      const emailService = new EmailService({
        apiKey: process.env.SENDGRID_API_KEY || '',
        fromEmail: process.env.SENDGRID_FROM_EMAIL || '',
        fromName: 'AI Payroll System'
      });
      
      await emailService.sendSystemNotification(
        'Repository Agent Activated',
        `Repository monitoring agent has been successfully activated for ${repository.fullName}.\n\n` +
        `Features enabled:\n` +
        `- The Graph analytics indexing\n` +
        `- Fetch.ai automated task scheduling\n` +
        `- Corporate usage detection\n` +
        `- Automated invoice generation\n` +
        `- Hedera payment processing\n\n` +
        `Agent ID: ${agentId}\n` +
        `Fetch.ai Agent: ${fetchAIAgentId}\n` +
        `Subgraph: ${subgraphUrl}`,
        'normal'
      );
      
      console.log(`Agent ${agentId} successfully activated with full integrations`);
    } catch (error) {
      console.error(`Error during integrated setup for agent ${agentId}:`, error);
      
      // Update agent status to ERROR
      await prisma.repoAgent.update({
        where: { id: agentId },
        data: {
          status: 'ERROR',
          lastError: error instanceof Error ? error.message : 'Setup failed',
          errorCount: { increment: 1 },
          updatedAt: new Date()
        }
      });
      
      // Send error notification
      try {
        const { EmailService } = await import('../integrations/email-service');
        const emailService = new EmailService({
          apiKey: process.env.SENDGRID_API_KEY || '',
          fromEmail: process.env.SENDGRID_FROM_EMAIL || '',
          fromName: 'AI Payroll System'
        });
        
        await emailService.sendSystemNotification(
          'Repository Agent Setup Failed',
          `Failed to activate repository monitoring agent.\n\n` +
          `Repository ID: ${repositoryId}\n` +
          `Agent ID: ${agentId}\n` +
          `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
          `Please check the system logs and retry the setup process.`,
          'high'
        );
      } catch (emailError) {
        console.error('Failed to send error notification:', emailError);
      }
      
      throw error;
    }
  }

  /**
   * Schedule agent setup tasks (legacy method - kept for compatibility)
   */
  private static async scheduleAgentSetup(
    agentId: string,
    repositoryId: string,
    config: AgentConfig
  ): Promise<void> {
    // Queue setup tasks
    const setupTasks = [
      {
        type: 'setup_subgraph',
        priority: 1,
        data: { agentId, repositoryId, config }
      },
      {
        type: 'setup_asi_agent',
        priority: 2,
        data: { agentId, repositoryId, config }
      },
      {
        type: 'initial_analytics_sync',
        priority: 3,
        data: { agentId, repositoryId }
      }
    ];

    for (const task of setupTasks) {
      await prisma.notificationQueue.create({
        data: {
          type: 'webhook',
          recipient: process.env.AGENT_WEBHOOK_URL || 'http://localhost:3001/webhooks/agent-setup',
          subject: task.type,
          content: JSON.stringify(task.data),
          priority: task.priority,
          templateId: task.type,
          templateData: JSON.stringify(task.data)
        }
      });
    }
  }

  /**
   * Update agent status
   */
  static async updateAgentStatus(
    agentId: string,
    status: string,
    error?: string
  ): Promise<void> {
    await prisma.repoAgent.update({
      where: { id: agentId },
      data: {
        status,
        lastError: error,
        errorCount: error ? { increment: 1 } : undefined,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Record analytics snapshot
   */
  static async recordAnalytics(
    agentId: string,
    date: Date,
    analytics: AnalyticsSnapshot
  ): Promise<void> {
    try {
      await prisma.repoAnalytics.upsert({
        where: {
          agentId_date: {
            agentId,
            date
          }
        },
        update: {
          totalContributors: analytics.totalContributors,
          totalPRs: analytics.totalPRs,
          totalCommits: analytics.totalCommits,
          totalStars: analytics.totalStars,
          totalForks: analytics.totalForks,
          totalClones: analytics.totalClones,
          totalViews: analytics.totalViews,
          newContributors: analytics.newContributors,
          activeContributors: analytics.activeContributors,
          corporateActivity: analytics.corporateActivity,
          contributorStats: JSON.stringify(analytics.contributorStats),
          rawData: JSON.stringify(analytics.rawData)
        },
        create: {
          agentId,
          date,
          totalContributors: analytics.totalContributors,
          totalPRs: analytics.totalPRs,
          totalCommits: analytics.totalCommits,
          totalStars: analytics.totalStars,
          totalForks: analytics.totalForks,
          totalClones: analytics.totalClones,
          totalViews: analytics.totalViews,
          newContributors: analytics.newContributors,
          activeContributors: analytics.activeContributors,
          corporateActivity: analytics.corporateActivity,
          contributorStats: JSON.stringify(analytics.contributorStats),
          rawData: JSON.stringify(analytics.rawData)
        }
      });

      // Update last sync time
      await prisma.repoAgent.update({
        where: { id: agentId },
        data: { lastSyncAt: new Date() }
      });
    } catch (error) {
      console.error('Error recording analytics:', error);
      throw new Error('Failed to record analytics snapshot');
    }
  }

  /**
   * Get agent with analytics
   */
  static async getAgentWithAnalytics(repositoryId: string) {
    return prisma.repoAgent.findUnique({
      where: { repositoryId },
      include: {
        repository: true,
        analytics: {
          orderBy: { date: 'desc' },
          take: 30 // Last 30 days
        },
        corporateUsers: {
          where: { status: { in: ['DETECTED', 'VERIFIED', 'INVOICED'] } }
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });
  }

  /**
   * Get analytics summary for dashboard
   */
  static async getAnalyticsSummary(repositoryId: string) {
    const agent = await this.getAgentWithAnalytics(repositoryId);
    
    if (!agent) {
      return null;
    }

    const latestAnalytics = agent.analytics[0];
    const previousAnalytics = agent.analytics[1];

    return {
      agent: {
        id: agent.id,
        status: agent.status,
        lastSyncAt: agent.lastSyncAt,
        errorCount: agent.errorCount
      },
      current: latestAnalytics ? {
        date: latestAnalytics.date,
        contributors: latestAnalytics.totalContributors,
        prs: latestAnalytics.totalPRs,
        commits: latestAnalytics.totalCommits,
        stars: latestAnalytics.totalStars,
        forks: latestAnalytics.totalForks,
        corporateActivity: latestAnalytics.corporateActivity
      } : null,
      trends: previousAnalytics && latestAnalytics ? {
        contributorsChange: latestAnalytics.totalContributors - previousAnalytics.totalContributors,
        prsChange: latestAnalytics.totalPRs - previousAnalytics.totalPRs,
        starsChange: latestAnalytics.totalStars - previousAnalytics.totalStars,
        corporateActivityChange: latestAnalytics.corporateActivity - previousAnalytics.corporateActivity
      } : null,
      corporateUsers: agent.corporateUsers.length,
      pendingInvoices: agent.invoices.filter(i => i.status === 'PENDING').length,
      paidInvoices: agent.invoices.filter(i => i.status === 'PAID').length
    };
  }

  /**
   * Fix stuck agents that are in INITIALIZING status
   */
  static async fixStuckAgents(): Promise<void> {
    try {
      const stuckAgents = await prisma.repoAgent.findMany({
        where: { 
          status: 'INITIALIZING',
          createdAt: {
            lt: new Date(Date.now() - 5 * 60 * 1000) // Older than 5 minutes
          }
        }
      });

      for (const agent of stuckAgents) {
        console.log(`Fixing stuck agent ${agent.id}`);
        
        try {
          const config = agent.metadata ? JSON.parse(agent.metadata) : {};
          await this.performDirectSetup(agent.id, agent.repositoryId, config);
        } catch (error) {
          console.error(`Failed to fix agent ${agent.id}:`, error);
        }
      }
      
      console.log(`Fixed ${stuckAgents.length} stuck agents`);
    } catch (error) {
      console.error('Error fixing stuck agents:', error);
    }
  }

  /**
   * Trigger manual sync for an agent
   */
  static async triggerManualSync(agentId: string, userId: string): Promise<void> {
    const agent = await prisma.repoAgent.findUnique({
      where: { id: agentId },
      include: { repository: true }
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    // Queue manual sync task
    await prisma.notificationQueue.create({
      data: {
        type: 'webhook',
        recipient: process.env.AGENT_WEBHOOK_URL || 'http://localhost:3001/webhooks/manual-sync',
        subject: 'manual_sync',
        content: JSON.stringify({ agentId, repositoryId: agent.repositoryId }),
        priority: 10, // High priority
        templateId: 'manual_sync',
        templateData: JSON.stringify({ agentId, userId, repository: agent.repository.fullName })
      }
    });

    await createAuditLog(
      userId,
      'MANUAL_SYNC_TRIGGERED',
      agent.repositoryId,
      { agentId }
    );
  }
}

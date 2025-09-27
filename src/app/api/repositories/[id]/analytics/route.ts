/**
 * Repository Analytics API
 * Provides analytics data and monitoring status for repositories
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, verifyUserAccess } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const repositoryId = id;

    // Verify user has access to this repository
    const repository = await prisma.repository.findFirst({
      where: {
        id: repositoryId,
        managerId: session.user.id
      }
    });

    if (!repository) {
      return NextResponse.json({ error: 'Repository not found or access denied' }, { status: 404 });
    }

    // Get agent and analytics data
    const agent = await prisma.repoAgent.findUnique({
      where: { repositoryId },
      include: {
        analytics: {
          orderBy: { date: 'desc' },
          take: 30
        },
        corporateUsers: {
          where: { status: { in: ['DETECTED', 'VERIFIED', 'INVOICED'] } },
          orderBy: { confidence: 'desc' }
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { payments: true }
        }
      }
    });

    if (!agent) {
      return NextResponse.json({
        status: 'not_initialized',
        message: 'Monitoring agent not initialized for this repository'
      });
    }

    // Calculate analytics summary
    const latestAnalytics = agent.analytics[0];
    const previousAnalytics = agent.analytics[1];

    const summary = {
      agent: {
        id: agent.id,
        status: agent.status,
        lastSyncAt: agent.lastSyncAt,
        errorCount: agent.errorCount,
        lastError: agent.lastError
      },
      analytics: {
        current: latestAnalytics ? {
          date: latestAnalytics.date,
          contributors: latestAnalytics.totalContributors,
          prs: latestAnalytics.totalPRs,
          commits: latestAnalytics.totalCommits,
          stars: latestAnalytics.totalStars,
          forks: latestAnalytics.totalForks,
          clones: latestAnalytics.totalClones,
          views: latestAnalytics.totalViews,
          corporateActivity: latestAnalytics.corporateActivity
        } : null,
        trends: previousAnalytics && latestAnalytics ? {
          contributorsChange: latestAnalytics.totalContributors - previousAnalytics.totalContributors,
          prsChange: latestAnalytics.totalPRs - previousAnalytics.totalPRs,
          starsChange: latestAnalytics.totalStars - previousAnalytics.totalStars,
          corporateActivityChange: latestAnalytics.corporateActivity - previousAnalytics.corporateActivity
        } : null,
        history: agent.analytics.map(a => ({
          date: a.date,
          contributors: a.totalContributors,
          prs: a.totalPRs,
          commits: a.totalCommits,
          stars: a.totalStars,
          forks: a.totalForks,
          corporateActivity: a.corporateActivity
        }))
      },
      corporateUsers: agent.corporateUsers.map(u => ({
        id: u.id,
        organizationName: u.organizationName,
        domain: u.domain,
        githubLogin: u.githubLogin,
        confidence: u.confidence,
        status: u.status,
        detectionMethod: u.detectionMethod,
        firstDetected: u.firstDetected,
        lastActivity: u.lastActivity,
        totalActivity: u.totalActivity
      })),
      invoices: {
        recent: agent.invoices.map(i => ({
          id: i.id,
          invoiceNumber: i.invoiceNumber,
          organizationName: i.organizationName,
          amount: i.amount,
          currency: i.currency,
          status: i.status,
          dueDate: i.dueDate,
          createdAt: i.createdAt,
          isPaid: i.payments.length > 0
        })),
        stats: {
          total: agent.invoices.length,
          pending: agent.invoices.filter(i => i.status === 'PENDING').length,
          paid: agent.invoices.filter(i => i.status === 'PAID').length,
          totalAmount: agent.invoices.reduce((sum, i) => sum + i.amount, 0),
          paidAmount: agent.invoices
            .filter(i => i.status === 'PAID')
            .reduce((sum, i) => sum + (i.paidAmount || 0), 0)
        }
      }
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error fetching repository analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const repositoryId = id;
    const { action } = await request.json();

    // Verify user has access to this repository
    const repository = await prisma.repository.findFirst({
      where: {
        id: repositoryId,
        managerId: session.user.id
      }
    });

    if (!repository) {
      return NextResponse.json({ error: 'Repository not found or access denied' }, { status: 404 });
    }

    switch (action) {
      case 'trigger_sync':
        // Trigger manual sync
        const agent = await prisma.repoAgent.findUnique({
          where: { repositoryId }
        });

        if (!agent) {
          return NextResponse.json({ error: 'Agent not initialized' }, { status: 404 });
        }

        const { RepoAgentService } = await import('@/lib/monitoring/repo-agent');
        await RepoAgentService.triggerManualSync(agent.id, session.user.id);

        return NextResponse.json({ message: 'Manual sync triggered' });

      case 'initialize_agent':
        // Initialize agent if not exists
        const existingAgent = await prisma.repoAgent.findUnique({
          where: { repositoryId }
        });

        if (existingAgent) {
          // If agent exists but is stuck in INITIALIZING status, fix it
          if (existingAgent.status === 'INITIALIZING') {
            console.log(`Fixing stuck agent ${existingAgent.id}`);
            try {
              const config = existingAgent.metadata ? JSON.parse(existingAgent.metadata) : {};
              const { RepoAgentService: FixService } = await import('@/lib/monitoring/repo-agent');
              await FixService.performDirectSetup(existingAgent.id, repositoryId, config);
              return NextResponse.json({ 
                message: 'Agent was stuck in initializing state and has been fixed',
                agentId: existingAgent.id
              });
            } catch (error) {
              console.error('Error fixing stuck agent:', error);
              return NextResponse.json({ error: 'Failed to fix stuck agent' }, { status: 500 });
            }
          }
          return NextResponse.json({ message: 'Agent already initialized' });
        }

        const { RepoAgentService: AgentService } = await import('@/lib/monitoring/repo-agent');
        const agentId = await AgentService.initializeAgent(
          repositoryId,
          session.user.id,
          {
            enableAnalytics: true,
            enableCorporateDetection: true,
            syncInterval: 3600
          }
        );

        return NextResponse.json({ 
          message: 'Agent initialized successfully',
          agentId
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing analytics request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

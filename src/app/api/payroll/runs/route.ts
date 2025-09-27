/**
 * API route for payroll run management
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, verifyUserAccess, createAuditLog } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createGitHubService } from '@/lib/github';
import { pythPriceService } from '@/lib/pyth';
import { distributionService } from '@/lib/distribution';
import { createHederaService } from '@/lib/hedera';
import { lighthouseService } from '@/lib/lighthouse';
import { createPayrollExecutionService } from '@/lib/execution';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await verifyUserAccess(session.user.id, 'manager', true);
    if (!access.authorized) {
      return NextResponse.json({ error: access.reason }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const where: any = {
      createdById: session.user.id
    };

    if (status) {
      where.status = status;
    }

    const runs = await prisma.payrollRun.findMany({
      where,
      include: {
        repositories: {
          select: {
            fullName: true,
            name: true
          }
        },
        payouts: {
          select: {
            status: true,
            usdAmount: true
          }
        },
        artifacts: {
          select: {
            type: true,
            cid: true,
            verified: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    });

    const total = await prisma.payrollRun.count({ where });

    return NextResponse.json({
      runs: runs.map(run => ({
        id: run.id,
        runNumber: run.runNumber,
        status: run.status,
        environment: run.environment,
        startDate: run.startDate,
        endDate: run.endDate,
        distributionMode: run.distributionMode,
        usdBudget: run.usdBudget,
        asset: run.asset,
        totalPrCount: run.totalPrCount,
        totalPayouts: run.totalPayouts,
        successfulPayouts: run.successfulPayouts,
        failedPayouts: run.failedPayouts,
        repositories: run.repositories.map(r => r.fullName),
        createdAt: run.createdAt,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        artifacts: run.artifacts.map(a => ({
          type: a.type,
          cid: a.cid,
          verified: a.verified
        })),
        summary: {
          totalUsdDistributed: run.payouts.reduce((sum, p) => sum + p.usdAmount, 0),
          statusCounts: run.payouts.reduce((counts, p) => {
            counts[p.status] = (counts[p.status] || 0) + 1;
            return counts;
          }, {} as Record<string, number>)
        }
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching payroll runs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payroll runs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await verifyUserAccess(session.user.id, 'manager', true);
    if (!access.authorized) {
      return NextResponse.json({ error: access.reason }, { status: 403 });
    }

    const body = await request.json();
    const {
      action,
      repositoryIds,
      startDate,
      endDate,
      distributionMode = 'PR_COUNT_PROPORTIONAL',
      usdBudget,
      asset = 'HBAR',
      minPrCountThreshold = 1,
      maxShareCap,
      environment = 'testnet',
      runId // For preview/execute actions
    } = body;

    switch (action) {
      case 'preview':
        return await handlePreview(session.user.id, {
          repositoryIds,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          distributionMode,
          usdBudget,
          asset,
          minPrCountThreshold,
          maxShareCap,
          environment
        });

      case 'create':
        return await handleCreateRun(session.user.id, {
          repositoryIds,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          distributionMode,
          usdBudget,
          asset,
          minPrCountThreshold,
          maxShareCap,
          environment
        });

      case 'execute':
        return await handleExecuteRun(session.user.id, runId);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error handling payroll run action:', error);
    return NextResponse.json(
      { error: 'Failed to process payroll run action' },
      { status: 500 }
    );
  }
}

async function handlePreview(userId: string, config: any) {
  try {
    // Validate repositories belong to user
    const repositories = await prisma.repository.findMany({
      where: {
        id: { in: config.repositoryIds },
        managerId: userId,
        active: true
      }
    });

    if (repositories.length !== config.repositoryIds.length) {
      return NextResponse.json({ error: 'Invalid repositories selected' }, { status: 400 });
    }

    // Get user's GitHub access token
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user?.githubAccessToken) {
      return NextResponse.json({ error: 'GitHub access token not found' }, { status: 400 });
    }

    // Collect PR data from GitHub
    const githubService = createGitHubService(user.githubAccessToken);
    const contributorStats = await githubService.searchMergedPRs({
      repos: repositories.map(r => r.fullName),
      startDate: config.startDate,
      endDate: config.endDate,
      includeLabels: repositories.flatMap(r => JSON.parse(r.includeLabels || "[]")),
      excludeLabels: repositories.flatMap(r => JSON.parse(r.excludeLabels || "[]"))
    });

    // Get current price from Pyth
    const priceSnapshot = await pythPriceService.getLatestPrice(config.asset === 'HBAR' ? 'HBAR' : config.asset);

    // Get verified contributors
    const verifiedContributors = new Map<string, string>();
    const contributors = await prisma.contributor.findMany({
      where: { active: true },
      include: { user: true }
    });

    contributors.forEach(contributor => {
      if (contributor.user.githubLogin) {
        verifiedContributors.set(contributor.user.githubLogin, contributor.id);
      }
    });

    // Calculate distribution
    const distributionConfig = {
      mode: 'PR_COUNT_PROPORTIONAL' as const,
      totalBudgetUsd: config.usdBudget,
      minPrCountThreshold: config.minPrCountThreshold,
      maxShareCap: config.maxShareCap
    };

    const assetDecimals = config.asset === 'HBAR' ? 8 : 8; // Assume 8 decimals for now
    const preview = distributionService.calculatePRCountDistribution(
      contributorStats,
      distributionConfig,
      priceSnapshot,
      config.asset,
      assetDecimals,
      verifiedContributors
    );

    // Validate distribution for execution readiness
    const validation = distributionService.validateDistributionForExecution(
      preview,
      verifiedContributors
    );

    return NextResponse.json({
      success: true,
      preview,
      validation,
      metadata: {
        repositories: repositories.map(r => ({ id: r.id, fullName: r.fullName })),
        contributorStats: Array.from(contributorStats.entries()).map(([login, stats]) => ({
          githubLogin: login,
          prCount: stats.prCount,
          verified: verifiedContributors.has(login)
        }))
      }
    });
  } catch (error) {
    console.error('Error generating preview:', error);
    return NextResponse.json(
      { error: 'Failed to generate preview' },
      { status: 500 }
    );
  }
}

async function handleCreateRun(userId: string, config: any) {
  try {
    // Generate preview first
    const previewResponse = await handlePreview(userId, config);
    const previewData = await previewResponse.json();

    if (!previewData.success) {
      return previewResponse;
    }

    const { preview } = previewData;

    // Create payroll run in database
    const run = await prisma.payrollRun.create({
      data: {
        repoIds: JSON.stringify(config.repositoryIds),
        startDate: config.startDate,
        endDate: config.endDate,
        distributionMode: config.distributionMode,
        usdBudget: config.usdBudget,
        asset: config.asset,
        pythFeedId: preview.priceSnapshot.feedId,
        priceSnapshot: pythPriceService.createStorableSnapshot(preview.priceSnapshot),
        environment: config.environment,
        createdById: userId,
        totalPrCount: preview.totalPrCount,
        totalPayouts: preview.distributions.filter((d: any) => d.eligible).length,
        previewHash: preview.metadata.previewHash,
        status: 'PREVIEW_READY'
      }
    });

    // Create run items (PR records)
    const runItems = [];
    for (const [githubLogin, stats] of Object.entries(previewData.metadata.contributorStats)) {
      for (const pr of (stats as any).prs || []) {
        runItems.push({
          runId: run.id,
          repo: pr.repository || '',
          prNumber: pr.number,
          authorLogin: githubLogin,
          authorId: (stats as any).id?.toString(),
          mergedAt: new Date(pr.merged_at),
          title: pr.title,
          labels: pr.labels?.map((l: any) => l.name) || [],
          linesAdded: pr.additions || 0,
          linesDeleted: pr.deletions || 0,
          filesChanged: pr.changed_files || 0,
          weight: 1.0,
          contributorId: preview.distributions.find((d: any) => d.githubLogin === githubLogin)?.contributorId
        });
      }
    }

    if (runItems.length > 0) {
      await prisma.runItem.createMany({
        data: runItems
      });
    }

    // Create payout records
    const payouts = preview.distributions
      .filter((d: any) => d.eligible && d.contributorId)
      .map((d: any) => ({
        runId: run.id,
        contributorId: d.contributorId,
        prCount: d.prCount,
        shareRatio: d.shareRatio,
        usdAmount: d.usdAmount,
        nativeAmount: d.nativeAmount,
        decimals: preview.metadata.assetDecimals,
        status: 'PENDING',
        idempotencyKey: distributionService.createPayoutIdempotencyKey(run.id, d.contributorId)
      }));

    if (payouts.length > 0) {
      await prisma.payout.createMany({
        data: payouts
      });
    }

    await createAuditLog(
      userId,
      'PAYROLL_RUN_CREATED',
      run.id,
      {
        repositories: config.repositoryIds,
        usdBudget: config.usdBudget,
        asset: config.asset,
        environment: config.environment
      }
    );

    return NextResponse.json({
      success: true,
      run: {
        id: run.id,
        runNumber: run.runNumber,
        status: run.status,
        previewHash: run.previewHash,
        createdAt: run.createdAt
      },
      preview
    });
  } catch (error) {
    console.error('Error creating payroll run:', error);
    return NextResponse.json(
      { error: 'Failed to create payroll run' },
      { status: 500 }
    );
  }
}

async function handleExecuteRun(userId: string, runId: string) {
  try {
    if (!runId) {
      return NextResponse.json({ error: 'Run ID is required' }, { status: 400 });
    }

    // Get run details
    const run = await prisma.payrollRun.findFirst({
      where: {
        id: runId,
        createdById: userId,
        status: 'PREVIEW_READY'
      },
      include: {
        payouts: {
          include: { contributor: true }
        }
      }
    });

    if (!run) {
      return NextResponse.json({ error: 'Run not found or not ready for execution' }, { status: 404 });
    }

    // Update run status to executing
    await prisma.payrollRun.update({
      where: { id: runId },
      data: {
        status: 'EXECUTING',
        startedAt: new Date()
      }
    });

    // Parse price snapshot for execution
    const priceSnapshot = pythPriceService.parseStoredSnapshot(run.priceSnapshot);

    // Create preview for execution
    const preview = {
      distributions: run.payouts.map(payout => ({
        githubLogin: payout.contributor.githubHandle || 'unknown',
        githubId: 0,
        contributorId: payout.contributorId,
        prCount: payout.prCount,
        shareRatio: payout.shareRatio,
        usdAmount: payout.usdAmount,
        nativeAmount: payout.nativeAmount,
        eligible: true
      })),
      metadata: {
        asset: run.asset,
        assetDecimals: 8 // Assume 8 decimals
      }
    };

    // Create execution context
    const hederaService = createHederaService({
      network: run.environment as 'testnet' | 'mainnet'
    });

    const executionContext = {
      runId: run.id,
      environment: run.environment as 'testnet' | 'mainnet',
      hederaService,
      lighthouseService,
      maxRetries: 3,
      retryDelay: 2000
    };

    // Start execution in background (in a real app, this would be a queue job)
    const executionService = createPayrollExecutionService(executionContext);
    
    // Execute the run
    const executionResult = await executionService.executePayrollRun(preview as any);

    await createAuditLog(
      userId,
      'PAYROLL_RUN_EXECUTED',
      runId,
      {
        successfulPayouts: executionResult.successfulPayouts,
        failedPayouts: executionResult.failedPayouts,
        artifacts: executionResult.artifacts
      }
    );

    return NextResponse.json({
      success: true,
      execution: {
        runId: executionResult.runId,
        status: executionResult.status,
        totalPayouts: executionResult.totalPayouts,
        successfulPayouts: executionResult.successfulPayouts,
        failedPayouts: executionResult.failedPayouts,
        finishedAt: executionResult.finishedAt,
        artifacts: executionResult.artifacts
      }
    });
  } catch (error) {
    console.error('Error executing payroll run:', error);
    
    // Update run status to failed
    if (runId) {
      await prisma.payrollRun.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          finishedAt: new Date()
        }
      });
    }

    return NextResponse.json(
      { error: 'Failed to execute payroll run' },
      { status: 500 }
    );
  }
}
/**
 * Payroll Run Detail API
 * Returns detailed information about a specific payroll run
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, verifyUserAccess } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await verifyUserAccess(session.user.id, 'manager', true);
    if (!access.authorized) {
      return NextResponse.json({ error: access.reason }, { status: 403 });
    }

    const { id } = await params;

    // Get specific payroll run by ID
    const run = await prisma.payrollRun.findFirst({
      where: {
        id,
        createdById: session.user.id
      },
      include: {
        payouts: {
          include: {
            contributor: {
              include: {
                user: true
              }
            }
          }
        },
        runItems: {
          orderBy: { mergedAt: 'desc' }
        },
        artifacts: true
      }
    });

    if (!run) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }

    // Parse repoIds from JSON string
    const repositoryIds = JSON.parse(run.repoIds || '[]');
    
    // Get repository details
    const repositories = await prisma.repository.findMany({
      where: {
        id: { in: repositoryIds }
      }
    });

    return NextResponse.json({
      run: {
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
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        repositories: repositories.map(r => ({
          id: r.id,
          name: r.name,
          fullName: r.fullName
        })),
        payouts: run.payouts.map(payout => ({
          id: payout.id,
          contributorId: payout.contributorId,
          prCount: payout.prCount,
          shareRatio: payout.shareRatio,
          usdAmount: payout.usdAmount,
          nativeAmount: payout.nativeAmount,
          status: payout.status,
          txId: payout.txId,
          error: payout.error,
          submittedAt: payout.submittedAt,
          confirmedAt: payout.confirmedAt,
          contributor: {
            githubHandle: payout.contributor.githubHandle || payout.contributor.user?.githubLogin || 'unknown',
            hederaAccountId: payout.contributor.hederaAccountId
          }
        })),
        runItems: run.runItems.map(item => ({
          id: item.id,
          repo: item.repo,
          prNumber: item.prNumber,
          authorLogin: item.authorLogin,
          mergedAt: item.mergedAt,
          title: item.title,
          linesAdded: item.linesAdded,
          linesDeleted: item.linesDeleted,
          filesChanged: item.filesChanged
        })),
        artifacts: run.artifacts.map(artifact => ({
          id: artifact.id,
          type: artifact.type,
          filename: artifact.filename,
          cid: artifact.cid,
          size: artifact.size,
          verified: artifact.verified,
          createdAt: artifact.createdAt
        })),
        priceSnapshot: run.priceSnapshot
      }
    });
  } catch (error) {
    console.error('Error fetching payroll run:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payroll run' },
      { status: 500 }
    );
  }
}

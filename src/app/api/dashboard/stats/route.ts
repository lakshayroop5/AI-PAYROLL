/**
 * Dashboard stats API endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, verifyUserAccess } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get dashboard statistics
    const stats = await getDashboardStats(session.user.id, session.user.roles || []);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}

async function getDashboardStats(userId: string, userRoles: string[]) {
  const isManager = userRoles.includes('manager');
  const isContributor = userRoles.includes('contributor');

  if (isManager) {
    // Manager stats
    const [totalRuns, activeRuns, totalContributors, payoutData] = await Promise.all([
      prisma.payrollRun.count({
        where: { createdById: userId }
      }),
      prisma.payrollRun.count({
        where: {
          createdById: userId,
          status: { in: ['PENDING', 'EXECUTING', 'PREVIEW_READY'] }
        }
      }),
      prisma.contributor.count({
        where: { active: true }
      }),
      prisma.payout.aggregate({
        where: {
          run: { createdById: userId },
          status: 'CONFIRMED'
        },
        _sum: { usdAmount: true },
        _count: { id: true }
      })
    ]);

    const totalPayouts = await prisma.payout.count({
      where: {
        run: { createdById: userId }
      }
    });

    const successfulPayouts = payoutData._count.id || 0;
    const totalDistributed = payoutData._sum.usdAmount || 0;
    const successRate = totalPayouts > 0 ? successfulPayouts / totalPayouts : 0;

    return {
      totalRuns,
      activeRuns,
      totalContributors,
      totalDistributed,
      successRate
    };
  } else if (isContributor) {
    // Contributor stats
    const contributor = await prisma.contributor.findFirst({
      where: { userId }
    });

    if (!contributor) {
      return {
        totalPayouts: 0,
        totalEarnings: 0,
        totalPRs: 0,
        lastPayout: null
      };
    }

    const [payoutStats, lastPayout] = await Promise.all([
      prisma.payout.aggregate({
        where: {
          contributorId: contributor.id,
          status: 'CONFIRMED'
        },
        _sum: { usdAmount: true, prCount: true },
        _count: { id: true }
      }),
      prisma.payout.findFirst({
        where: {
          contributorId: contributor.id,
          status: 'CONFIRMED'
        },
        orderBy: { confirmedAt: 'desc' }
      })
    ]);

    return {
      totalPayouts: payoutStats._count.id || 0,
      totalEarnings: payoutStats._sum.usdAmount || 0,
      totalPRs: payoutStats._sum.prCount || 0,
      lastPayout: lastPayout?.confirmedAt || null
    };
  }

  // Default stats for users without specific roles
  return {
    message: 'Complete your profile setup to view statistics'
  };
}
/**
 * Dashboard activity API endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    // Get recent activities from audit logs
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        userId: session.user.id
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    // Transform audit logs to activity format
    const activities = auditLogs.map(log => ({
      id: log.id,
      type: mapActionToType(log.action),
      title: generateTitle(log.action),
      description: generateDescription(log.action, log.details),
      timestamp: log.createdAt.toISOString(),
      status: extractStatus(log.details)
    }));

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('Error fetching dashboard activity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard activity' },
      { status: 500 }
    );
  }
}

function mapActionToType(action: string): string {
  const typeMap: Record<string, string> = {
    'PAYROLL_RUN_CREATED': 'run_created',
    'PAYROLL_RUN_EXECUTED': 'run_executed',
    'CONTRIBUTOR_PROFILE_CREATED': 'contributor_added',
    'SELF_VERIFICATION_COMPLETED': 'verification_completed',
    'REPOSITORY_ADDED': 'repository_added'
  };
  return typeMap[action] || 'other';
}

function generateTitle(action: string): string {
  const titleMap: Record<string, string> = {
    'PAYROLL_RUN_CREATED': 'Payroll Run Created',
    'PAYROLL_RUN_EXECUTED': 'Payroll Run Executed',
    'CONTRIBUTOR_PROFILE_CREATED': 'Contributor Profile Created',
    'SELF_VERIFICATION_COMPLETED': 'Self Verification Completed',
    'REPOSITORY_ADDED': 'Repository Added',
    'REPOSITORY_UPDATED': 'Repository Updated',
    'REPOSITORY_DELETED': 'Repository Removed'
  };
  return titleMap[action] || 'System Activity';
}

function generateDescription(action: string, details: string | null): string {
  try {
    const data = details ? JSON.parse(details) : {};
    
    switch (action) {
      case 'PAYROLL_RUN_CREATED':
        return `Created payroll run with budget $${data.usdBudget || 0}`;
      case 'PAYROLL_RUN_EXECUTED':
        return `Executed payroll with ${data.successfulPayouts || 0} successful payouts`;
      case 'CONTRIBUTOR_PROFILE_CREATED':
        return `Set up contributor profile with Hedera account ${data.hederaAccountId || ''}`;
      case 'SELF_VERIFICATION_COMPLETED':
        return 'Successfully completed Self identity verification';
      case 'REPOSITORY_ADDED':
        return `Added repository ${data.fullName || ''}`;
      default:
        return 'System activity completed';
    }
  } catch (error) {
    return 'Activity completed';
  }
}

function extractStatus(details: string | null): string | undefined {
  try {
    const data = details ? JSON.parse(details) : {};
    return data.status;
  } catch (error) {
    return undefined;
  }
}
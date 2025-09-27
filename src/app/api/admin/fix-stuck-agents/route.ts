/**
 * Admin API to fix stuck repository agents
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { RepoAgentService } from '@/lib/monitoring/repo-agent';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Optional: Add admin role check
    // if (!session.user.roles?.includes('ADMIN')) {
    //   return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    // }

    console.log('Fixing stuck agents...');
    await RepoAgentService.fixStuckAgents();

    return NextResponse.json({ 
      message: 'Stuck agents repair process completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fixing stuck agents:', error);
    return NextResponse.json(
      { error: 'Failed to fix stuck agents' },
      { status: 500 }
    );
  }
}

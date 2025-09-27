/**
 * Debug Contributors API - Check contributor data
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

    console.log(`🔍 Debug: Current user is ${session.user.email} (${session.user.id})`);

    // Get all contributors
    const allContributors = await prisma.contributor.findMany({
      select: {
        id: true,
        githubHandle: true,
        hederaAccountId: true,
        userId: true,
        active: true
      }
    });

    // Get contributors with wallets
    const contributorsWithWallets = await prisma.contributor.findMany({
      where: {
        active: true,
        hederaAccountId: { not: "" }
      },
      select: {
        id: true,
        githubHandle: true,
        hederaAccountId: true,
        userId: true,
        active: true
      }
    });

    // Get contributors excluding current user
    const contributorsExcludingUser = await prisma.contributor.findMany({
      where: {
        active: true,
        hederaAccountId: { not: "" },
        userId: { not: session.user.id }
      },
      select: {
        id: true,
        githubHandle: true,
        hederaAccountId: true,
        userId: true,
        active: true
      }
    });

    return NextResponse.json({
      success: true,
      currentUser: {
        email: session.user.email,
        id: session.user.id
      },
      debug: {
        allContributors: allContributors.length,
        contributorsWithWallets: contributorsWithWallets.length,
        contributorsExcludingUser: contributorsExcludingUser.length
      },
      data: {
        allContributors,
        contributorsWithWallets,
        contributorsExcludingUser
      }
    });

  } catch (error) {
    console.error('❌ Error in debug contributors:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch debug data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

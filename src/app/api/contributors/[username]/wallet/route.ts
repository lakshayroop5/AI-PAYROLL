/**
 * Contributor Wallet Management API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { HederaAgentService } from '@/lib/integrations/hedera-agent';

export async function POST(
  request: NextRequest,
  { params }: { params: { username: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { username } = params;
    const { hederaAccountId } = await request.json();

    console.log('💳 Updating wallet for:', username, 'to:', hederaAccountId);

    // Validate Hedera account ID format
    if (hederaAccountId && !HederaAgentService.isValidAccountId(hederaAccountId)) {
      return NextResponse.json({ 
        error: 'Invalid Hedera account ID format. Expected format: 0.0.xxxxxx' 
      }, { status: 400 });
    }

    // Check if user is updating their own profile or is a manager
    const isManager = session.user.roles?.includes('manager');
    const isOwnProfile = session.user.githubLogin === username;

    if (!isManager && !isOwnProfile) {
      return NextResponse.json({ 
        error: 'You can only update your own wallet address' 
      }, { status: 403 });
    }

    // Find or create contributor record
    let contributor = await prisma.contributor.findFirst({
      where: { githubHandle: username }
    });

    if (!contributor) {
      // Create new contributor record
      contributor = await prisma.contributor.create({
        data: {
          userId: session.user.id, // Link to current user for now
          githubHandle: username,
          hederaAccountId: hederaAccountId || null,
          active: true,
          minPayoutThreshold: 10.0, // Default $10 threshold
          maxPayoutCap: 1000.0 // Default $1000 cap
        }
      });
      console.log('✅ Created new contributor record');
    } else {
      // Update existing contributor
      contributor = await prisma.contributor.update({
        where: { id: contributor.id },
        data: {
          hederaAccountId: hederaAccountId || null,
          updatedAt: new Date()
        }
      });
      console.log('✅ Updated existing contributor record');
    }

    // Log the wallet update
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'WALLET_UPDATED',
        resource: contributor.id,
        details: JSON.stringify({
          githubHandle: username,
          oldWallet: contributor.hederaAccountId,
          newWallet: hederaAccountId
        }),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    });

    return NextResponse.json({
      success: true,
      message: hederaAccountId 
        ? 'Wallet address updated successfully' 
        : 'Wallet address removed successfully',
      contributor: {
        id: contributor.id,
        githubHandle: contributor.githubHandle,
        hederaAccountId: contributor.hederaAccountId,
        active: contributor.active
      }
    });

  } catch (error) {
    console.error('❌ Error updating wallet:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to update wallet address',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

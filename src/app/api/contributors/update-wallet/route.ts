/**
 * Update Contributor Wallet API
 * Allows managers to directly update contributor wallet addresses
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
// Removed Hedera-specific import

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contributorId, githubLogin, hederaAccountId: walletAddress } = await request.json();

    console.log('💳 Manager updating wallet for:', githubLogin, '→', walletAddress);

    // Validate inputs
    if (!contributorId || !githubLogin) {
      return NextResponse.json({ 
        error: 'Missing contributor ID or GitHub login' 
      }, { status: 400 });
    }

    // Basic wallet address validation if provided
    if (walletAddress && walletAddress.trim().length < 10) {
      return NextResponse.json({ 
        error: 'Invalid wallet address. Must be at least 10 characters long.' 
      }, { status: 400 });
    }

    // Check if user is a manager (has repositories)
    const userRepositories = await prisma.repository.findMany({
      where: { 
        managerId: session.user.id,
        active: true 
      }
    });

    if (userRepositories.length === 0) {
      return NextResponse.json({ 
        error: 'Only repository managers can update contributor wallets' 
      }, { status: 403 });
    }

    // Find or create contributor record
    let contributor = await prisma.contributor.findFirst({
      where: { githubHandle: githubLogin }
    });

    if (!contributor) {
      // Create new contributor record
      contributor = await prisma.contributor.create({
        data: {
          userId: session.user.id, // Link to manager for now
          githubHandle: githubLogin,
          hederaAccountId: walletAddress || null,
          active: true,
          minPayoutThreshold: 10.0, // Default $10 threshold
          maxPayoutCap: 1000.0 // Default $1000 cap
        }
      });
      console.log('✅ Created new contributor record for', githubLogin);
    } else {
      // Update existing contributor
      const oldWallet = contributor.hederaAccountId;
      contributor = await prisma.contributor.update({
        where: { id: contributor.id },
        data: {
          hederaAccountId: walletAddress || null,
          active: true,
          updatedAt: new Date()
        }
      });
      console.log('✅ Updated wallet for', githubLogin, 'from', oldWallet, 'to', walletAddress);
    }

    // Log the wallet update
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'WALLET_UPDATED_BY_MANAGER',
        resource: contributor.id,
        details: JSON.stringify({
          githubHandle: githubLogin,
          contributorId,
          oldWallet: contributor.hederaAccountId,
          newWallet: walletAddress,
          managerId: session.user.id,
          managerEmail: session.user.email
        }),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    });

    return NextResponse.json({
      success: true,
      message: walletAddress 
        ? 'Contributor wallet updated successfully' 
        : 'Contributor wallet removed successfully',
      contributor: {
        id: contributor.id,
        githubHandle: contributor.githubHandle,
        hederaAccountId: contributor.hederaAccountId,
        active: contributor.active,
        isRegistered: true
      }
    });

  } catch (error) {
    console.error('❌ Error updating contributor wallet:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to update contributor wallet',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

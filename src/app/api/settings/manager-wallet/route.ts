/**
 * Manager Wallet API
 * Handles saving and retrieving the manager's payment wallet address
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

    // Get user's wallet address from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { managerWalletAddress: true }
    });

    return NextResponse.json({
      success: true,
      walletAddress: user?.managerWalletAddress || null
    });

  } catch (error) {
    console.error('❌ Error fetching manager wallet:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch wallet address',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
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

    const { walletAddress } = await request.json();

    console.log('💳 Saving manager wallet for:', session.user.email, '→', walletAddress);

    // Basic validation
    if (walletAddress && walletAddress.trim().length < 10) {
      return NextResponse.json({ 
        error: 'Invalid wallet address. Must be at least 10 characters long.' 
      }, { status: 400 });
    }

    // Update user's wallet address
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        managerWalletAddress: walletAddress ? walletAddress.trim() : null,
        updatedAt: new Date()
      }
    });

    // Log the wallet update
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'MANAGER_WALLET_UPDATED',
        resource: session.user.id,
        details: JSON.stringify({
          oldWallet: updatedUser.managerWalletAddress !== walletAddress ? 'hidden' : 'same',
          newWallet: walletAddress ? 'set' : 'removed',
          managerEmail: session.user.email,
          timestamp: new Date().toISOString()
        }),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    });

    return NextResponse.json({
      success: true,
      message: walletAddress 
        ? 'Manager wallet updated successfully' 
        : 'Manager wallet removed successfully',
      walletAddress: updatedUser.managerWalletAddress
    });

  } catch (error) {
    console.error('❌ Error updating manager wallet:', error);
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

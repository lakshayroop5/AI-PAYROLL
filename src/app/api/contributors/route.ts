/**
 * API route for contributor management
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, verifyUserAccess, createAuditLog } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { HederaService } from '@/lib/hedera';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const isManager = searchParams.get('isManager') === 'true';

    if (isManager) {
      // Manager viewing all contributors
      const access = await verifyUserAccess(session.user.id, 'manager', true);
      if (!access.authorized) {
        return NextResponse.json({ error: access.reason }, { status: 403 });
      }

      const contributors = await prisma.contributor.findMany({
        include: {
          user: {
            select: {
              email: true,
              githubLogin: true,
              selfVerificationStatus: true,
              selfVerifiedAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return NextResponse.json({
        contributors: contributors.map(contributor => ({
          id: contributor.id,
          hederaAccountId: contributor.hederaAccountId,
          githubHandle: contributor.githubHandle,
          active: contributor.active,
          email: contributor.user.email,
          githubLogin: contributor.user.githubLogin,
          selfVerified: contributor.user.selfVerificationStatus,
          selfVerifiedAt: contributor.user.selfVerifiedAt,
          createdAt: contributor.createdAt
        }))
      });
    } else {
      // User viewing their own contributor profile
      const contributor = await prisma.contributor.findFirst({
        where: { userId: session.user.id },
        include: {
          user: {
            select: {
              email: true,
              githubLogin: true,
              selfVerificationStatus: true,
              selfVerifiedAt: true
            }
          }
        }
      });

      return NextResponse.json({
        contributor: contributor ? {
          id: contributor.id,
          hederaAccountId: contributor.hederaAccountId,
          githubHandle: contributor.githubHandle,
          active: contributor.active,
          minPayoutThreshold: contributor.minPayoutThreshold,
          maxPayoutCap: contributor.maxPayoutCap,
          tokenAssociations: contributor.tokenAssociations,
          selfVerified: contributor.user.selfVerificationStatus,
          selfVerifiedAt: contributor.user.selfVerifiedAt,
          createdAt: contributor.createdAt
        } : null
      });
    }
  } catch (error) {
    console.error('Error fetching contributors:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contributors' },
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

    // Verify user has Self verification
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user?.selfVerificationStatus) {
      return NextResponse.json({ 
        error: 'Self verification required to create contributor profile' 
      }, { status: 403 });
    }

    const body = await request.json();
    const { 
      hederaAccountId, 
      githubHandle, 
      minPayoutThreshold, 
      maxPayoutCap 
    } = body;

    if (!hederaAccountId) {
      return NextResponse.json({ 
        error: 'Hedera account ID is required' 
      }, { status: 400 });
    }

    // Validate Hedera account ID format
    if (!HederaService.isValidAccountId(hederaAccountId)) {
      return NextResponse.json({ 
        error: 'Invalid Hedera account ID format' 
      }, { status: 400 });
    }

    // Check if contributor profile already exists
    const existingContributor = await prisma.contributor.findFirst({
      where: { userId: session.user.id }
    });

    if (existingContributor) {
      return NextResponse.json({ 
        error: 'Contributor profile already exists' 
      }, { status: 400 });
    }

    // Check for duplicate Hedera account ID
    const duplicateAccount = await prisma.contributor.findFirst({
      where: { hederaAccountId }
    });

    if (duplicateAccount) {
      return NextResponse.json({ 
        error: 'Hedera account ID already in use' 
      }, { status: 400 });
    }

    // Create contributor profile
    const contributor = await prisma.contributor.create({
      data: {
        userId: session.user.id,
        hederaAccountId,
        githubHandle: githubHandle || user.githubLogin,
        minPayoutThreshold,
        maxPayoutCap,
        tokenAssociations: JSON.stringify([]),
        active: true
      }
    });

    // Add contributor role if not already present
    let roles: string[] = [];
    try {
      roles = user.roles ? JSON.parse(user.roles) : [];
    } catch {
      roles = [];
    }

    if (!roles.includes('contributor')) {
      roles.push('contributor');
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          roles: JSON.stringify(roles)
        }
      });
    }

    await createAuditLog(
      session.user.id,
      'CONTRIBUTOR_PROFILE_CREATED',
      contributor.id,
      { hederaAccountId, githubHandle }
    );

    return NextResponse.json({
      success: true,
      contributor: {
        id: contributor.id,
        hederaAccountId: contributor.hederaAccountId,
        githubHandle: contributor.githubHandle,
        active: contributor.active,
        minPayoutThreshold: contributor.minPayoutThreshold,
        maxPayoutCap: contributor.maxPayoutCap,
        createdAt: contributor.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating contributor profile:', error);
    return NextResponse.json(
      { error: 'Failed to create contributor profile' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      hederaAccountId, 
      githubHandle, 
      minPayoutThreshold, 
      maxPayoutCap,
      active 
    } = body;

    // Get contributor profile
    const contributor = await prisma.contributor.findFirst({
      where: { userId: session.user.id }
    });

    if (!contributor) {
      return NextResponse.json({ 
        error: 'Contributor profile not found' 
      }, { status: 404 });
    }

    // Validate Hedera account ID if changed
    if (hederaAccountId && hederaAccountId !== contributor.hederaAccountId) {
      if (!HederaService.isValidAccountId(hederaAccountId)) {
        return NextResponse.json({ 
          error: 'Invalid Hedera account ID format' 
        }, { status: 400 });
      }

      // Check for duplicate
      const duplicateAccount = await prisma.contributor.findFirst({
        where: { 
          hederaAccountId,
          id: { not: contributor.id }
        }
      });

      if (duplicateAccount) {
        return NextResponse.json({ 
          error: 'Hedera account ID already in use' 
        }, { status: 400 });
      }
    }

    // Update contributor profile
    const updatedContributor = await prisma.contributor.update({
      where: { id: contributor.id },
      data: {
        hederaAccountId: hederaAccountId || contributor.hederaAccountId,
        githubHandle: githubHandle || contributor.githubHandle,
        minPayoutThreshold: minPayoutThreshold !== undefined ? minPayoutThreshold : contributor.minPayoutThreshold,
        maxPayoutCap: maxPayoutCap !== undefined ? maxPayoutCap : contributor.maxPayoutCap,
        active: active !== undefined ? active : contributor.active,
        updatedAt: new Date()
      }
    });

    await createAuditLog(
      session.user.id,
      'CONTRIBUTOR_PROFILE_UPDATED',
      contributor.id,
      { hederaAccountId, githubHandle, active }
    );

    return NextResponse.json({
      success: true,
      contributor: {
        id: updatedContributor.id,
        hederaAccountId: updatedContributor.hederaAccountId,
        githubHandle: updatedContributor.githubHandle,
        active: updatedContributor.active,
        minPayoutThreshold: updatedContributor.minPayoutThreshold,
        maxPayoutCap: updatedContributor.maxPayoutCap,
        updatedAt: updatedContributor.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating contributor profile:', error);
    return NextResponse.json(
      { error: 'Failed to update contributor profile' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get contributor profile
    const contributor = await prisma.contributor.findFirst({
      where: { userId: session.user.id }
    });

    if (!contributor) {
      return NextResponse.json({ 
        error: 'Contributor profile not found' 
      }, { status: 404 });
    }

    // Check if contributor has pending payouts
    const pendingPayouts = await prisma.payout.count({
      where: {
        contributorId: contributor.id,
        status: {
          in: ['PENDING', 'SUBMITTED']
        }
      }
    });

    if (pendingPayouts > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete profile with pending payouts' 
      }, { status: 400 });
    }

    // Delete contributor profile
    await prisma.contributor.delete({
      where: { id: contributor.id }
    });

    // Remove contributor role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (user) {
      let roles: string[] = [];
      try {
        roles = user.roles ? JSON.parse(user.roles) : [];
      } catch {
        roles = [];
      }

      const filteredRoles = roles.filter(role => role !== 'contributor');
      
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          roles: JSON.stringify(filteredRoles)
        }
      });
    }

    await createAuditLog(
      session.user.id,
      'CONTRIBUTOR_PROFILE_DELETED',
      contributor.id,
      { hederaAccountId: contributor.hederaAccountId }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting contributor profile:', error);
    return NextResponse.json(
      { error: 'Failed to delete contributor profile' },
      { status: 500 }
    );
  }
}
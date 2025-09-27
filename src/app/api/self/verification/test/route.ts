/**
 * Test endpoint for manually completing self verification
 * This is for development/testing purposes only
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { complete = true } = body;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (complete) {
      // Parse existing roles
      let roles: string[] = [];
      try {
        roles = user.roles ? JSON.parse(user.roles) : [];
      } catch {
        roles = [];
      }

      // Add both roles for testing
      if (!roles.includes('manager')) {
        roles.push('manager');
      }
      if (!roles.includes('contributor')) {
        roles.push('contributor');
      }

      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          selfVerificationStatus: true,
          selfVerificationId: `test_identity_${Date.now()}`,
          selfVerifiedAt: new Date(),
          roles: JSON.stringify(roles)
        }
      });

      await createAuditLog(
        session.user.id,
        'SELF_VERIFICATION_COMPLETED',
        undefined,
        {
          method: 'test_endpoint',
          identityId: `test_identity_${Date.now()}`,
          verifiedAt: new Date().toISOString()
        }
      );

      return NextResponse.json({
        success: true,
        message: 'Verification completed via test endpoint'
      });
    } else {
      // Reset verification status
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          selfVerificationStatus: false,
          selfVerificationId: null,
          selfVerifiedAt: null
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Verification status reset'
      });
    }
  } catch (error) {
    console.error('Test verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

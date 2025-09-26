/**
 * API route for Self identity verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { selfIdentityService } from '@/lib/self-identity';
import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, proofResponse, userType } = body;

    switch (action) {
      case 'request_proof':
        return await handleProofRequest(session.user.id, userType);
      
      case 'verify_proof':
        return await handleProofVerification(session.user.id, proofResponse, userType);
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Self verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleProofRequest(userId: string, userType: 'manager' | 'contributor') {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Request identity proof from Self
    const proofRequest = await selfIdentityService.requestIdentityProof(
      user.email,
      'personhood'
    );

    // Generate QR code for mobile app
    const qrCodeUrl = await selfIdentityService.generateProofQRCode(proofRequest);

    await createAuditLog(
      userId,
      'SELF_PROOF_REQUESTED',
      undefined,
      { userType, requestId: proofRequest.requestId }
    );

    return NextResponse.json({
      success: true,
      requestId: proofRequest.requestId,
      qrCodeUrl,
      challenge: proofRequest.challenge,
      metadata: proofRequest.metadata
    });
  } catch (error) {
    console.error('Error requesting Self proof:', error);
    return NextResponse.json(
      { error: 'Failed to request proof' },
      { status: 500 }
    );
  }
}

async function handleProofVerification(userId: string, proofResponse: any, userType: 'manager' | 'contributor') {
  try {
    // Verify the proof with Self
    const verificationResult = await selfIdentityService.verifyProof(proofResponse);

    if (!verificationResult.isValid) {
      await createAuditLog(
        userId,
        'SELF_VERIFICATION_FAILED',
        undefined,
        { userType, error: verificationResult.error }
      );

      return NextResponse.json({
        success: false,
        error: verificationResult.error || 'Verification failed'
      });
    }

    // Update user verification status
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse existing roles
    let roles: string[] = [];
    try {
      roles = user.roles ? JSON.parse(user.roles) : [];
    } catch {
      roles = [];
    }

    // Add role if not already present
    const roleToAdd = userType === 'manager' ? 'manager' : 'contributor';
    if (!roles.includes(roleToAdd)) {
      roles.push(roleToAdd);
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        selfVerificationStatus: true,
        selfVerificationId: verificationResult.identityId,
        selfVerifiedAt: verificationResult.verifiedAt,
        roles: JSON.stringify(roles)
      }
    });

    await createAuditLog(
      userId,
      'SELF_VERIFICATION_COMPLETED',
      undefined,
      {
        userType,
        identityId: verificationResult.identityId,
        verifiedAt: verificationResult.verifiedAt
      }
    );

    return NextResponse.json({
      success: true,
      verificationResult: {
        identityId: verificationResult.identityId,
        verifiedAt: verificationResult.verifiedAt
      }
    });
  } catch (error) {
    console.error('Error verifying Self proof:', error);
    return NextResponse.json(
      { error: 'Failed to verify proof' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      verified: user.selfVerificationStatus,
      verifiedAt: user.selfVerifiedAt,
      identityId: user.selfVerificationId
    });
  } catch (error) {
    console.error('Error getting verification status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
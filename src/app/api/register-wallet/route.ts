/**
 * Public Wallet Registration API
 * Allows any contributor to register their Hedera wallet
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { HederaAgentService } from '@/lib/integrations/hedera-agent';
import { createGitHubService } from '@/lib/github';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Please sign in with GitHub to register your wallet' }, { status: 401 });
    }

    const { hederaAccountId } = await request.json();

    console.log('💳 Registering wallet for:', session.user.githubLogin, '→', hederaAccountId);

    // Validate Hedera account ID format
    if (!hederaAccountId || !HederaAgentService.isValidAccountId(hederaAccountId)) {
      return NextResponse.json({ 
        error: 'Invalid Hedera account ID format. Expected format: 0.0.xxxxxx' 
      }, { status: 400 });
    }

    const githubLogin = session.user.githubLogin;
    if (!githubLogin) {
      return NextResponse.json({ 
        error: 'GitHub username not found. Please reconnect your GitHub account.' 
      }, { status: 400 });
    }

    // Check if contributor is actually contributing to any managed repositories
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user?.githubAccessToken) {
      return NextResponse.json({ 
        error: 'GitHub access token not found. Please reconnect your account.' 
      }, { status: 400 });
    }

    // Find repositories that this user contributes to
    const allRepositories = await prisma.repository.findMany({
      where: { active: true }
    });

    console.log(`🔍 Checking contributions across ${allRepositories.length} repositories...`);

    let isContributor = false;
    const contributingRepos: string[] = [];

    // Check if user contributes to any active repositories
    for (const repo of allRepositories.slice(0, 5)) { // Limit to avoid rate limits
      try {
        const repoOwner = await prisma.user.findUnique({
          where: { id: repo.managerId }
        });

        if (repoOwner?.githubAccessToken) {
          const githubService = createGitHubService(repoOwner.githubAccessToken);
          
          try {
            const contributors = await githubService.getRepoContributors(repo.owner, repo.name);
            const isRepoContributor = contributors.some(c => c.login === githubLogin);
            
            if (isRepoContributor) {
              isContributor = true;
              contributingRepos.push(repo.fullName);
            }
          } catch (repoError) {
            console.error(`Error checking ${repo.fullName}:`, repoError);
          }
        }
      } catch (error) {
        console.error(`Error processing repository ${repo.fullName}:`, error);
      }
    }

    if (!isContributor && contributingRepos.length === 0) {
      console.log(`⚠️ User ${githubLogin} is not a contributor to any managed repositories`);
      // Still allow registration - they might become a contributor later
    }

    // Find or create contributor record
    let contributor = await prisma.contributor.findFirst({
      where: { githubHandle: githubLogin }
    });

    if (!contributor) {
      // Create new contributor record
      contributor = await prisma.contributor.create({
        data: {
          userId: session.user.id,
          githubHandle: githubLogin,
          hederaAccountId,
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
          hederaAccountId,
          active: true,
          updatedAt: new Date()
        }
      });
      console.log('✅ Updated existing contributor record');
    }

    // Log the registration
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'WALLET_REGISTERED',
        resource: contributor.id,
        details: JSON.stringify({
          githubHandle: githubLogin,
          hederaAccountId,
          contributingRepos,
          isExistingContributor: !!contributor
        }),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Wallet registered successfully! You can now receive payouts.',
      contributor: {
        id: contributor.id,
        githubHandle: contributor.githubHandle,
        hederaAccountId: contributor.hederaAccountId,
        active: contributor.active,
        contributingRepos
      },
      nextSteps: [
        'Keep contributing to repositories',
        'You\'ll receive email notifications for payouts',
        'Check your Hedera wallet for incoming payments'
      ]
    });

  } catch (error) {
    console.error('❌ Error registering wallet:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to register wallet',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

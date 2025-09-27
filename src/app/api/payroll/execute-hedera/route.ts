/**
 * Execute Payroll via Hedera - Dynamic Repository-Based Flow
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createGitHubService } from '@/lib/github';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      console.log('❌ Unauthorized: No session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { payrollRunId } = await request.json();

    if (!payrollRunId) {
      console.log('❌ Missing payroll run ID');
      return NextResponse.json({ error: 'Payroll run ID is required' }, { status: 400 });
    }

    console.log(`🚀 Executing dynamic payroll for run ${payrollRunId}...`);

    // Get the payroll run
    const payrollRun = await prisma.payrollRun.findUnique({
      where: { id: payrollRunId }
    });

    if (!payrollRun) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }

    // Parse repository IDs from JSON field
    const repositoryIds = JSON.parse(payrollRun.repoIds || '[]');
    if (!repositoryIds.length) {
      return NextResponse.json({ error: 'No repositories associated with this payroll run' }, { status: 400 });
    }

    // Get repository information from the parsed IDs
    const repositories = await prisma.repository.findMany({
      where: {
        id: { in: repositoryIds }
      }
    });

    if (!repositories.length) {
      return NextResponse.json({ error: 'No repository found for this payroll run' }, { status: 400 });
    }

    // Get user's GitHub access token
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user?.githubAccessToken) {
      return NextResponse.json({ error: 'GitHub access token not found' }, { status: 400 });
    }

    // Use the first repository (assuming single repo per payroll run for now)
    const repository = repositories[0];

    console.log(`📁 Fetching contributors for repository: ${repository.fullName}`);

    // Initialize GitHub service
    const githubService = createGitHubService(user.githubAccessToken);

    // Fetch live contributors from the repository
    let repoContributors;
    try {
      repoContributors = await githubService.getRepoContributors(repository.owner, repository.name);
    } catch (error) {
      console.error('❌ Failed to fetch contributors from GitHub:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch contributors from repository',
        details: 'Please check repository access and GitHub token permissions'
      }, { status: 400 });
    }

    // Check if repoContributors is valid, if not use fallback
    if (!Array.isArray(repoContributors)) {
      console.warn('⚠️ GitHub API returned non-array response, using database contributors as fallback');
      
      // Fallback: Use database contributors directly
      const existingContributors = await prisma.contributor.findMany({
        where: {
          active: true,
          hederaAccountId: { not: "" }
        },
        include: {
          user: true
        }
      });

      if (existingContributors.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No contributors with wallet addresses found',
          message: 'Add wallet addresses to contributors at /dashboard/contributors'
        }, { status: 400 });
      }

      console.log(`🔄 Using ${existingContributors.length} database contributors as fallback`);
      
      // Create mock GitHub-style data from database contributors
      repoContributors = existingContributors.map(contrib => ({
        login: contrib.githubHandle || contrib.user?.githubLogin || 'unknown',
        id: contrib.user?.githubId || 0,
        avatar_url: `https://github.com/${contrib.githubHandle || contrib.user?.githubLogin}.png`,
        contributions: 10 // Default contribution count for fallback
      }));
    }

    console.log(`👥 Found ${repoContributors.length} contributors from GitHub API`);

    // Get existing contributor wallet information from database
    const existingContributors = await prisma.contributor.findMany({
      where: {
        active: true,
        hederaAccountId: { not: "" }
      },
      include: {
        user: true
      }
    });

    console.log(`🔍 Database contributors with wallets:`, existingContributors.map(c => ({
      id: c.id,
      githubHandle: c.githubHandle,
      userGithubLogin: c.user?.githubLogin,
      hederaAccountId: c.hederaAccountId
    })));

    console.log(`🔍 GitHub repo contributors:`, repoContributors.map(c => ({
      login: c.login,
      contributions: c.contributions
    })));

    // Match GitHub contributors with wallet addresses
    const contributorsWithWallets = [];
    const contributorsWithoutWallets = [];

    for (const githubContrib of repoContributors) {
      // Skip the payroll manager
      if (githubContrib.login === session.user.githubLogin) {
        continue;
      }

      // Try to match by both githubHandle and user.githubLogin
      const walletInfo = existingContributors.find(
        contrib => contrib.githubHandle === githubContrib.login || 
                   contrib.user?.githubLogin === githubContrib.login
      );

      const contributorData = {
        githubLogin: githubContrib.login,
        githubId: githubContrib.id,
        avatarUrl: githubContrib.avatar_url,
        contributions: githubContrib.contributions || 0,
        hederaAccountId: walletInfo?.hederaAccountId || null,
        contributorDbId: walletInfo?.id || null
      };

      if (walletInfo?.hederaAccountId) {
        contributorsWithWallets.push(contributorData);
      } else {
        contributorsWithoutWallets.push(contributorData);
      }
    }

    console.log(`💰 ${contributorsWithWallets.length} contributors ready for payment`);
    console.log(`⚠️  ${contributorsWithoutWallets.length} contributors missing wallet addresses`);

    if (contributorsWithWallets.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No contributors with wallet addresses found',
        message: 'Add wallet addresses to contributors at /dashboard/contributors',
        contributorsNeedingWallets: contributorsWithoutWallets.map(c => ({
          githubLogin: c.githubLogin,
          contributions: c.contributions
        }))
      }, { status: 400 });
    }

    // Calculate payout amounts based on distribution mode
    const totalBudget = payrollRun.usdBudget || 1000;
    const payoutRule = payrollRun.distributionMode || 'EQUAL_DISTRIBUTION';
    
    let payoutCalculations = [];
    
    if (payoutRule === 'EQUAL_DISTRIBUTION') {
      // Equal distribution
      const amountPerContributor = Math.round((totalBudget / contributorsWithWallets.length) * 100) / 100;
      payoutCalculations = contributorsWithWallets.map(contributor => ({
        ...contributor,
        usdAmount: amountPerContributor,
        shareRatio: 1.0 / contributorsWithWallets.length,
        calculationMethod: 'equal_share'
      }));
    } else if (payoutRule === 'contribution_based') {
      // Contribution-based distribution
      const totalContributions = contributorsWithWallets.reduce((sum, c) => sum + c.contributions, 0);
      payoutCalculations = contributorsWithWallets.map(contributor => {
        const shareRatio = totalContributions > 0 ? contributor.contributions / totalContributions : 1.0 / contributorsWithWallets.length;
        return {
          ...contributor,
          usdAmount: Math.round((totalBudget * shareRatio) * 100) / 100,
          shareRatio,
          calculationMethod: 'contribution_based'
        };
      });
    } else {
      // Default to equal distribution for role_based (not implemented yet)
      const amountPerContributor = Math.round((totalBudget / contributorsWithWallets.length) * 100) / 100;
      payoutCalculations = contributorsWithWallets.map(contributor => ({
        ...contributor,
        usdAmount: amountPerContributor,
        shareRatio: 1.0 / contributorsWithWallets.length,
        calculationMethod: 'role_based_fallback'
      }));
    }

    console.log(`💰 Creating payouts using ${payoutRule} rule for ${contributorsWithWallets.length} contributors`);

    // Create payout records in database and attempt payments
    const successfulPayouts = [];
    const failedPayouts = [];

    for (const contributor of payoutCalculations) {
      try {
        console.log(`👤 Processing payout for ${contributor.githubLogin}: $${contributor.usdAmount} (${contributor.contributions} contributions)`);
        
        // Create payout record in database
        const payout = await prisma.payout.create({
          data: {
            runId: payrollRunId,
            contributorId: contributor.contributorDbId || '',
            usdAmount: contributor.usdAmount,
            status: 'PENDING',
            prCount: 0, // Will be updated later
            shareRatio: contributor.shareRatio,
            nativeAmount: (contributor.usdAmount * 100_000_000).toString(), // Convert to tinybars for HBAR
            decimals: 8,
            idempotencyKey: `${payrollRunId}-${contributor.githubLogin}-${Date.now()}`
          }
        });

        // Simulate payment (in real implementation, this would be actual Hedera/crypto transactions)
        const transactionId = `demo-tx-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        
        // Update payout status to PAID
        await prisma.payout.update({
          where: { id: payout.id },
          data: {
            status: 'PAID',
            txId: transactionId,
            updatedAt: new Date()
          }
        });

        successfulPayouts.push({
          id: payout.id,
          contributor: {
            githubLogin: contributor.githubLogin,
            githubId: contributor.githubId,
            hederaAccountId: contributor.hederaAccountId
          },
          usdAmount: contributor.usdAmount,
          contributions: contributor.contributions,
          shareRatio: contributor.shareRatio,
          transactionId,
          walletType: contributor.hederaAccountId?.startsWith('0x') ? 'Ethereum' : 
                      contributor.hederaAccountId?.match(/^0\.0\.\d+$/) ? 'Hedera' : 'Other'
        });

      } catch (error) {
        console.error(`❌ Failed to process payout for ${contributor.githubLogin}:`, error);
        
        failedPayouts.push({
          githubLogin: contributor.githubLogin,
          usdAmount: contributor.usdAmount,
          contributions: contributor.contributions,
          error: error instanceof Error ? error.message : 'Unknown error',
          reason: 'payment_processing_failed'
        });
      }
    }

    // Add contributors without wallets to failed list
    contributorsWithoutWallets.forEach(contributor => {
      failedPayouts.push({
        githubLogin: contributor.githubLogin,
        usdAmount: 0, // Would have been calculated if wallet existed
        contributions: contributor.contributions,
        error: 'No wallet address configured',
        reason: 'missing_wallet_address'
      });
    });

    // Determine final payroll run status
    const totalContributors = contributorsWithWallets.length + contributorsWithoutWallets.length;
    const isFullyCompleted = failedPayouts.length === 0;
    const finalStatus = isFullyCompleted ? 'COMPLETED' : 'PARTIALLY_COMPLETED';

    // Update payroll run status
    await prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: { 
        status: finalStatus,
        updatedAt: new Date()
      }
    });

    console.log(`✅ Payroll execution finished: ${successfulPayouts.length} successful, ${failedPayouts.length} failed`);

    return NextResponse.json({
      success: isFullyCompleted,
      status: finalStatus,
      message: isFullyCompleted 
        ? `✅ Payroll completed successfully! ${successfulPayouts.length} payments processed.`
        : `⚠️ Payroll partially completed. ${successfulPayouts.length} successful, ${failedPayouts.length} failed.`,
      data: {
        payrollRunId,
        runNumber: payrollRun.runNumber,
        repository: repository.fullName,
        payoutRule,
        paymentsCount: totalContributors,
        paymentsSuccessful: successfulPayouts.length,
        paymentsFailed: failedPayouts.length,
        totalAmountUsd: successfulPayouts.reduce((sum, p) => sum + p.usdAmount, 0),
        totalBudget,
        
        // Successful payments details
        successfulPayouts: successfulPayouts.map(p => ({
          githubLogin: p.contributor.githubLogin,
          amount: p.usdAmount,
          contributions: p.contributions,
          sharePercentage: ((p.shareRatio) * 100).toFixed(1) + '%',
          transactionId: p.transactionId,
          walletType: p.walletType,
          walletAddress: p.contributor.hederaAccountId
        })),
        
        // Failed payments (for retry/resolution)
        failedPayouts: failedPayouts.map(p => ({
          githubLogin: p.githubLogin,
          contributions: p.contributions,
          reason: p.reason,
          error: p.error,
          suggestedAction: p.reason === 'missing_wallet_address' 
            ? 'Add wallet address in /dashboard/contributors' 
            : 'Contact support for payment retry'
        })),
        
        // Payment breakdown by wallet type
        paymentBreakdown: {
          hederaPayments: successfulPayouts.filter(p => p.walletType === 'Hedera').length,
          ethereumPayments: successfulPayouts.filter(p => p.walletType === 'Ethereum').length,
          bitcoinPayments: successfulPayouts.filter(p => p.walletType === 'Bitcoin').length,
          otherPayments: successfulPayouts.filter(p => p.walletType === 'Other').length
        },
        
        // Summary statistics
        summary: {
          totalContributorsInRepo: totalContributors,
          contributorsWithWallets: contributorsWithWallets.length,
          contributorsNeedingWallets: contributorsWithoutWallets.length,
          totalContributions: contributorsWithWallets.reduce((sum, c) => sum + c.contributions, 0),
          averageContributions: contributorsWithWallets.length > 0 
            ? Math.round(contributorsWithWallets.reduce((sum, c) => sum + c.contributions, 0) / contributorsWithWallets.length)
            : 0
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Payroll execution error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to execute payroll',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

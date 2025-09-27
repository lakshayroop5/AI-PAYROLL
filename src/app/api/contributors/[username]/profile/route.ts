/**
 * Individual Contributor Profile API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createGitHubService } from '@/lib/github';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { username: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { username } = params;
    console.log('🔍 Fetching profile for:', username);

    // Get user's GitHub access token
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user?.githubAccessToken) {
      return NextResponse.json({ error: 'GitHub access token not found' }, { status: 400 });
    }

    // Initialize GitHub service
    const githubService = createGitHubService(user.githubAccessToken);

    // Get GitHub user details
    const githubUser = await githubService.getUser(username);
    
    // Check if contributor exists in our database
    const existingContributor = await prisma.contributor.findFirst({
      where: { githubHandle: username },
      include: { user: true }
    });

    // Get user's repositories to calculate stats
    const repositories = await prisma.repository.findMany({
      where: {
        managerId: session.user.id,
        active: true
      }
    });

    // Calculate contributor stats across repositories
    let totalCommits = 0;
    let totalPRs = 0;
    const activeRepos: string[] = [];
    const recentActivity: any[] = [];

    for (const repo of repositories) {
      try {
        // Get contributor stats for this repo
        const contributors = await githubService.getRepoContributors(repo.owner, repo.name);
        const contributor = contributors.find(c => c.login === username);
        
        if (contributor) {
          totalCommits += contributor.contributions;
          activeRepos.push(repo.fullName);
        }

        // Get recent PRs
        const recentPRs = await githubService.searchMergedPRs({
          repos: [repo.fullName],
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          endDate: new Date(),
          author: username
        });

        if (recentPRs.has(username)) {
          const stats = recentPRs.get(username);
          totalPRs += stats!.prCount;
          
          // Add recent PR activity
          stats!.prs.forEach((pr: any) => {
            recentActivity.push({
              type: 'pr_merged',
              description: `Merged PR: ${pr.title}`,
              date: new Date(pr.merged_at).toLocaleDateString(),
              url: pr.html_url
            });
          });
        }

      } catch (repoError) {
        console.error(`Error fetching stats for ${repo.fullName}:`, repoError);
      }
    }

    // Get earnings data
    const payouts = existingContributor ? await prisma.payout.findMany({
      where: { contributorId: existingContributor.id },
      orderBy: { createdAt: 'desc' },
      take: 10
    }) : [];

    const totalEarnings = payouts.reduce((sum, payout) => sum + payout.usdAmount, 0);

    const profile = {
      githubLogin: githubUser.login,
      githubId: githubUser.id,
      avatarUrl: githubUser.avatar_url,
      name: githubUser.name,
      email: githubUser.email,
      bio: githubUser.bio,
      location: githubUser.location,
      company: githubUser.company,
      hederaAccountId: existingContributor?.hederaAccountId,
      isRegistered: !!existingContributor,
      stats: {
        totalCommits,
        totalPRs,
        repositories: activeRepos,
        languages: {}, // TODO: Implement language stats
        recentActivity: recentActivity.slice(0, 10) // Latest 10 activities
      },
      earnings: {
        totalUsd: totalEarnings,
        totalPayouts: payouts.length,
        recentPayouts: payouts.map(payout => ({
          amount: payout.usdAmount,
          date: payout.createdAt.toISOString(),
          status: payout.status
        }))
      }
    };

    console.log(`✅ Profile loaded for ${username}: ${totalCommits} commits, ${totalPRs} PRs`);

    return NextResponse.json({
      success: true,
      profile
    });

  } catch (error) {
    console.error('❌ Error fetching contributor profile:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch contributor profile',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

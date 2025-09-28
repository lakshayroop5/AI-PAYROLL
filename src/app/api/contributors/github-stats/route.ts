/**
 * GitHub Contributors Stats API
 * Fetches real contributor data from connected repositories
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createGitHubService } from '@/lib/github';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 Fetching GitHub contributors for user:', session.user.email);

    // Get user's repositories
    const repositories = await prisma.repository.findMany({
      where: {
        managerId: session.user.id,
        active: true
      }
    });

    console.log('📁 Found repositories:', repositories.map(r => r.fullName));

    if (repositories.length === 0) {
      return NextResponse.json({
        success: true,
        contributors: [],
        message: 'No repositories found'
      });
    }

    // Get user's GitHub access token
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user?.githubAccessToken) {
      return NextResponse.json({ error: 'GitHub access token not found' }, { status: 400 });
    }

    // Initialize GitHub service
    const githubService = createGitHubService(user.githubAccessToken);

    // Get all existing contributor records
    const existingContributors = await prisma.contributor.findMany({
      include: { user: true }
    });

    const contributorMap = new Map();
    existingContributors.forEach(contrib => {
      if (contrib.githubHandle) {
        contributorMap.set(contrib.githubHandle, contrib);
      }
    });

    // Collect contributor stats from all repositories
    const allContributors = new Map<string, any>();

    for (const repo of repositories) {
      try {
        console.log(`📊 Fetching contributors and collaborators for ${repo.fullName}...`);
        
        // Get contributors from GitHub API (people who made commits)
        const repoContributors = await githubService.getRepoContributors(repo.owner, repo.name);
        console.log(`Found ${repoContributors.length} contributors for ${repo.fullName}`);
        
        // Get collaborators from GitHub API (includes maintainers, admins)
        const repoCollaborators = await githubService.getRepoCollaborators(repo.owner, repo.name);
        console.log(`Found ${repoCollaborators.length} collaborators for ${repo.fullName}`);
        
        // Combine both lists, prioritizing contributors for commit counts
        const allPeople = new Map<string, any>();
        
        // Add contributors first (they have commit counts)
        for (const contributor of repoContributors) {
          if (contributor.login) {
            allPeople.set(contributor.login, {
              ...contributor,
              type: 'contributor',
              contributions: contributor.contributions || 0
            });
          }
        }
        
        // Add collaborators (might overlap with contributors)
        for (const collaborator of repoCollaborators) {
          if (!allPeople.has(collaborator.login)) {
            allPeople.set(collaborator.login, {
              ...collaborator,
              type: 'collaborator',
              contributions: 0 // Collaborators without commits
            });
          } else {
            // Mark as both contributor and collaborator
            const existing = allPeople.get(collaborator.login);
            existing.type = 'contributor-collaborator';
            existing.permissions = collaborator.permissions;
          }
        }
        
        // Skip the main user (repository owner)
        const currentUser = session.user.githubLogin;
        if (currentUser) {
          allPeople.delete(currentUser);
        }
        
        // Process each person
        for (const [login, person] of allPeople.entries()) {
          if (!allContributors.has(login)) {
            try {
              // Get additional user details
              const userDetails = await githubService.getUser(login);
              
              allContributors.set(login, {
                id: `github-${person.id}`,
                githubLogin: login,
                githubId: person.id,
                avatarUrl: person.avatar_url,
                name: userDetails.name || login,
                email: userDetails.email,
                type: person.type,
                permissions: person.permissions,
                isRegistered: contributorMap.has(login),
                hederaAccountId: contributorMap.get(login)?.hederaAccountId,
                stats: {
                  totalCommits: person.contributions || 0,
                  totalPRs: 0, // Will be calculated below
                  recentActivity: new Date().toISOString().split('T')[0],
                  repositories: [repo.fullName]
                },
                earnings: {
                  totalUsd: 0, // TODO: Calculate from payouts
                  totalPayouts: 0, // TODO: Calculate from payouts
                  lastPayout: null
                }
              });
            } catch (userError) {
              console.error(`❌ Error fetching details for user ${login}:`, userError);
              // Still add them with basic info
              allContributors.set(login, {
                id: `github-${person.id}`,
                githubLogin: login,
                githubId: person.id,
                avatarUrl: person.avatar_url,
                name: login,
                email: null,
                type: person.type,
                isRegistered: contributorMap.has(login),
                hederaAccountId: contributorMap.get(login)?.hederaAccountId,
                stats: {
                  totalCommits: person.contributions || 0,
                  totalPRs: 0,
                  recentActivity: new Date().toISOString().split('T')[0],
                  repositories: [repo.fullName]
                },
                earnings: {
                  totalUsd: 0,
                  totalPayouts: 0,
                  lastPayout: null
                }
              });
            }
          } else {
            // Update existing contributor with this repo
            const existing = allContributors.get(login);
            existing.stats.totalCommits += person.contributions || 0;
            if (!existing.stats.repositories.includes(repo.fullName)) {
              existing.stats.repositories.push(repo.fullName);
            }
          }
        }

        // Get recent PRs to calculate PR counts
        const recentPRs = await githubService.searchMergedPRs({
          repos: [repo.fullName],
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          endDate: new Date()
        });

        // Update PR counts
        for (const [login, stats] of recentPRs.entries()) {
          if (allContributors.has(login)) {
            allContributors.get(login).stats.totalPRs += stats.prCount;
          }
        }

      } catch (repoError) {
        console.error(`❌ Error fetching contributors for ${repo.fullName}:`, repoError);
        // Continue with other repositories
      }
    }

    const contributors = Array.from(allContributors.values());
    
    console.log(`✅ Found ${contributors.length} unique contributors across ${repositories.length} repositories`);

    return NextResponse.json({
      success: true,
      contributors,
      metadata: {
        repositoriesScanned: repositories.length,
        contributorsFound: contributors.length,
        registeredContributors: contributors.filter(c => c.isRegistered).length,
        withWallets: contributors.filter(c => c.hederaAccountId).length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching GitHub contributors:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch GitHub contributors',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

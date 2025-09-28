/**
 * Test Contributors API - Debug Version
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

    console.log('🧪 TEST: Starting contributors debug for user:', session.user.email);

    // Get user's repositories
    const repositories = await prisma.repository.findMany({
      where: {
        managerId: session.user.id,
        active: true
      }
    });

    console.log('🧪 TEST: Found repositories:', repositories.map(r => r.fullName));

    if (repositories.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No repositories found. Please add some repositories first.',
        repositories: [],
        contributors: []
      });
    }

    // Get user's GitHub access token
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user?.githubAccessToken) {
      return NextResponse.json({ error: 'GitHub access token not found. Please reconnect your GitHub account.' }, { status: 400 });
    }

    console.log('🧪 TEST: GitHub token found, length:', user.githubAccessToken.length);

    // Initialize GitHub service
    const githubService = createGitHubService(user.githubAccessToken);

    const results = [];

    // Test each repository
    for (const repo of repositories.slice(0, 1)) { // Test only first repo to avoid rate limits
      try {
        console.log(`🧪 TEST: Testing repository ${repo.fullName}...`);
        
        const repoResult = {
          repository: repo.fullName,
          owner: repo.owner,
          name: repo.name,
          contributors: [],
          collaborators: [],
          error: null
        };

        try {
          // Test contributors
          const contributors = await githubService.getRepoContributors(repo.owner, repo.name);
          repoResult.contributors = contributors.map(c => ({
            login: c.login,
            contributions: c.contributions,
            avatar_url: c.avatar_url
          }));
          console.log(`🧪 TEST: Found ${contributors.length} contributors`);
        } catch (contribError) {
          console.error('🧪 TEST: Contributors error:', contribError);
          repoResult.error = `Contributors: ${contribError instanceof Error ? contribError.message : 'Unknown error'}`;
        }

        try {
          // Test collaborators
          const collaborators = await githubService.getRepoCollaborators(repo.owner, repo.name);
          repoResult.collaborators = collaborators.map(c => ({
            login: c.login,
            permissions: c.permissions,
            avatar_url: c.avatar_url
          }));
          console.log(`🧪 TEST: Found ${collaborators.length} collaborators`);
        } catch (collabError) {
          console.error('🧪 TEST: Collaborators error:', collabError);
          if (!repoResult.error) repoResult.error = '';
          repoResult.error += ` Collaborators: ${collabError instanceof Error ? collabError.message : 'Unknown error'}`;
        }

        results.push(repoResult);

      } catch (repoError) {
        console.error(`🧪 TEST: Repository ${repo.fullName} error:`, repoError);
        results.push({
          repository: repo.fullName,
          error: repoError instanceof Error ? repoError.message : 'Unknown error',
          contributors: [],
          collaborators: []
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Contributors test completed',
      user: {
        id: session.user.id,
        email: session.user.email,
        githubLogin: session.user.githubLogin
      },
      repositories: repositories.map(r => ({
        id: r.id,
        fullName: r.fullName,
        owner: r.owner,
        name: r.name,
        active: r.active
      })),
      results
    });

  } catch (error) {
    console.error('🧪 TEST: Error in contributors test:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Contributors test failed',
      details: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, { status: 500 });
  }
}

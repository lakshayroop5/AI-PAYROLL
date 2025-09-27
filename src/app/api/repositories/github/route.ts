/**
 * API route for fetching GitHub repositories for repository selection
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, verifyUserAccess } from '@/lib/auth';
import { createGitHubService } from '@/lib/github';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has manager role and Self verification
    const access = await verifyUserAccess(session.user.id, 'manager', true);
    if (!access.authorized) {
      return NextResponse.json({ error: access.reason }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { managedRepos: true }
    });

    if (!user?.githubAccessToken) {
      return NextResponse.json({ error: 'GitHub access token not found' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const per_page = parseInt(searchParams.get('per_page') || '30');

    // Get repositories from GitHub
    const githubService = createGitHubService(user.githubAccessToken);
    let githubRepos;

    if (search) {
      // Search repositories
      githubRepos = await githubService.searchUserRepos(search, {
        page,
        per_page,
        sort: 'updated',
        order: 'desc'
      });
    } else {
      // Get all user repositories (personal + organization) with admin/maintain permissions
      githubRepos = await githubService.getAllAdminRepos({
        page,
        per_page,
        sort: 'updated'
      });
    }

    // Note: getAllAdminRepos already filters for admin/maintain permissions
    // For search results, we still need to filter
    const adminRepos = search 
      ? githubRepos.filter((repo: any) => 
          repo.permissions && (repo.permissions.admin || repo.permissions.maintain)
        )
      : githubRepos;

    // Get already stored repository full names for filtering
    const storedRepoNames = user.managedRepos.map(repo => repo.fullName);

    // Format response
    const formattedRepos = adminRepos.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      description: repo.description,
      private: repo.private,
      fork: repo.fork,
      language: repo.language,
      stargazers_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      updated_at: repo.updated_at,
      html_url: repo.html_url,
      permissions: repo.permissions,
      isAlreadyAdded: storedRepoNames.includes(repo.full_name),
      isOrganization: repo.owner.type === 'Organization'
    }));

    return NextResponse.json({
      repositories: formattedRepos,
      total: formattedRepos.length,
      page,
      per_page,
      has_next: formattedRepos.length === per_page
    });
  } catch (error) {
    console.error('Error fetching GitHub repositories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GitHub repositories' },
      { status: 500 }
    );
  }
}

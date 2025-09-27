/**
 * API route for repository management
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, verifyUserAccess, createAuditLog } from '@/lib/auth';
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

    // Get repositories from GitHub
    const githubService = createGitHubService(user.githubAccessToken);
    const githubRepos = await githubService.getUserRepos();

    // Filter repositories where user has admin/maintain permissions
    const adminRepos = githubRepos.filter(repo => 
      repo.permissions && (repo.permissions.admin || repo.permissions.maintain)
    );

    // Get stored repositories
    const storedRepos = user.managedRepos;

    return NextResponse.json({
      githubRepos: adminRepos.map(repo => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        permissions: repo.permissions,
        private: repo.private,
        isStored: storedRepos.some(stored => stored.fullName === repo.full_name)
      })),
      storedRepos: storedRepos.map(repo => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.fullName,
        owner: repo.owner,
        active: repo.active,
        defaultBudgetUsd: repo.defaultBudgetUsd,
        defaultAsset: repo.defaultAsset,
        includeLabels: JSON.parse(repo.includeLabels || "[]"),
        excludeLabels: JSON.parse(repo.excludeLabels || "[]"),
        createdAt: repo.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching repositories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repositories' },
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

    // Verify user has manager role and Self verification
    const access = await verifyUserAccess(session.user.id, 'manager', true);
    if (!access.authorized) {
      return NextResponse.json({ error: access.reason }, { status: 403 });
    }

    const body = await request.json();
    const { fullName, defaultBudgetUsd, defaultAsset, includeLabels, excludeLabels } = body;

    if (!fullName) {
      return NextResponse.json({ error: 'Repository full name is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user?.githubAccessToken) {
      return NextResponse.json({ error: 'GitHub access token not found' }, { status: 400 });
    }

    // Verify repository access on GitHub
    const [owner, name] = fullName.split('/');
    const githubService = createGitHubService(user.githubAccessToken);
    
    try {
      const repo = await githubService.getRepo(owner, name);
      
      if (!repo.permissions || (!repo.permissions.admin && !repo.permissions.maintain)) {
        return NextResponse.json({ error: 'Insufficient permissions for repository' }, { status: 403 });
      }

      // Store repository in database
      const storedRepo = await prisma.repository.create({
        data: {
          owner,
          name,
          fullName,
          managerId: session.user.id,
          permissions: JSON.stringify(repo.permissions),
          includeLabels: JSON.stringify(includeLabels || []),
          excludeLabels: JSON.stringify(excludeLabels || []),
          defaultBudgetUsd,
          defaultAsset,
          active: true
        }
      });

      await createAuditLog(
        session.user.id,
        'REPOSITORY_ADDED',
        storedRepo.id,
        { fullName, defaultBudgetUsd, defaultAsset }
      );

      return NextResponse.json({
        success: true,
        repository: {
          id: storedRepo.id,
          name: storedRepo.name,
          fullName: storedRepo.fullName,
          owner: storedRepo.owner,
          active: storedRepo.active,
          defaultBudgetUsd: storedRepo.defaultBudgetUsd,
          defaultAsset: storedRepo.defaultAsset,
          createdAt: storedRepo.createdAt
        }
      });
    } catch (githubError) {
      return NextResponse.json({ error: 'Repository not found or access denied' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error adding repository:', error);
    return NextResponse.json(
      { error: 'Failed to add repository' },
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

    const access = await verifyUserAccess(session.user.id, 'manager', true);
    if (!access.authorized) {
      return NextResponse.json({ error: access.reason }, { status: 403 });
    }

    const body = await request.json();
    const { id, defaultBudgetUsd, defaultAsset, includeLabels, excludeLabels, active } = body;

    if (!id) {
      return NextResponse.json({ error: 'Repository ID is required' }, { status: 400 });
    }

    // Verify user owns this repository
    const repository = await prisma.repository.findFirst({
      where: {
        id,
        managerId: session.user.id
      }
    });

    if (!repository) {
      return NextResponse.json({ error: 'Repository not found or access denied' }, { status: 404 });
    }

    // Update repository
    const updatedRepo = await prisma.repository.update({
      where: { id },
      data: {
        defaultBudgetUsd,
        defaultAsset,
        includeLabels: includeLabels ? JSON.stringify(includeLabels) : repository.includeLabels,
        excludeLabels: excludeLabels ? JSON.stringify(excludeLabels) : repository.excludeLabels,
        active: active !== undefined ? active : repository.active,
        updatedAt: new Date()
      }
    });

    await createAuditLog(
      session.user.id,
      'REPOSITORY_UPDATED',
      id,
      { defaultBudgetUsd, defaultAsset, active }
    );

    return NextResponse.json({
      success: true,
      repository: {
        id: updatedRepo.id,
        name: updatedRepo.name,
        fullName: updatedRepo.fullName,
        owner: updatedRepo.owner,
        active: updatedRepo.active,
        defaultBudgetUsd: updatedRepo.defaultBudgetUsd,
        defaultAsset: updatedRepo.defaultAsset,
        includeLabels: JSON.parse(updatedRepo.includeLabels || "[]"),
        excludeLabels: JSON.parse(updatedRepo.excludeLabels || "[]"),
        updatedAt: updatedRepo.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating repository:', error);
    return NextResponse.json(
      { error: 'Failed to update repository' },
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

    const access = await verifyUserAccess(session.user.id, 'manager', true);
    if (!access.authorized) {
      return NextResponse.json({ error: access.reason }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Repository ID is required' }, { status: 400 });
    }

    // Verify user owns this repository
    const repository = await prisma.repository.findFirst({
      where: {
        id,
        managerId: session.user.id
      }
    });

    if (!repository) {
      return NextResponse.json({ error: 'Repository not found or access denied' }, { status: 404 });
    }

    // Check if repository is used in any active runs
    const activeRuns = await prisma.payrollRun.count({
      where: {
        repoIds: {
          has: id
        },
        status: {
          in: ['PENDING', 'EXECUTING']
        }
      }
    });

    if (activeRuns > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete repository with active payroll runs' 
      }, { status: 400 });
    }

    // Delete repository
    await prisma.repository.delete({
      where: { id }
    });

    await createAuditLog(
      session.user.id,
      'REPOSITORY_DELETED',
      id,
      { fullName: repository.fullName }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting repository:', error);
    return NextResponse.json(
      { error: 'Failed to delete repository' },
      { status: 500 }
    );
  }
}
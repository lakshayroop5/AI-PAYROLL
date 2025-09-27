/**
 * Debug Repositories API - Check repository data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`🔍 Debug: Current user is ${session.user.email} (${session.user.id})`);

    // Get user with repositories
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { 
        managedRepos: true 
      }
    });

    // Get all repositories in database
    const allRepos = await prisma.repository.findMany();
    
    // Get repositories for this specific user
    const userSpecificRepos = await prisma.repository.findMany({
      where: { managerId: session.user.id }
    });

    return NextResponse.json({
      success: true,
      currentUser: {
        email: session.user.email,
        id: session.user.id,
        hasGithubToken: !!user?.githubAccessToken
      },
      debug: {
        userRepositoriesViaRelation: user?.managedRepos?.length || 0,
        userRepositoriesViaQuery: userSpecificRepos.length,
        totalRepositoriesInDb: allRepos.length,
        activeRepositoriesViaRelation: user?.managedRepos?.filter(r => r.active).length || 0,
        activeRepositoriesViaQuery: userSpecificRepos.filter(r => r.active).length
      },
      data: {
        userRepositoriesViaRelation: user?.managedRepos || [],
        userRepositoriesViaQuery: userSpecificRepos,
        allRepositories: allRepos.map(repo => ({
          id: repo.id,
          fullName: repo.fullName,
          owner: repo.owner,
          managerId: repo.managerId,
          active: repo.active
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error in debug repositories:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch debug data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

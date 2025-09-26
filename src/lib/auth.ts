/**
 * NextAuth configuration for GitHub OAuth and Self verification
 */

import { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import GitHubProvider from 'next-auth/providers/github';
import { prisma } from './db';
import { selfIdentityService } from './self-identity';

export const authOptions: NextAuthOptions = {
  // JWT sessions + manual database user management for best of both worlds
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'read:user user:email repo',
        },
      },
      httpOptions: {
        timeout: 40000,
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile, user }) {
      // Store user ID in JWT token when first signing in
      if (account && profile) {
        token.githubId = (profile as any).id;
        token.githubLogin = (profile as any).login;
        token.accessToken = account.access_token;
        
        // Store the database user ID in the token
        if (user?.id) {
          token.userId = user.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Use the user ID from JWT to fetch fresh data from database
      if (session.user && token.userId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.userId as string },
          include: {
            contributorProfile: true,
          },
        });

        if (dbUser) {
          session.user.id = dbUser.id;
          session.user.githubId = dbUser.githubId || undefined;
          session.user.githubLogin = dbUser.githubLogin || undefined;
          
          // Parse roles from JSON string
          let roles: string[] = [];
          try {
            roles = dbUser.roles ? JSON.parse(dbUser.roles) : [];
          } catch {
            roles = [];
          }
          session.user.roles = roles;
          
          session.user.selfVerified = dbUser.selfVerificationStatus || false;
          session.user.isContributor = !!dbUser.contributorProfile;
        } else {
          // Fallback to JWT data if user not found in DB
          session.user.id = token.userId as string;
          session.user.githubId = token.githubId as string;
          session.user.githubLogin = token.githubLogin as string;
          session.user.roles = [];
          session.user.selfVerified = false;
          session.user.isContributor = false;
        }
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // Create or update user in database when signing in
      if (account?.provider === 'github' && profile) {
        try {
          const githubId = (profile as any).id?.toString();
          const githubLogin = (profile as any).login;
          const email = profile.email || user.email;

          if (email) {
            // Try to find existing user by email or GitHub ID
            let existingUser = await prisma.user.findFirst({
              where: {
                OR: [
                  { email: email },
                  { githubId: githubId },
                  { githubLogin: githubLogin }
                ]
              }
            });

            if (!existingUser) {
              // Create new user
              existingUser = await prisma.user.create({
                data: {
                  email: email,
                  githubId: githubId,
                  githubLogin: githubLogin,
                  githubAccessToken: account.access_token,
                  roles: JSON.stringify([]), // Start with no roles
                }
              });
            } else {
              // Update existing user with latest GitHub info
              await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                  githubId: githubId,
                  githubLogin: githubLogin,
                  githubAccessToken: account.access_token,
                }
              });
            }

            // Update the user object with database ID for JWT callback
            user.id = existingUser.id;
          }
        } catch (error) {
          console.error('Error creating/updating user in database:', error);
          // Still allow sign in even if database operation fails
        }
      }
      return true;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};

/**
 * Extended session type with additional fields
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string;
      image?: string;
      roles: string[];
      selfVerified: boolean;
      githubId?: string;
      githubLogin?: string;
      isContributor: boolean;
    };
  }
}

/**
 * Check if user has required role
 */
export function hasRole(user: any, role: string): boolean {
  return user?.roles?.includes(role) || false;
}

/**
 * Check if user is verified with Self
 */
export function isSelfVerified(user: any): boolean {
  return user?.selfVerified === true;
}

/**
 * Require both Self verification and role
 */
export function requireVerifiedRole(user: any, role: string): boolean {
  return isSelfVerified(user) && hasRole(user, role);
}

/**
 * Middleware to check authentication and authorization
 */
export function createAuthMiddleware(requiredRole?: string, requireSelfVerification = true) {
  return async (req: Request) => {
    // This would be implemented as Next.js middleware
    // For now, return a placeholder
    return { authorized: false, reason: 'Not implemented' };
  };
}

/**
 * Server-side user verification
 */
export async function verifyUserAccess(
  userId: string,
  requiredRole?: string,
  requireSelfVerification = true
): Promise<{ authorized: boolean; reason?: string }> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { authorized: false, reason: 'User not found' };
    }

    if (requireSelfVerification && !user.selfVerificationStatus) {
      return { authorized: false, reason: 'Self verification required' };
    }

    if (requiredRole) {
      let roles: string[] = [];
      try {
        roles = user.roles ? JSON.parse(user.roles) : [];
      } catch {
        roles = [];
      }
      
      if (!roles.includes(requiredRole)) {
        return { authorized: false, reason: `Role '${requiredRole}' required` };
      }
    }

    return { authorized: true };
  } catch (error) {
    console.error('Error verifying user access:', error);
    return { authorized: false, reason: 'Verification error' };
  }
}

/**
 * Add role to user
 */
export async function addUserRole(userId: string, role: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return false;
    }

    let roles: string[] = [];
    try {
      roles = user.roles ? JSON.parse(user.roles) : [];
    } catch {
      roles = [];
    }

    if (roles.includes(role)) {
      return true; // Already has role
    }

    roles.push(role);

    await prisma.user.update({
      where: { id: userId },
      data: {
        roles: JSON.stringify(roles),
      },
    });

    return true;
  } catch (error) {
    console.error('Error adding user role:', error);
    return false;
  }
}

/**
 * Remove role from user
 */
export async function removeUserRole(userId: string, role: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return false;
    }

    let roles: string[] = [];
    try {
      roles = user.roles ? JSON.parse(user.roles) : [];
    } catch {
      roles = [];
    }

    const filteredRoles = roles.filter(r => r !== role);

    await prisma.user.update({
      where: { id: userId },
      data: {
        roles: JSON.stringify(filteredRoles),
      },
    });

    return true;
  } catch (error) {
    console.error('Error removing user role:', error);
    return false;
  }
}

/**
 * Complete Self verification for user
 */
export async function completeSelfVerification(
  userId: string,
  verificationResult: any
): Promise<boolean> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        selfVerificationStatus: true,
        selfVerificationId: verificationResult.identityId,
        selfVerifiedAt: verificationResult.verifiedAt,
      },
    });

    // Log verification event
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'SELF_VERIFICATION_COMPLETED',
        details: JSON.stringify({
          identityId: verificationResult.identityId,
          verifiedAt: verificationResult.verifiedAt,
        }),
      },
    });

    return true;
  } catch (error) {
    console.error('Error completing Self verification:', error);
    return false;
  }
}

/**
 * Get user with verification status
 */
export async function getUserWithVerification(userId: string) {
  return await prisma.user.findUnique({
    where: { id: userId },
    include: {
      contributorProfile: true,
    },
  });
}

/**
 * Check repository access for user
 */
export async function checkRepositoryAccess(
  userId: string,
  repoFullName: string
): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        managedRepos: true,
      },
    });

    if (!user) {
      return false;
    }

    // Check if user manages this repository
    const hasAccess = user.managedRepos.some(repo => repo.fullName === repoFullName);
    
    return hasAccess;
  } catch (error) {
    console.error('Error checking repository access:', error);
    return false;
  }
}

/**
 * Audit log helper
 */
export async function createAuditLog(
  userId: string,
  action: string,
  resource?: string,
  details?: any,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        resource,
        details: details ? JSON.stringify(details) : '',
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error('Error creating audit log:', error);
  }
}
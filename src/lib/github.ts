/**
 * GitHub Integration Service
 * Handles OAuth authentication, repository management, and PR data collection
 */

import { Octokit } from '@octokit/rest';

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    id: number;
  };
  permissions?: {
    admin: boolean;
    maintain: boolean;
    push: boolean;
    triage: boolean;
    pull: boolean;
  };
  private: boolean;
  created_at: string;
  updated_at: string;
  description?: string | null;
  fork: boolean;
  language?: string | null;
  stargazers_count: number;
  forks_count: number;
  html_url: string;
}

export interface GitHubPR {
  id: number;
  number: number;
  title: string;
  user: {
    login: string;
    id: number;
  };
  state: 'open' | 'closed';
  merged_at: string | null;
  created_at: string;
  updated_at: string;
  labels: Array<{
    name: string;
    color: string;
  }>;
  additions: number;
  deletions: number;
  changed_files: number;
  commits: number;
}

export interface PRSearchParams {
  repos: string[]; // Array of "owner/name"
  startDate: Date;
  endDate: Date;
  includeLabels?: string[];
  excludeLabels?: string[];
  requireVerifiedCommits?: boolean;
}

export interface ContributorStats {
  login: string;
  id: number;
  prCount: number;
  totalAdditions: number;
  totalDeletions: number;
  totalChangedFiles: number;
  prs: GitHubPR[];
}

export class GitHubService {
  private octokit: Octokit;
  private rateLimitDelay = 1000; // 1 second between requests

  constructor(accessToken?: string) {
    this.octokit = new Octokit({
      auth: accessToken,
      userAgent: 'AI-Payroll-System/1.0.0',
    });
  }

  /**
   * Get authenticated user information
   */
  async getAuthenticatedUser() {
    try {
      const { data } = await this.octokit.rest.users.getAuthenticated();
      return data;
    } catch (error) {
      throw new Error(`Failed to get authenticated user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get repositories accessible to the authenticated user
   */
  async getUserRepos(options: {
    page?: number;
    per_page?: number;
    sort?: 'created' | 'updated' | 'pushed' | 'full_name';
    type?: 'all' | 'owner' | 'public' | 'private' | 'member';
  } = {}): Promise<GitHubRepo[]> {
    try {
      await this.respectRateLimit();
      
      // GitHub API: Cannot use both visibility/affiliation AND type parameters
      const requestParams: any = {
        sort: options.sort || 'updated',
        per_page: options.per_page || 100,
        page: options.page || 1,
      };

      // Use either type OR visibility/affiliation, not both
      if (options.type && options.type !== 'all') {
        requestParams.type = options.type;
      } else {
        requestParams.visibility = 'all';
        requestParams.affiliation = 'owner,collaborator,organization_member';
      }

      console.log('🔄 Fetching repositories from GitHub API...');
      
      // Add timeout wrapper
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('GitHub API request timeout (20s)')), 20000);
      });

      const apiPromise = this.octokit.rest.repos.listForAuthenticatedUser(requestParams);
      
      const { data } = await Promise.race([apiPromise, timeoutPromise]) as any;

      console.log(`✅ Successfully fetched ${data.length} repositories`);
      return data as GitHubRepo[];
    } catch (error) {
      console.error('❌ GitHub API Error:', error);
      
      // Check if it's a network/timeout error
      if (error instanceof Error && (
        error.message.includes('timeout') || 
        error.message.includes('ECONNRESET') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('Connect Timeout') ||
        error.message.includes('ENOTFOUND')
      )) {
        throw new Error(`GitHub API is currently unavailable. Please check your internet connection and try again later. (${error.message})`);
      }
      
      throw new Error(`Failed to fetch repositories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get organization repositories where user has admin/maintain permissions
   */
  async getOrganizationRepos(options: {
    page?: number;
    per_page?: number;
    sort?: 'created' | 'updated' | 'pushed' | 'full_name';
  } = {}): Promise<GitHubRepo[]> {
    try {
      await this.respectRateLimit();
      
      // Get user's organizations
      const { data: orgs } = await this.octokit.rest.orgs.listForAuthenticatedUser({
        per_page: 100
      });

      const orgRepos: GitHubRepo[] = [];

      // For each organization, get repositories where user has admin/maintain permissions
      for (const org of orgs) {
        try {
          await this.respectRateLimit();
          
          const { data: repos } = await this.octokit.rest.repos.listForOrg({
            org: org.login,
            sort: options.sort || 'updated',
            per_page: options.per_page || 100,
            page: options.page || 1,
          });

          // Filter repos where user has admin/maintain permissions
          const adminRepos = repos.filter((repo: any) => 
            repo.permissions && (repo.permissions.admin || repo.permissions.maintain)
          );

          orgRepos.push(...adminRepos as GitHubRepo[]);
        } catch (orgError) {
          // Skip organizations where we can't access repos
          console.warn(`Could not access repos for org ${org.login}:`, orgError);
        }
      }

      return orgRepos;
    } catch (error) {
      throw new Error(`Failed to fetch organization repositories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all repositories (personal + organization) where user has admin/maintain permissions
   */
  async getAllAdminRepos(options: {
    page?: number;
    per_page?: number;
    sort?: 'created' | 'updated' | 'pushed' | 'full_name';
  } = {}): Promise<GitHubRepo[]> {
    try {
      // Get personal and collaborative repositories
      const personalRepos = await this.getUserRepos(options);
      
      // Get organization repositories
      const orgRepos = await this.getOrganizationRepos(options);
      
      // Combine and deduplicate
      const allRepos = [...personalRepos, ...orgRepos];
      const uniqueRepos = allRepos.filter((repo, index, arr) => 
        index === arr.findIndex(r => r.id === repo.id)
      );
      
      // Filter only admin/maintain permissions
      return uniqueRepos.filter(repo => 
        repo.permissions && (repo.permissions.admin || repo.permissions.maintain)
      );
    } catch (error) {
      throw new Error(`Failed to fetch all admin repositories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search repositories for the authenticated user
   */
  async searchUserRepos(query: string, options: {
    page?: number;
    per_page?: number;
    sort?: 'stars' | 'forks' | 'help-wanted-issues' | 'updated';
    order?: 'asc' | 'desc';
  } = {}): Promise<GitHubRepo[]> {
    try {
      await this.respectRateLimit();
      
      // First get the authenticated user to build search query
      const user = await this.getAuthenticatedUser();
      const searchQuery = `${query} user:${user.login}`;
      
      const { data } = await this.octokit.rest.search.repos({
        q: searchQuery,
        sort: options.sort || 'updated',
        order: options.order || 'desc',
        per_page: options.per_page || 30,
        page: options.page || 1,
      });

      return data.items as GitHubRepo[];
    } catch (error) {
      throw new Error(`Failed to search repositories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get repository information and verify permissions
   */
  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    try {
      await this.respectRateLimit();
      
      const { data } = await this.octokit.rest.repos.get({
        owner,
        repo,
      });

      return data as GitHubRepo;
    } catch (error) {
      throw new Error(`Failed to fetch repository ${owner}/${repo}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for merged PRs in specified repositories within date range
   */
  async searchMergedPRs(params: PRSearchParams): Promise<Map<string, ContributorStats>> {
    const contributorStats = new Map<string, ContributorStats>();

    for (const repoFullName of params.repos) {
      const [owner, repo] = repoFullName.split('/');
      
      try {
        await this.respectRateLimit();
        
        // Build search query
        const query = this.buildPRSearchQuery(owner, repo, params);
        
        // Search for PRs using GitHub Search API
        const searchResults = await this.searchPRsWithPagination(query);
        
        // Process each PR to get detailed information
        for (const pr of searchResults) {
          const prDetails = await this.getPRDetails(owner, repo, pr.number);
          
          if (this.shouldIncludePR(prDetails, params)) {
            this.updateContributorStats(contributorStats, prDetails);
          }
          
          // Small delay to respect rate limits
          await this.delay(100);
        }
        
      } catch (error) {
        console.error(`Error processing repository ${repoFullName}:`, error);
        // Continue with other repositories
      }
    }

    return contributorStats;
  }

  /**
   * Get detailed PR information including commit data
   */
  async getPRDetails(owner: string, repo: string, prNumber: number): Promise<GitHubPR> {
    try {
      await this.respectRateLimit();
      
      const { data } = await this.octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });

      return data as GitHubPR;
    } catch (error) {
      throw new Error(`Failed to get PR details for ${owner}/${repo}#${prNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if commits in a PR are verified
   */
  async checkCommitVerification(owner: string, repo: string, prNumber: number): Promise<boolean> {
    try {
      await this.respectRateLimit();
      
      const { data: commits } = await this.octokit.rest.pulls.listCommits({
        owner,
        repo,
        pull_number: prNumber,
      });

      // Check if all commits are verified
      for (const commit of commits) {
        if (!commit.commit.verification?.verified) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error(`Error checking commit verification for ${owner}/${repo}#${prNumber}:`, error);
      return false;
    }
  }

  /**
   * Build GitHub search query for PRs
   */
  private buildPRSearchQuery(owner: string, repo: string, params: PRSearchParams): string {
    const startDate = params.startDate.toISOString().split('T')[0];
    const endDate = params.endDate.toISOString().split('T')[0];
    
    let query = `repo:${owner}/${repo} is:pr is:merged merged:${startDate}..${endDate}`;
    
    if (params.includeLabels && params.includeLabels.length > 0) {
      query += ` ${params.includeLabels.map(label => `label:"${label}"`).join(' ')}`;
    }
    
    return query;
  }

  /**
   * Search PRs with pagination support
   */
  private async searchPRsWithPagination(query: string): Promise<any[]> {
    const results: any[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      try {
        await this.respectRateLimit();
        
        const { data } = await this.octokit.rest.search.issuesAndPullRequests({
          q: query,
          sort: 'updated',
          order: 'desc',
          per_page: perPage,
          page,
        });

        results.push(...data.items);

        if (data.items.length < perPage) {
          break; // No more pages
        }

        page++;
      } catch (error) {
        console.error(`Error in search pagination (page ${page}):`, error);
        break;
      }
    }

    return results;
  }

  /**
   * Check if PR should be included based on filters
   */
  private shouldIncludePR(pr: GitHubPR, params: PRSearchParams): boolean {
    // Check exclude labels
    if (params.excludeLabels && params.excludeLabels.length > 0) {
      const prLabels = pr.labels.map(label => label.name.toLowerCase());
      const hasExcludeLabel = params.excludeLabels.some(
        excludeLabel => prLabels.includes(excludeLabel.toLowerCase())
      );
      if (hasExcludeLabel) {
        return false;
      }
    }

    // Check if PR is actually merged
    return pr.merged_at !== null;
  }

  /**
   * Update contributor statistics
   */
  private updateContributorStats(
    contributorStats: Map<string, ContributorStats>,
    pr: GitHubPR
  ): void {
    const login = pr.user.login;
    
    if (!contributorStats.has(login)) {
      contributorStats.set(login, {
        login,
        id: pr.user.id,
        prCount: 0,
        totalAdditions: 0,
        totalDeletions: 0,
        totalChangedFiles: 0,
        prs: [],
      });
    }

    const stats = contributorStats.get(login)!;
    stats.prCount++;
    stats.totalAdditions += pr.additions || 0;
    stats.totalDeletions += pr.deletions || 0;
    stats.totalChangedFiles += pr.changed_files || 0;
    stats.prs.push(pr);
  }

  /**
   * Respect GitHub rate limits
   */
  private async respectRateLimit(): Promise<void> {
    try {
      const { data } = await this.octokit.rest.rateLimit.get();
      const remaining = data.rate.remaining;
      const resetTime = new Date(data.rate.reset * 1000);
      
      if (remaining < 10) {
        const waitTime = resetTime.getTime() - Date.now() + 1000; // Add 1 second buffer
        if (waitTime > 0) {
          console.log(`Rate limit approaching, waiting ${waitTime}ms`);
          await this.delay(waitTime);
        }
      }
    } catch (error) {
      // If we can't check rate limit, use conservative delay
      await this.delay(this.rateLimitDelay);
    }
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get repository contributors
   */
  async getRepoContributors(owner: string, repo: string) {
    try {
      await this.respectRateLimit();
      
      console.log(`📊 Fetching contributors for ${owner}/${repo}...`);
      
      const { data } = await this.octokit.rest.repos.listContributors({
        owner,
        repo,
        per_page: 100
      });

      console.log(`✅ Found ${data.length} contributors for ${owner}/${repo}`);
      return data;
    } catch (error) {
      console.error(`❌ Failed to get contributors for ${owner}/${repo}:`, error);
      throw new Error(`Failed to get repository contributors: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get repository collaborators (includes maintainers)
   */
  async getRepoCollaborators(owner: string, repo: string) {
    try {
      await this.respectRateLimit();
      
      console.log(`👥 Fetching collaborators for ${owner}/${repo}...`);
      
      const { data } = await this.octokit.rest.repos.listCollaborators({
        owner,
        repo,
        per_page: 100
      });

      console.log(`✅ Found ${data.length} collaborators for ${owner}/${repo}`);
      return data;
    } catch (error) {
      console.error(`❌ Failed to get collaborators for ${owner}/${repo}:`, error);
      // Don't throw error for collaborators as it might be private repo
      return [];
    }
  }

  /**
   * Get user details
   */
  async getUser(username: string) {
    try {
      await this.respectRateLimit();
      
      const { data } = await this.octokit.rest.users.getByUsername({
        username
      });

      return data;
    } catch (error) {
      console.error(`Failed to get user ${username}:`, error);
      throw new Error(`Failed to get user details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current rate limit status
   */
  async getRateLimitStatus() {
    try {
      const { data } = await this.octokit.rest.rateLimit.get();
      return data.rate;
    } catch (error) {
      throw new Error(`Failed to get rate limit status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export function createGitHubService(accessToken?: string): GitHubService {
  return new GitHubService(accessToken);
}
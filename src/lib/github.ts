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
  permissions: {
    admin: boolean;
    maintain: boolean;
    push: boolean;
    triage: boolean;
    pull: boolean;
  };
  private: boolean;
  created_at: string;
  updated_at: string;
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
  async getUserRepos(page = 1, perPage = 100): Promise<GitHubRepo[]> {
    try {
      await this.respectRateLimit();
      
      const { data } = await this.octokit.rest.repos.listForAuthenticatedUser({
        visibility: 'all',
        affiliation: 'owner,collaborator,organization_member',
        sort: 'updated',
        per_page: perPage,
        page,
      });

      return data as GitHubRepo[];
    } catch (error) {
      throw new Error(`Failed to fetch repositories: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
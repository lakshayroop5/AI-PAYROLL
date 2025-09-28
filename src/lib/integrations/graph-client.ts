/**
 * The Graph Protocol Client for GitHub Repository Data
 * Handles subgraph deployment and data fetching
 */

// Using fetch for GraphQL requests instead of graphql-request
// import { GraphQLClient } from 'graphql-request';
import { createAuditLog } from '@/lib/auth';

export interface SubgraphConfig {
  repositoryId: string;
  owner: string;
  name: string;
  githubToken?: string;
  indexingStartBlock?: string;
}

export interface GitHubRepoData {
  contributors: Array<{
    githubLogin: string;
    githubId: string;
    contributionCount: number;
    firstContribution: string;
    lastContribution: string;
    organizationData?: {
      name: string;
      email?: string;
      company?: string;
    };
  }>;
  pullRequests: Array<{
    number: number;
    author: string;
    mergedAt: string;
    title: string;
    additions: number;
    deletions: number;
    changedFiles: number;
    labels: string[];
  }>;
  repository: {
    stars: number;
    forks: number;
    clones: number;
    views: number;
    issues: number;
    releases: number;
  };
  corporateSignals: Array<{
    type: 'clone_spike' | 'api_usage' | 'enterprise_domain' | 'org_member';
    githubLogin?: string;
    organizationName?: string;
    confidence: number;
    detectedAt: string;
    metadata: Record<string, any>;
  }>;
}

export class GraphClient {
  private subgraphUrl: string;
  private headers: Record<string, string>;

  constructor(subgraphUrl?: string) {
    this.subgraphUrl = subgraphUrl || process.env.GITHUB_SUBGRAPH_URL || 'https://api.thegraph.com/subgraphs/name/github-analytics';
    this.headers = {
      'Authorization': `Bearer ${process.env.GRAPH_API_KEY || ''}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Deploy or configure subgraph for a repository
   */
  async deploySubgraph(config: SubgraphConfig): Promise<string> {
    try {
      console.log(`Deploying subgraph for ${config.owner}/${config.name}`);
      
      // In a real implementation, this would:
      // 1. Generate subgraph.yaml from template
      // 2. Deploy to The Graph Network or Studio
      // 3. Return the subgraph URL
      
      // For now, we'll simulate the deployment
      const subgraphName = `${config.owner}-${config.name}-analytics`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const deployedUrl = `https://api.thegraph.com/subgraphs/name/${config.owner}/${subgraphName}`;
      
      // Store subgraph URL in agent metadata
      await this.updateAgentSubgraphUrl(config.repositoryId, deployedUrl);
      
      console.log(`Subgraph deployed: ${deployedUrl}`);
      return deployedUrl;
    } catch (error) {
      console.error('Error deploying subgraph:', error);
      throw new Error(`Failed to deploy subgraph: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch comprehensive repository data from subgraph
   */
  async fetchRepositoryData(owner: string, name: string, fromDate?: Date): Promise<GitHubRepoData> {
    const query = `
      query GetRepositoryData($owner: String!, $name: String!, $fromDate: String) {
        repository(owner: $owner, name: $name) {
          id
          name
          owner
          stars: stargazerCount
          forks: forkCount
          issues: openIssueCount
          releases: releaseCount
          
          pullRequests(first: 100, merged: true, updatedAfter: $fromDate) {
            nodes {
              number
              title
              mergedAt
              additions
              deletions
              changedFiles
              labels(first: 10) {
                nodes {
                  name
                }
              }
              author {
                login
                ... on User {
                  id
                  email
                  company
                  organizationVerifiedDomainEmails
                }
              }
            }
          }
          
          contributors: collaborators(first: 100) {
            nodes {
              login
              id
              email
              company
              contributionsCollection {
                totalCommitContributions
                totalPullRequestContributions
                contributionCalendar {
                  totalContributions
                }
              }
            }
          }
          
          cloneTraffic: clones(last: 14) {
            totalCount
            nodes {
              timestamp
              count
              uniques
            }
          }
          
          viewTraffic: views(last: 14) {
            totalCount
            nodes {
              timestamp
              count
              uniques
            }
          }
        }
      }
    `;

    try {
      const variables = {
        owner,
        name,
        fromDate: fromDate?.toISOString() || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      // For development, we'll simulate the GraphQL response
      // In production, use fetch for GraphQL request:
      // const result = await this.executeGraphQLQuery(query, variables);
      
      // Simulated response for development
      const result = await this.simulateGraphQLResponse(owner, name);
      
      return this.transformGraphQLResponse(result);
    } catch (error) {
      console.error('Error fetching repository data:', error);
      throw new Error(`Failed to fetch repository data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect corporate usage patterns from subgraph data
   */
  async detectCorporateUsage(owner: string, name: string): Promise<GitHubRepoData['corporateSignals']> {
    const data = await this.fetchRepositoryData(owner, name);
    const signals: GitHubRepoData['corporateSignals'] = [];

    // Analyze clone patterns for corporate usage
    if (data.repository.clones > 1000) {
      signals.push({
        type: 'clone_spike',
        confidence: 0.8,
        detectedAt: new Date().toISOString(),
        metadata: { cloneCount: data.repository.clones }
      });
    }

    // Check contributor organizations
    data.contributors.forEach(contributor => {
      if (contributor.organizationData?.name) {
        signals.push({
          type: 'org_member',
          githubLogin: contributor.githubLogin,
          organizationName: contributor.organizationData.name,
          confidence: 0.9,
          detectedAt: new Date().toISOString(),
          metadata: { contributionCount: contributor.contributionCount }
        });
      }
    });

    return signals;
  }

  /**
   * Simulate GraphQL response for development
   */
  private async simulateGraphQLResponse(owner: string, name: string): Promise<any> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      repository: {
        id: `repo_${owner}_${name}`,
        name,
        owner,
        stars: Math.floor(Math.random() * 1000) + 100,
        forks: Math.floor(Math.random() * 100) + 10,
        issues: Math.floor(Math.random() * 50) + 5,
        releases: Math.floor(Math.random() * 20) + 1,
        pullRequests: {
          nodes: [
            {
              number: 123,
              title: "Add new feature X",
              mergedAt: new Date().toISOString(),
              additions: 150,
              deletions: 25,
              changedFiles: 5,
              labels: { nodes: [{ name: "enhancement" }, { name: "feature" }] },
              author: {
                login: "developer1",
                id: "user_123",
                email: "dev1@company.com",
                company: "Tech Corp"
              }
            }
          ]
        },
        contributors: {
          nodes: [
            {
              login: "developer1",
              id: "user_123",
              email: "dev1@company.com",
              company: "Tech Corp",
              contributionsCollection: {
                totalCommitContributions: 45,
                totalPullRequestContributions: 12
              }
            }
          ]
        },
        cloneTraffic: {
          totalCount: 1250,
          nodes: [
            { timestamp: new Date().toISOString(), count: 89, uniques: 23 }
          ]
        },
        viewTraffic: {
          totalCount: 3200,
          nodes: [
            { timestamp: new Date().toISOString(), count: 245, uniques: 78 }
          ]
        }
      }
    };
  }

  /**
   * Transform GraphQL response to standardized format
   */
  private transformGraphQLResponse(result: any): GitHubRepoData {
    const repo = result.repository;
    
    return {
      contributors: repo.contributors.nodes.map((contributor: any) => ({
        githubLogin: contributor.login,
        githubId: contributor.id,
        contributionCount: contributor.contributionsCollection?.totalCommitContributions || 0,
        firstContribution: new Date().toISOString(), // Would be calculated from actual data
        lastContribution: new Date().toISOString(),
        organizationData: contributor.company ? {
          name: contributor.company,
          email: contributor.email
        } : undefined
      })),
      
      pullRequests: repo.pullRequests.nodes.map((pr: any) => ({
        number: pr.number,
        author: pr.author.login,
        mergedAt: pr.mergedAt,
        title: pr.title,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changedFiles,
        labels: pr.labels.nodes.map((label: any) => label.name)
      })),
      
      repository: {
        stars: repo.stars,
        forks: repo.forks,
        clones: repo.cloneTraffic.totalCount,
        views: repo.viewTraffic.totalCount,
        issues: repo.issues,
        releases: repo.releases
      },
      
      corporateSignals: []
    };
  }

  /**
   * Update agent's subgraph URL
   */
  private async updateAgentSubgraphUrl(repositoryId: string, subgraphUrl: string): Promise<void> {
    const { prisma } = await import('@/lib/db');
    
    await prisma.repoAgent.update({
      where: { repositoryId },
      data: { 
        subgraphUrl,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Execute GraphQL query using fetch
   */
  private async executeGraphQLQuery(query: string, variables: any): Promise<any> {
    try {
      const response = await fetch(this.subgraphUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ query, variables })
      });
      
      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
      }
      
      return result.data;
    } catch (error) {
      console.error('GraphQL query failed:', error);
      throw error;
    }
  }

  /**
   * Health check for subgraph
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number }> {
    const start = Date.now();
    
    try {
      const query = `{ _meta { block { number } } }`;
      await this.executeGraphQLQuery(query, {});
      
      return {
        status: 'healthy',
        latency: Date.now() - start
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - start
      };
    }
  }
}

/**
 * Corporate User Detection Service
 * Analyzes repository usage patterns to detect corporate/enterprise users
 */

import { prisma } from '@/lib/db';

export interface DetectionResult {
  githubLogin?: string;
  organizationName?: string;
  domain?: string;
  githubOrgId?: string;
  email?: string;
  detectionMethod: 'domain' | 'org_membership' | 'usage_pattern' | 'manual';
  confidence: number;
  usageMetrics: Record<string, any>;
}

export interface UsagePattern {
  cloneFrequency: number;
  viewFrequency: number;
  downloadCount: number;
  apiCallsCount: number;
  timePattern: string; // "business_hours", "distributed", "automated"
  userAgent?: string;
  ipRange?: string;
}

export class CorporateDetectorService {
  private static readonly CORPORATE_DOMAINS = new Set([
    'microsoft.com', 'google.com', 'amazon.com', 'apple.com', 'meta.com', 'netflix.com',
    'uber.com', 'airbnb.com', 'stripe.com', 'shopify.com', 'salesforce.com', 'oracle.com',
    'ibm.com', 'intel.com', 'nvidia.com', 'amd.com', 'vmware.com', 'cisco.com', 'adobe.com',
    'atlassian.com', 'slack.com', 'zoom.us', 'dropbox.com', 'box.com', 'twilio.com'
  ]);

  private static readonly ENTERPRISE_INDICATORS = [
    'corp', 'inc', 'ltd', 'llc', 'enterprise', 'consulting', 'solutions', 'systems',
    'technologies', 'services', 'group', 'company', 'business', 'partners'
  ];

  /**
   * Analyze and detect corporate users for a repository
   */
  static async analyzeRepository(
    agentId: string,
    repositoryData: any,
    githubAnalytics?: any
  ): Promise<DetectionResult[]> {
    const detectedUsers: DetectionResult[] = [];

    try {
      // Method 1: Domain-based detection
      const domainResults = await this.detectByDomain(repositoryData);
      detectedUsers.push(...domainResults);

      // Method 2: GitHub organization membership
      const orgResults = await this.detectByOrganization(repositoryData);
      detectedUsers.push(...orgResults);

      // Method 3: Usage pattern analysis
      if (githubAnalytics) {
        const patternResults = await this.detectByUsagePattern(githubAnalytics);
        detectedUsers.push(...patternResults);
      }

      // Store detected users in database
      for (const result of detectedUsers) {
        await this.storeCorporateUser(agentId, result);
      }

      return detectedUsers;
    } catch (error) {
      console.error('Error analyzing repository for corporate users:', error);
      return [];
    }
  }

  /**
   * Detect corporate users by email domain
   */
  private static async detectByDomain(repositoryData: any): Promise<DetectionResult[]> {
    const results: DetectionResult[] = [];

    // Analyze contributor emails from commits
    const contributors = repositoryData.contributors || [];
    
    for (const contributor of contributors) {
      const email = contributor.email || contributor.commit?.author?.email;
      
      if (email && this.isEmailCorporate(email)) {
        const domain = email.split('@')[1];
        const organizationName = this.getDomainOrganization(domain);
        
        results.push({
          githubLogin: contributor.login,
          organizationName,
          domain,
          email,
          detectionMethod: 'domain',
          confidence: this.CORPORATE_DOMAINS.has(domain) ? 0.9 : 0.7,
          usageMetrics: {
            commits: contributor.contributions || 0,
            email,
            domain
          }
        });
      }
    }

    return results;
  }

  /**
   * Detect by GitHub organization membership
   */
  private static async detectByOrganization(repositoryData: any): Promise<DetectionResult[]> {
    const results: DetectionResult[] = [];

    // Analyze organization members who contributed
    const orgMembers = repositoryData.organizationMembers || [];
    
    for (const member of orgMembers) {
      if (member.company || member.organization) {
        results.push({
          githubLogin: member.login,
          organizationName: member.company || member.organization.name,
          githubOrgId: member.organization?.id?.toString(),
          detectionMethod: 'org_membership',
          confidence: 0.85,
          usageMetrics: {
            publicRepos: member.public_repos || 0,
            followers: member.followers || 0,
            organizationType: member.type
          }
        });
      }
    }

    return results;
  }

  /**
   * Detect by usage patterns (high frequency access, automated patterns)
   */
  private static async detectByUsagePattern(githubAnalytics: any): Promise<DetectionResult[]> {
    const results: DetectionResult[] = [];

    // Analyze clone patterns
    const clones = githubAnalytics.clones || {};
    const views = githubAnalytics.views || {};
    
    // Look for automated/high-frequency access patterns
    const suspiciousPatterns = this.analyzeSuspiciousPatterns(clones, views);
    
    for (const pattern of suspiciousPatterns) {
      results.push({
        githubLogin: pattern.user || 'unknown',
        organizationName: this.inferOrganizationFromPattern(pattern),
        detectionMethod: 'usage_pattern',
        confidence: pattern.confidence,
        usageMetrics: {
          clonesPerDay: pattern.clonesPerDay,
          viewsPerDay: pattern.viewsPerDay,
          accessPattern: pattern.timePattern,
          userAgent: pattern.userAgent,
          ipRange: pattern.ipRange
        }
      });
    }

    return results;
  }

  /**
   * Store corporate user in database
   */
  private static async storeCorporateUser(
    agentId: string,
    result: DetectionResult
  ): Promise<void> {
    try {
      await prisma.corporateUser.upsert({
        where: {
          agentId_githubLogin: {
            agentId,
            githubLogin: result.githubLogin || 'unknown'
          }
        },
        update: {
          organizationName: result.organizationName,
          domain: result.domain,
          githubOrgId: result.githubOrgId,
          email: result.email,
          confidence: Math.max(result.confidence, 0), // Update with higher confidence
          lastActivity: new Date(),
          usageMetrics: JSON.stringify(result.usageMetrics),
          totalActivity: { increment: 1 }
        },
        create: {
          agentId,
          organizationName: result.organizationName,
          domain: result.domain,
          githubLogin: result.githubLogin,
          githubOrgId: result.githubOrgId,
          email: result.email,
          detectionMethod: result.detectionMethod,
          confidence: result.confidence,
          usageMetrics: JSON.stringify(result.usageMetrics),
          totalActivity: 1
        }
      });
    } catch (error) {
      console.error('Error storing corporate user:', error);
    }
  }

  /**
   * Check if email domain is corporate
   */
  private static isEmailCorporate(email: string): boolean {
    const domain = email.split('@')[1]?.toLowerCase();
    
    if (!domain) return false;
    
    // Check against known corporate domains
    if (this.CORPORATE_DOMAINS.has(domain)) {
      return true;
    }
    
    // Check for enterprise indicators in domain
    return this.ENTERPRISE_INDICATORS.some(indicator => 
      domain.includes(indicator)
    );
  }

  /**
   * Get organization name from domain
   */
  private static getDomainOrganization(domain: string): string {
    const domainMap: Record<string, string> = {
      'microsoft.com': 'Microsoft Corporation',
      'google.com': 'Google LLC',
      'amazon.com': 'Amazon.com, Inc.',
      'apple.com': 'Apple Inc.',
      'meta.com': 'Meta Platforms, Inc.',
      'netflix.com': 'Netflix, Inc.',
      'uber.com': 'Uber Technologies, Inc.',
      'airbnb.com': 'Airbnb, Inc.',
      'stripe.com': 'Stripe, Inc.',
      'shopify.com': 'Shopify Inc.',
      'salesforce.com': 'Salesforce, Inc.'
    };

    return domainMap[domain] || this.capitalizeCompanyName(domain);
  }

  /**
   * Capitalize company name from domain
   */
  private static capitalizeCompanyName(domain: string): string {
    return domain
      .replace(/\.(com|org|net|io|co)$/, '')
      .split('.')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  /**
   * Analyze suspicious usage patterns
   */
  private static analyzeSuspiciousPatterns(clones: any, views: any): UsagePattern[] {
    const patterns: UsagePattern[] = [];

    // Analyze clone frequency
    const cloneData = clones.clones || [];
    const viewData = views.views || [];
    
    // Group by potential users/IPs and look for high-frequency access
    const userPatterns = this.groupByUser(cloneData, viewData);
    
    for (const [user, data] of Object.entries(userPatterns)) {
      const avgClonesPerDay = data.totalClones / Math.max(data.days, 1);
      const avgViewsPerDay = data.totalViews / Math.max(data.days, 1);
      
      // Flag as suspicious if very high frequency
      if (avgClonesPerDay > 10 || avgViewsPerDay > 100) {
        patterns.push({
          cloneFrequency: avgClonesPerDay,
          viewFrequency: avgViewsPerDay,
          downloadCount: data.totalClones,
          apiCallsCount: data.totalViews,
          timePattern: this.determineTimePattern(data.timestamps),
          userAgent: data.userAgent,
          ipRange: data.ipRange
        });
      }
    }

    return patterns;
  }

  /**
   * Group usage data by potential user identifiers
   */
  private static groupByUser(cloneData: any[], viewData: any[]): Record<string, any> {
    const grouped: Record<string, any> = {};

    // Group clones
    for (const clone of cloneData) {
      const key = clone.uniques || clone.ip || 'unknown';
      if (!grouped[key]) {
        grouped[key] = { 
          totalClones: 0, 
          totalViews: 0, 
          days: new Set(), 
          timestamps: [],
          userAgent: clone.userAgent,
          ipRange: this.getIpRange(clone.ip)
        };
      }
      grouped[key].totalClones += clone.count || 1;
      grouped[key].days.add(clone.timestamp?.split('T')[0]);
      grouped[key].timestamps.push(new Date(clone.timestamp));
    }

    // Group views
    for (const view of viewData) {
      const key = view.uniques || view.ip || 'unknown';
      if (!grouped[key]) {
        grouped[key] = { 
          totalClones: 0, 
          totalViews: 0, 
          days: new Set(), 
          timestamps: [],
          userAgent: view.userAgent,
          ipRange: this.getIpRange(view.ip)
        };
      }
      grouped[key].totalViews += view.count || 1;
      grouped[key].days.add(view.timestamp?.split('T')[0]);
      grouped[key].timestamps.push(new Date(view.timestamp));
    }

    // Convert days Set to size
    for (const data of Object.values(grouped)) {
      data.days = data.days.size;
    }

    return grouped;
  }

  /**
   * Determine time pattern (business hours, distributed, automated)
   */
  private static determineTimePattern(timestamps: Date[]): string {
    if (timestamps.length < 5) return 'insufficient_data';
    
    const hours = timestamps.map(t => t.getHours());
    const businessHours = hours.filter(h => h >= 9 && h <= 17).length;
    const businessHoursRatio = businessHours / hours.length;
    
    if (businessHoursRatio > 0.8) return 'business_hours';
    if (businessHoursRatio < 0.3) return 'automated';
    return 'distributed';
  }

  /**
   * Get IP range for pattern analysis
   */
  private static getIpRange(ip?: string): string | undefined {
    if (!ip) return undefined;
    
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.x.x`;
    }
    
    return undefined;
  }

  /**
   * Infer organization from usage pattern
   */
  private static inferOrganizationFromPattern(pattern: UsagePattern): string | undefined {
    // Simple heuristics to infer organization
    if (pattern.userAgent?.includes('CI') || pattern.userAgent?.includes('Jenkins')) {
      return 'Automated CI/CD System';
    }
    
    if (pattern.timePattern === 'business_hours') {
      return 'Corporate Entity (Business Hours Pattern)';
    }
    
    if (pattern.cloneFrequency > 50) {
      return 'High-Volume User (Potential Enterprise)';
    }
    
    return undefined;
  }

  /**
   * Get corporate users for an agent
   */
  static async getCorporateUsers(agentId: string) {
    return prisma.corporateUser.findMany({
      where: { agentId },
      orderBy: { confidence: 'desc' }
    });
  }

  /**
   * Update corporate user status (for manual verification)
   */
  static async updateCorporateUserStatus(
    corporateUserId: string,
    status: string,
    notes?: string
  ): Promise<void> {
    await prisma.corporateUser.update({
      where: { id: corporateUserId },
      data: {
        status,
        notes,
        updatedAt: new Date()
      }
    });
  }
}

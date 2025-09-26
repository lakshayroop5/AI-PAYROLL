/**
 * Distribution Calculation Service
 * Handles PR-count based distribution logic and payout calculations
 */

import { ContributorStats } from './github';
import { PriceSnapshot } from './pyth';

export interface DistributionConfig {
  mode: 'PR_COUNT_PROPORTIONAL';
  totalBudgetUsd: number;
  minPrCountThreshold: number; // Minimum PRs to qualify for payout
  maxShareCap?: number; // Maximum share percentage (0-1)
  excludeContributors?: string[]; // GitHub logins to exclude
}

export interface ContributorDistribution {
  githubLogin: string;
  githubId: number;
  contributorId?: string; // Database contributor ID if verified
  prCount: number;
  shareRatio: number; // Proportion of total distribution (0-1)
  usdAmount: number;
  nativeAmount: string; // Amount in smallest unit
  eligible: boolean;
  ineligibilityReason?: string;
}

export interface DistributionPreview {
  config: DistributionConfig;
  priceSnapshot: PriceSnapshot;
  totalPrCount: number;
  eligibleContributors: number;
  totalDistribution: number; // Total USD distributed
  distributions: ContributorDistribution[];
  warnings: string[];
  metadata: {
    calculatedAt: Date;
    asset: string;
    assetDecimals: number;
    previewHash: string;
  };
}

export interface DistributionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class DistributionService {

  /**
   * Calculate PR-count proportional distribution
   */
  calculatePRCountDistribution(
    contributorStats: Map<string, ContributorStats>,
    config: DistributionConfig,
    priceSnapshot: PriceSnapshot,
    asset: string,
    assetDecimals: number,
    verifiedContributors?: Map<string, string> // GitHub login -> contributor ID
  ): DistributionPreview {
    const distributions: ContributorDistribution[] = [];
    const warnings: string[] = [];
    
    // Filter eligible contributors
    const eligibleStats = this.filterEligibleContributors(contributorStats, config, warnings);
    
    // Calculate total PR count for eligible contributors
    const totalPrCount = Array.from(eligibleStats.values())
      .reduce((sum, stats) => sum + stats.prCount, 0);

    if (totalPrCount === 0) {
      warnings.push('No eligible contributors found - all distributions will be zero');
    }

    // Calculate individual distributions
    for (const [githubLogin, stats] of eligibleStats) {
      const shareRatio = totalPrCount > 0 ? stats.prCount / totalPrCount : 0;
      
      // Apply maximum share cap if configured
      const cappedShareRatio = config.maxShareCap 
        ? Math.min(shareRatio, config.maxShareCap)
        : shareRatio;

      const usdAmount = config.totalBudgetUsd * cappedShareRatio;
      const nativeAmount = this.convertUsdToNative(usdAmount, priceSnapshot, assetDecimals);

      const distribution: ContributorDistribution = {
        githubLogin,
        githubId: stats.id,
        contributorId: verifiedContributors?.get(githubLogin),
        prCount: stats.prCount,
        shareRatio: cappedShareRatio,
        usdAmount,
        nativeAmount,
        eligible: true
      };

      distributions.push(distribution);

      // Add warning if share was capped
      if (config.maxShareCap && shareRatio > config.maxShareCap) {
        warnings.push(
          `${githubLogin}'s share was capped at ${(config.maxShareCap * 100).toFixed(1)}% ` +
          `(was ${(shareRatio * 100).toFixed(1)}%)`
        );
      }
    }

    // Add ineligible contributors for transparency
    for (const [githubLogin, stats] of contributorStats) {
      if (!eligibleStats.has(githubLogin)) {
        const reason = this.getIneligibilityReason(stats, config);
        distributions.push({
          githubLogin,
          githubId: stats.id,
          contributorId: verifiedContributors?.get(githubLogin),
          prCount: stats.prCount,
          shareRatio: 0,
          usdAmount: 0,
          nativeAmount: '0',
          eligible: false,
          ineligibilityReason: reason
        });
      }
    }

    const totalDistribution = distributions
      .filter(d => d.eligible)
      .reduce((sum, d) => sum + d.usdAmount, 0);

    const previewHash = this.calculatePreviewHash(distributions, config, priceSnapshot);

    return {
      config,
      priceSnapshot,
      totalPrCount,
      eligibleContributors: eligibleStats.size,
      totalDistribution,
      distributions,
      warnings,
      metadata: {
        calculatedAt: new Date(),
        asset,
        assetDecimals,
        previewHash
      }
    };
  }

  /**
   * Validate distribution configuration
   */
  validateDistributionConfig(config: DistributionConfig): DistributionValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate budget
    if (config.totalBudgetUsd <= 0) {
      errors.push('Total budget must be greater than 0');
    }

    if (config.totalBudgetUsd > 1000000) { // $1M cap for safety
      warnings.push('Large budget amount - please verify this is correct');
    }

    // Validate minimum threshold
    if (config.minPrCountThreshold < 0) {
      errors.push('Minimum PR count threshold cannot be negative');
    }

    if (config.minPrCountThreshold > 100) {
      warnings.push('High minimum PR threshold may exclude many contributors');
    }

    // Validate maximum share cap
    if (config.maxShareCap !== undefined) {
      if (config.maxShareCap <= 0 || config.maxShareCap > 1) {
        errors.push('Maximum share cap must be between 0 and 1');
      }

      if (config.maxShareCap < 0.1) {
        warnings.push('Very low share cap may result in unused budget');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate distribution preview for execution
   */
  validateDistributionForExecution(
    preview: DistributionPreview,
    verifiedContributors: Map<string, string>
  ): DistributionValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check price freshness
    const priceAge = (Date.now() - preview.priceSnapshot.timestamp.getTime()) / 1000;
    const maxStaleness = parseInt(process.env.MAX_PRICE_STALENESS_SECONDS || '300');
    
    if (priceAge > maxStaleness) {
      errors.push(`Price data is stale: ${priceAge}s old (max: ${maxStaleness}s)`);
    }

    // Check for verified contributors
    const eligibleDistributions = preview.distributions.filter(d => d.eligible);
    const unverifiedCount = eligibleDistributions.filter(
      d => !verifiedContributors.has(d.githubLogin)
    ).length;

    if (unverifiedCount > 0) {
      warnings.push(
        `${unverifiedCount} eligible contributors are not verified with Self identity`
      );
    }

    // Check for zero amounts
    const zeroAmounts = eligibleDistributions.filter(d => d.nativeAmount === '0').length;
    if (zeroAmounts > 0) {
      warnings.push(`${zeroAmounts} contributors have zero payout amounts`);
    }

    // Check total distribution vs budget
    const totalDistribution = preview.totalDistribution;
    const budgetUtilization = totalDistribution / preview.config.totalBudgetUsd;
    
    if (budgetUtilization < 0.95) {
      warnings.push(
        `Only ${(budgetUtilization * 100).toFixed(1)}% of budget will be distributed`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Filter eligible contributors based on configuration
   */
  private filterEligibleContributors(
    contributorStats: Map<string, ContributorStats>,
    config: DistributionConfig,
    warnings: string[]
  ): Map<string, ContributorStats> {
    const eligible = new Map<string, ContributorStats>();

    for (const [githubLogin, stats] of contributorStats) {
      // Check minimum PR threshold
      if (stats.prCount < config.minPrCountThreshold) {
        continue;
      }

      // Check exclusion list
      if (config.excludeContributors?.includes(githubLogin)) {
        continue;
      }

      eligible.set(githubLogin, stats);
    }

    const excludedCount = contributorStats.size - eligible.size;
    if (excludedCount > 0) {
      warnings.push(`${excludedCount} contributors excluded from distribution`);
    }

    return eligible;
  }

  /**
   * Get reason why contributor is ineligible
   */
  private getIneligibilityReason(stats: ContributorStats, config: DistributionConfig): string {
    if (stats.prCount < config.minPrCountThreshold) {
      return `Below minimum PR threshold (${stats.prCount} < ${config.minPrCountThreshold})`;
    }

    if (config.excludeContributors?.includes(stats.login)) {
      return 'Explicitly excluded from distribution';
    }

    return 'Unknown reason';
  }

  /**
   * Convert USD amount to native asset amount
   */
  private convertUsdToNative(
    usdAmount: number,
    priceSnapshot: PriceSnapshot,
    assetDecimals: number
  ): string {
    const nativeAmount = usdAmount / priceSnapshot.price;
    const scaledAmount = Math.floor(nativeAmount * Math.pow(10, assetDecimals));
    return scaledAmount.toString();
  }

  /**
   * Calculate deterministic hash for preview reproducibility
   */
  private calculatePreviewHash(
    distributions: ContributorDistribution[],
    config: DistributionConfig,
    priceSnapshot: PriceSnapshot
  ): string {
    const hashInput = {
      distributions: distributions.map(d => ({
        githubLogin: d.githubLogin,
        prCount: d.prCount,
        shareRatio: d.shareRatio,
        usdAmount: d.usdAmount,
        nativeAmount: d.nativeAmount
      })),
      config,
      price: priceSnapshot.price,
      timestamp: priceSnapshot.timestamp.toISOString()
    };

    // Simple hash implementation - in production, use crypto.createHash
    const hashString = JSON.stringify(hashInput);
    let hash = 0;
    for (let i = 0; i < hashString.length; i++) {
      const char = hashString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Create idempotency key for payout
   */
  createPayoutIdempotencyKey(runId: string, contributorId: string): string {
    return `payout_${runId}_${contributorId}`;
  }

  /**
   * Recalculate distribution with updated parameters
   */
  recalculateDistribution(
    originalPreview: DistributionPreview,
    updates: Partial<DistributionConfig>
  ): DistributionPreview {
    const updatedConfig = { ...originalPreview.config, ...updates };
    
    // Rebuild contributor stats from preview
    const contributorStats = new Map<string, ContributorStats>();
    originalPreview.distributions.forEach(d => {
      contributorStats.set(d.githubLogin, {
        login: d.githubLogin,
        id: d.githubId,
        prCount: d.prCount,
        totalAdditions: 0, // Not used in distribution
        totalDeletions: 0, // Not used in distribution
        totalChangedFiles: 0, // Not used in distribution
        prs: [] // Not used in distribution
      });
    });

    return this.calculatePRCountDistribution(
      contributorStats,
      updatedConfig,
      originalPreview.priceSnapshot,
      originalPreview.metadata.asset,
      originalPreview.metadata.assetDecimals
    );
  }
}

export const distributionService = new DistributionService();
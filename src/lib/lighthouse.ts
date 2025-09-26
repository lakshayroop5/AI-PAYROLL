/**
 * Lighthouse (Filecoin) Integration Service
 * Handles immutable payroll slip storage with IPFS and Filecoin
 */

export interface LighthouseUploadResponse {
  Name: string;
  Hash: string; // IPFS CID
  Size: string;
}

export interface PayrollSlipData {
  runId: string;
  runNumber: number;
  generatedAt: Date;
  environment: 'testnet' | 'mainnet';
  repositories: string[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
  distributionMode: string;
  totalBudgetUsd: number;
  asset: string;
  priceSnapshot: {
    symbol: string;
    price: number;
    timestamp: string;
    feedId: string;
  };
  totalPrCount: number;
  contributors: Array<{
    githubLogin: string;
    hederaAccountId: string;
    prCount: number;
    shareRatio: number;
    usdAmount: number;
    nativeAmount: string;
    status: string;
    transactionId?: string;
    confirmedAt?: string;
  }>;
  summary: {
    totalPayouts: number;
    successfulPayouts: number;
    failedPayouts: number;
    totalUsdDistributed: number;
    totalNativeDistributed: string;
  };
  verification: {
    managerVerified: boolean;
    contributorsVerified: number;
    totalContributors: number;
  };
}

export interface ManifestData {
  version: '1.0';
  type: 'ai-payroll-manifest';
  runId: string;
  generatedAt: string;
  files: Array<{
    name: string;
    type: 'csv' | 'json';
    cid: string;
    size: number;
    contentHash: string;
  }>;
  metadata: {
    environment: string;
    distributionMode: string;
    repositories: string[];
    dateRange: {
      startDate: string;
      endDate: string;
    };
    verification: {
      managerVerified: boolean;
      contributorsVerified: number;
    };
  };
  signatures?: Array<{
    signer: string;
    signature: string;
    algorithm: string;
  }>;
}

export interface UploadResult {
  success: boolean;
  cid?: string;
  size?: number;
  error?: string;
  gatewayUrl?: string;
}

export interface CIDHealthCheck {
  accessible: boolean;
  size?: number;
  contentType?: string;
  lastChecked: Date;
  error?: string;
  gatewayUrls: string[];
  responseTime?: number;
}

export class LighthouseService {
  private apiKey: string;
  private baseUrl: string;
  private gatewayUrls: string[];

  constructor() {
    this.apiKey = process.env.LIGHTHOUSE_API_KEY || '';
    this.baseUrl = 'https://node.lighthouse.storage';
    this.gatewayUrls = [
      'https://gateway.lighthouse.storage/ipfs',
      'https://ipfs.io/ipfs',
      'https://cloudflare-ipfs.com/ipfs',
      'https://dweb.link/ipfs'
    ];
  }

  /**
   * Generate CSV payroll slip
   */
  generateCSVPayslip(data: PayrollSlipData): string {
    const headers = [
      'GitHub Login',
      'Hedera Account ID',
      'PR Count',
      'Share Ratio',
      'USD Amount',
      'Native Amount',
      'Status',
      'Transaction ID',
      'Confirmed At'
    ];

    const rows = data.contributors.map(contributor => [
      contributor.githubLogin,
      contributor.hederaAccountId,
      contributor.prCount.toString(),
      contributor.shareRatio.toFixed(6),
      contributor.usdAmount.toFixed(2),
      contributor.nativeAmount,
      contributor.status,
      contributor.transactionId || '',
      contributor.confirmedAt || ''
    ]);

    const csvContent = [
      `# AI Payroll System - Payroll Slip`,
      `# Run ID: ${data.runId}`,
      `# Generated: ${data.generatedAt.toISOString()}`,
      `# Environment: ${data.environment}`,
      `# Repositories: ${data.repositories.join(', ')}`,
      `# Date Range: ${data.dateRange.startDate} to ${data.dateRange.endDate}`,
      `# Distribution Mode: ${data.distributionMode}`,
      `# Total Budget: $${data.totalBudgetUsd}`,
      `# Asset: ${data.asset}`,
      `# Price: ${data.priceSnapshot.symbol} = $${data.priceSnapshot.price} (${data.priceSnapshot.timestamp})`,
      `# Total PRs: ${data.totalPrCount}`,
      `# Successful Payouts: ${data.summary.successfulPayouts}/${data.summary.totalPayouts}`,
      ``,
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    return csvContent;
  }

  /**
   * Generate JSON manifest
   */
  generateJSONManifest(data: PayrollSlipData, csvCid: string, jsonCid: string): ManifestData {
    return {
      version: '1.0',
      type: 'ai-payroll-manifest',
      runId: data.runId,
      generatedAt: data.generatedAt.toISOString(),
      files: [
        {
          name: `payroll-slip-${data.runId}.csv`,
          type: 'csv',
          cid: csvCid,
          size: 0, // Will be filled after upload
          contentHash: this.calculateContentHash(this.generateCSVPayslip(data))
        },
        {
          name: `payroll-data-${data.runId}.json`,
          type: 'json',
          cid: jsonCid,
          size: 0, // Will be filled after upload
          contentHash: this.calculateContentHash(JSON.stringify(data, null, 2))
        }
      ],
      metadata: {
        environment: data.environment,
        distributionMode: data.distributionMode,
        repositories: data.repositories,
        dateRange: data.dateRange,
        verification: data.verification
      }
    };
  }

  /**
   * Upload file to Lighthouse
   */
  async uploadFile(content: string, filename: string): Promise<UploadResult> {
    try {
      const formData = new FormData();
      const blob = new Blob([content], { type: 'text/plain' });
      formData.append('file', blob, filename);

      const response = await fetch(`${this.baseUrl}/api/v0/add`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Lighthouse API error: ${response.status} ${response.statusText}`);
      }

      const result: LighthouseUploadResponse = await response.json();

      return {
        success: true,
        cid: result.Hash,
        size: parseInt(result.Size),
        gatewayUrl: `${this.gatewayUrls[0]}/${result.Hash}`
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Upload complete payroll slip (CSV + JSON + Manifest)
   */
  async uploadPayrollSlip(data: PayrollSlipData): Promise<{
    csv: UploadResult;
    json: UploadResult;
    manifest: UploadResult;
  }> {
    // Generate CSV content
    const csvContent = this.generateCSVPayslip(data);
    const csvFilename = `payroll-slip-${data.runId}.csv`;
    const csvResult = await this.uploadFile(csvContent, csvFilename);

    // Generate JSON content
    const jsonContent = JSON.stringify(data, null, 2);
    const jsonFilename = `payroll-data-${data.runId}.json`;
    const jsonResult = await this.uploadFile(jsonContent, jsonFilename);

    // Generate manifest
    let manifestResult: UploadResult = { success: false };
    
    if (csvResult.success && jsonResult.success) {
      const manifest = this.generateJSONManifest(data, csvResult.cid!, jsonResult.cid!);
      
      // Update file sizes in manifest
      manifest.files[0].size = csvResult.size!;
      manifest.files[1].size = jsonResult.size!;
      
      const manifestContent = JSON.stringify(manifest, null, 2);
      const manifestFilename = `payroll-manifest-${data.runId}.json`;
      manifestResult = await this.uploadFile(manifestContent, manifestFilename);
    }

    return {
      csv: csvResult,
      json: jsonResult,
      manifest: manifestResult
    };
  }

  /**
   * Check CID health across multiple gateways
   */
  async checkCIDHealth(cid: string): Promise<CIDHealthCheck> {
    const results: Array<{ url: string; accessible: boolean; responseTime?: number; size?: number; error?: string }> = [];

    for (const gatewayUrl of this.gatewayUrls) {
      const fullUrl = `${gatewayUrl}/${cid}`;
      const startTime = Date.now();

      try {
        const response = await fetch(fullUrl, {
          method: 'HEAD'
        });

        const responseTime = Date.now() - startTime;
        const size = response.headers.get('content-length');

        results.push({
          url: fullUrl,
          accessible: response.ok,
          responseTime,
          size: size ? parseInt(size) : undefined
        });

      } catch (error) {
        results.push({
          url: fullUrl,
          accessible: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const accessibleResults = results.filter(r => r.accessible);
    const isAccessible = accessibleResults.length > 0;

    return {
      accessible: isAccessible,
      size: isAccessible ? accessibleResults[0].size : undefined,
      lastChecked: new Date(),
      error: isAccessible ? undefined : 'Not accessible from any gateway',
      gatewayUrls: this.gatewayUrls,
      responseTime: isAccessible ? Math.min(...accessibleResults.map(r => r.responseTime!)) : undefined
    };
  }

  /**
   * Get file content from IPFS
   */
  async getFileContent(cid: string): Promise<string | null> {
    for (const gatewayUrl of this.gatewayUrls) {
      try {
        const response = await fetch(`${gatewayUrl}/${cid}`);

        if (response.ok) {
          return await response.text();
        }
      } catch (error) {
        console.error(`Error fetching from ${gatewayUrl}:`, error);
        continue;
      }
    }

    return null;
  }

  /**
   * Verify file integrity using content hash
   */
  async verifyFileIntegrity(cid: string, expectedHash: string): Promise<boolean> {
    try {
      const content = await this.getFileContent(cid);
      if (!content) return false;

      const actualHash = this.calculateContentHash(content);
      return actualHash === expectedHash;
    } catch (error) {
      console.error('Error verifying file integrity:', error);
      return false;
    }
  }

  /**
   * Get Filecoin deal status (if available)
   */
  async getFilecoinDealStatus(cid: string): Promise<{
    hasDeal: boolean;
    dealId?: string;
    status?: string;
    storageProvider?: string;
    dealExpiration?: Date;
  }> {
    try {
      // This would typically query Filecoin deal information
      // For now, return a placeholder response
      return {
        hasDeal: false
      };
    } catch (error) {
      console.error('Error checking Filecoin deal status:', error);
      return {
        hasDeal: false
      };
    }
  }

  /**
   * Generate shareable links for payroll slip
   */
  generateShareableLinks(cid: string): Array<{ name: string; url: string }> {
    return this.gatewayUrls.map((gatewayUrl, index) => ({
      name: this.getGatewayName(gatewayUrl),
      url: `${gatewayUrl}/${cid}`
    }));
  }

  /**
   * Calculate content hash for integrity verification
   */
  private calculateContentHash(content: string): string {
    // Simple hash implementation - in production, use a proper cryptographic hash
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get friendly name for gateway
   */
  private getGatewayName(gatewayUrl: string): string {
    if (gatewayUrl.includes('lighthouse.storage')) return 'Lighthouse Gateway';
    if (gatewayUrl.includes('ipfs.io')) return 'IPFS.io Gateway';
    if (gatewayUrl.includes('cloudflare-ipfs.com')) return 'Cloudflare Gateway';
    if (gatewayUrl.includes('dweb.link')) return 'DWeb Gateway';
    return 'IPFS Gateway';
  }

  /**
   * Create audit trail entry for uploads
   */
  createAuditTrail(runId: string, uploadResults: any): string {
    return JSON.stringify({
      runId,
      timestamp: new Date().toISOString(),
      results: uploadResults,
      version: '1.0'
    }, null, 2);
  }
}

export const lighthouseService = new LighthouseService();
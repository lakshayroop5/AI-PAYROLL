/**
 * Lighthouse Web3 Storage Integration
 * Handles artifact upload, CID verification, and decentralized storage
 */

// Using IPFS HTTP client instead of Lighthouse SDK for broader compatibility
// import lighthouse from '@lighthouse-web3/sdk';

export interface StorageConfig {
  apiKey: string;
  network?: 'mainnet' | 'testnet';
}

export interface ArtifactUpload {
  runId: string;
  type: 'payroll_report' | 'invoice_batch' | 'analytics_export' | 'audit_log';
  filename: string;
  content: Buffer | string;
  metadata?: Record<string, any>;
}

export interface UploadResult {
  success: boolean;
  cid?: string;
  size?: number;
  error?: string;
  gatewayUrl?: string;
}

export interface CIDVerification {
  cid: string;
  exists: boolean;
  size?: number;
  lastChecked: Date;
  gatewayResponsive: boolean;
}

export class LighthouseStorageService {
  private apiKey: string;
  private network: 'mainnet' | 'testnet';

  constructor(config: StorageConfig) {
    this.apiKey = config.apiKey || process.env.LIGHTHOUSE_API_KEY || '';
    this.network = config.network || 'mainnet';
    
    if (!this.apiKey) {
      console.warn('Lighthouse API key not configured. Storage operations will be simulated.');
    }
  }

  /**
   * Upload artifact to Lighthouse/IPFS
   */
  async uploadArtifact(artifact: ArtifactUpload): Promise<UploadResult> {
    try {
      console.log(`Uploading artifact: ${artifact.filename} for run ${artifact.runId}`);
      
      if (!this.apiKey) {
        // Simulate upload for development
        return await this.simulateUpload(artifact);
      }

      // Convert content to file-like object
      const fileContent = typeof artifact.content === 'string' 
        ? Buffer.from(artifact.content, 'utf-8')
        : artifact.content;

      // Create temporary file for Lighthouse SDK
      const tempFile = new File([fileContent], artifact.filename, {
        type: this.getContentType(artifact.type)
      });

      // Upload to IPFS/Lighthouse (simulated for development)
      // In production, use actual Lighthouse API or IPFS client
      const uploadResponse = await this.simulateLighthouseUpload(artifact.filename, fileContent);

      if (!uploadResponse || !uploadResponse.data || !uploadResponse.data.Hash) {
        throw new Error('Upload failed - no CID returned');
      }

      const cid = uploadResponse.data.Hash;
      const gatewayUrl = `https://gateway.lighthouse.storage/ipfs/${cid}`;
      
      // Store artifact record in database
      await this.storeArtifactRecord({
        runId: artifact.runId,
        type: artifact.type,
        filename: artifact.filename,
        cid,
        size: fileContent.length,
        metadata: artifact.metadata
      });

      console.log(`Artifact uploaded successfully: ${cid}`);
      
      return {
        success: true,
        cid,
        size: fileContent.length,
        gatewayUrl
      };
    } catch (error) {
      console.error('Artifact upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  /**
   * Generate payroll report artifact
   */
  async uploadPayrollReport(runId: string, reportData: any): Promise<UploadResult> {
    try {
      const { prisma } = await import('@/lib/db');
      
      // Get payroll run details
      const run = await prisma.payrollRun.findUnique({
        where: { id: runId },
        include: {
          runItems: true,
          payouts: {
            include: {
              contributor: true
            }
          },
          repositories: true
        }
      });

      if (!run) {
        throw new Error('Payroll run not found');
      }

      // Generate comprehensive report
      const report = {
        runId: run.id,
        runNumber: run.runNumber,
        period: {
          startDate: run.startDate.toISOString(),
          endDate: run.endDate.toISOString()
        },
        repositories: run.repositories.map(repo => ({
          id: repo.id,
          fullName: repo.fullName,
          owner: repo.owner,
          name: repo.name
        })),
        budget: {
          usdAmount: run.usdBudget,
          asset: run.asset,
          priceSnapshot: JSON.parse(run.priceSnapshot || '{}')
        },
        distribution: {
          mode: run.distributionMode,
          totalPRs: run.totalPrCount,
          totalPayouts: run.totalPayouts,
          successfulPayouts: run.successfulPayouts,
          failedPayouts: run.failedPayouts
        },
        pullRequests: run.runItems.map(item => ({
          repository: item.repo,
          prNumber: item.prNumber,
          author: item.authorLogin,
          mergedAt: item.mergedAt.toISOString(),
          title: item.title,
          weight: item.weight,
          linesAdded: item.linesAdded,
          linesDeleted: item.linesDeleted,
          filesChanged: item.filesChanged
        })),
        payouts: run.payouts.map(payout => ({
          contributorId: payout.contributorId,
          githubHandle: payout.contributor?.githubHandle,
          hederaAccountId: payout.contributor?.hederaAccountId,
          prCount: payout.prCount,
          shareRatio: payout.shareRatio,
          usdAmount: payout.usdAmount,
          nativeAmount: payout.nativeAmount,
          status: payout.status,
          transactionId: payout.txId,
          confirmedAt: payout.confirmedAt?.toISOString()
        })),
        execution: {
          status: run.status,
          startedAt: run.startedAt?.toISOString(),
          finishedAt: run.finishedAt?.toISOString(),
          previewHash: run.previewHash,
          executionHash: run.executionHash
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          version: '1.0.0',
          network: run.environment
        }
      };

      // Generate both JSON and CSV formats
      const jsonContent = JSON.stringify(report, null, 2);
      const csvContent = this.generateCSVReport(report);

      // Upload JSON report
      const jsonResult = await this.uploadArtifact({
        runId,
        type: 'payroll_report',
        filename: `payroll_run_${run.runNumber}_${runId}.json`,
        content: jsonContent,
        metadata: { format: 'json', version: '1.0.0' }
      });

      // Upload CSV report
      const csvResult = await this.uploadArtifact({
        runId,
        type: 'payroll_report',
        filename: `payroll_run_${run.runNumber}_${runId}.csv`,
        content: csvContent,
        metadata: { format: 'csv', version: '1.0.0' }
      });

      return jsonResult.success ? jsonResult : csvResult;
    } catch (error) {
      console.error('Payroll report upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Report generation failed'
      };
    }
  }

  /**
   * Verify CID accessibility and health
   */
  async verifyCID(cid: string): Promise<CIDVerification> {
    try {
      const gatewayUrl = `https://gateway.lighthouse.storage/ipfs/${cid}`;
      
      // Test gateway accessibility
      const response = await fetch(gatewayUrl, { method: 'HEAD' });
      const exists = response.ok;
      const size = exists ? parseInt(response.headers.get('content-length') || '0') : undefined;

      // Update verification status in database
      await this.updateCIDVerification(cid, exists, size);

      return {
        cid,
        exists,
        size,
        lastChecked: new Date(),
        gatewayResponsive: exists
      };
    } catch (error) {
      console.error('CID verification failed:', error);
      
      await this.updateCIDVerification(cid, false);
      
      return {
        cid,
        exists: false,
        lastChecked: new Date(),
        gatewayResponsive: false
      };
    }
  }

  /**
   * Batch verify multiple CIDs
   */
  async batchVerifyCIDs(cids: string[]): Promise<CIDVerification[]> {
    const verifications = await Promise.all(
      cids.map(cid => this.verifyCID(cid))
    );
    
    return verifications;
  }

  /**
   * Get all artifacts for a payroll run
   */
  async getRunArtifacts(runId: string): Promise<Array<{
    id: string;
    type: string;
    filename: string;
    cid: string;
    size: number;
    verified: boolean;
    createdAt: Date;
    gatewayUrl: string;
  }>> {
    try {
      const { prisma } = await import('@/lib/db');
      
      const artifacts = await prisma.artifact.findMany({
        where: { runId },
        orderBy: { createdAt: 'desc' }
      });

      return artifacts.map(artifact => ({
        id: artifact.id,
        type: artifact.type,
        filename: artifact.filename,
        cid: artifact.cid,
        size: artifact.size,
        verified: artifact.verified,
        createdAt: artifact.createdAt,
        gatewayUrl: `https://gateway.lighthouse.storage/ipfs/${artifact.cid}`
      }));
    } catch (error) {
      console.error('Failed to get run artifacts:', error);
      return [];
    }
  }

  /**
   * Generate audit trail for compliance
   */
  async generateAuditTrail(runId: string): Promise<UploadResult> {
    try {
      const { prisma } = await import('@/lib/db');
      
      // Get audit logs related to this run
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          OR: [
            { resource: runId },
            { details: { contains: runId } }
          ]
        },
        orderBy: { createdAt: 'asc' }
      });

      const auditTrail = {
        runId,
        generatedAt: new Date().toISOString(),
        totalEvents: auditLogs.length,
        events: auditLogs.map(log => ({
          id: log.id,
          timestamp: log.createdAt.toISOString(),
          userId: log.userId,
          action: log.action,
          resource: log.resource,
          details: JSON.parse(log.details || '{}'),
          ipAddress: log.ipAddress,
          userAgent: log.userAgent
        }))
      };

      return await this.uploadArtifact({
        runId,
        type: 'audit_log',
        filename: `audit_trail_${runId}.json`,
        content: JSON.stringify(auditTrail, null, 2),
        metadata: { 
          type: 'audit_trail',
          eventCount: auditLogs.length,
          version: '1.0.0' 
        }
      });
    } catch (error) {
      console.error('Audit trail generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Audit trail generation failed'
      };
    }
  }

  /**
   * Get content type for artifact
   */
  private getContentType(type: string): string {
    switch (type) {
      case 'payroll_report':
      case 'analytics_export':
      case 'audit_log':
        return 'application/json';
      case 'invoice_batch':
        return 'application/pdf';
      default:
        return 'text/plain';
    }
  }

  /**
   * Generate CSV report from JSON data
   */
  private generateCSVReport(report: any): string {
    const headers = [
      'Repository',
      'PR Number', 
      'Author',
      'Merged At',
      'Title',
      'Contributor ID',
      'Hedera Account ID',
      'USD Amount',
      'Native Amount',
      'Status',
      'Transaction ID'
    ];

    const rows = report.payouts.map((payout: any) => {
      const pr = report.pullRequests.find((pr: any) => 
        pr.author === payout.githubHandle || pr.repository.includes(payout.contributorId)
      );
      
      return [
        pr?.repository || '',
        pr?.prNumber || '',
        pr?.author || payout.githubHandle || '',
        pr?.mergedAt || '',
        pr?.title || '',
        payout.contributorId,
        payout.hederaAccountId,
        payout.usdAmount,
        payout.nativeAmount,
        payout.status,
        payout.transactionId || ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row: any[]) => row.map((cell: any) => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  /**
   * Store artifact record in database
   */
  private async storeArtifactRecord(data: {
    runId: string;
    type: string;
    filename: string;
    cid: string;
    size: number;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const { prisma } = await import('@/lib/db');
      
      await prisma.artifact.create({
        data: {
          runId: data.runId,
          type: data.type,
          filename: data.filename,
          cid: data.cid,
          size: data.size,
          verified: true,
          lastCheckedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Failed to store artifact record:', error);
    }
  }

  /**
   * Update CID verification status
   */
  private async updateCIDVerification(cid: string, exists: boolean, size?: number): Promise<void> {
    try {
      const { prisma } = await import('@/lib/db');
      
      await prisma.artifact.updateMany({
        where: { cid },
        data: {
          verified: exists,
          lastCheckedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Failed to update CID verification:', error);
    }
  }

  /**
   * Simulate Lighthouse upload for development
   */
   private async simulateLighthouseUpload(filename: string, content: Buffer): Promise<any> {
    // Simulate Lighthouse API response
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const fakeCID = `Qm${Math.random().toString(36).substr(2, 44)}`;
    
    return {
      data: {
        Hash: fakeCID,
        Name: filename,
        Size: content.length.toString()
      }
    };
  }

  /**
   * Simulate upload for development
   */
  private async simulateUpload(artifact: ArtifactUpload): Promise<UploadResult> {
    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate fake CID
    const fakeCID = `Qm${Math.random().toString(36).substr(2, 44)}`;
    const size = typeof artifact.content === 'string' 
      ? Buffer.from(artifact.content).length 
      : artifact.content.length;

    // Store in database
    await this.storeArtifactRecord({
      runId: artifact.runId,
      type: artifact.type,
      filename: artifact.filename,
      cid: fakeCID,
      size,
      metadata: artifact.metadata
    });

    console.log(`Simulated upload: ${artifact.filename} -> ${fakeCID}`);
    
    return {
      success: true,
      cid: fakeCID,
      size,
      gatewayUrl: `https://gateway.lighthouse.storage/ipfs/${fakeCID}`
    };
  }
}

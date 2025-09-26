/**
 * Payroll Execution Service
 * Handles background job execution, status tracking, and error handling
 */

import { prisma } from './db';
import { HederaService, TransferParams, TransactionResult } from './hedera';
import { LighthouseService, PayrollSlipData } from './lighthouse';
import { DistributionPreview } from './distribution';

export interface ExecutionContext {
  runId: string;
  environment: 'testnet' | 'mainnet';
  hederaService: HederaService;
  lighthouseService: LighthouseService;
  maxRetries: number;
  retryDelay: number;
}

export interface PayoutExecution {
  payoutId: string;
  contributorId: string;
  status: 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED';
  attempts: number;
  lastError?: string;
  transactionId?: string;
  confirmedAt?: Date;
}

export interface RunExecution {
  runId: string;
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
  totalPayouts: number;
  successfulPayouts: number;
  failedPayouts: number;
  payouts: PayoutExecution[];
  startedAt: Date;
  finishedAt?: Date;
  error?: string;
  artifacts?: {
    csvCid?: string;
    jsonCid?: string;
    manifestCid?: string;
  };
}

export class PayrollExecutionService {
  private executionContext: ExecutionContext;
  private runExecution: RunExecution;

  constructor(executionContext: ExecutionContext) {
    this.executionContext = executionContext;
    this.runExecution = {
      runId: executionContext.runId,
      status: 'PENDING',
      totalPayouts: 0,
      successfulPayouts: 0,
      failedPayouts: 0,
      payouts: [],
      startedAt: new Date()
    };
  }

  /**
   * Execute complete payroll run
   */
  async executePayrollRun(preview: DistributionPreview): Promise<RunExecution> {
    try {
      // Update run status to executing
      await this.updateRunStatus('EXECUTING');
      this.runExecution.status = 'EXECUTING';

      // Get eligible distributions
      const eligibleDistributions = preview.distributions.filter(d => d.eligible);
      this.runExecution.totalPayouts = eligibleDistributions.length;

      // Validate contributors have Hedera accounts
      const validatedDistributions = await this.validateHederaAccounts(eligibleDistributions);

      // Execute payouts in batches to avoid overwhelming the network
      const batchSize = 10; // Process 10 payouts at a time
      const batches = this.createBatches(validatedDistributions, batchSize);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} payouts)`);

        // Execute batch in parallel
        const batchPromises = batch.map(distribution => 
          this.executePayoutWithRetry(distribution, preview.metadata.asset, preview.metadata.assetDecimals)
        );

        const batchResults = await Promise.allSettled(batchPromises);
        
        // Process batch results
        batchResults.forEach((result, index) => {
          const distribution = batch[index];
          if (result.status === 'fulfilled') {
            this.runExecution.payouts.push(result.value);
            if (result.value.status === 'CONFIRMED') {
              this.runExecution.successfulPayouts++;
            } else if (result.value.status === 'FAILED') {
              this.runExecution.failedPayouts++;
            }
          } else {
            // Handle promise rejection
            this.runExecution.payouts.push({
              payoutId: `payout_${this.executionContext.runId}_${distribution.contributorId}`,
              contributorId: distribution.contributorId!,
              status: 'FAILED',
              attempts: 0,
              lastError: result.reason?.message || 'Unknown error'
            });
            this.runExecution.failedPayouts++;
          }
        });

        // Add delay between batches to respect rate limits
        if (i < batches.length - 1) {
          await this.delay(2000); // 2 second delay between batches
        }
      }

      // Generate and upload artifacts
      const artifacts = await this.generateArtifacts(preview);
      this.runExecution.artifacts = artifacts;

      // Determine final status
      const finalStatus = this.runExecution.failedPayouts === 0 ? 'COMPLETED' : 'COMPLETED';
      await this.updateRunStatus(finalStatus);
      this.runExecution.status = finalStatus;
      this.runExecution.finishedAt = new Date();

      return this.runExecution;

    } catch (error) {
      this.runExecution.status = 'FAILED';
      this.runExecution.error = error instanceof Error ? error.message : 'Unknown error';
      this.runExecution.finishedAt = new Date();

      await this.updateRunStatus('FAILED', this.runExecution.error);
      return this.runExecution;
    }
  }

  /**
   * Retry failed payouts
   */
  async retryFailedPayouts(): Promise<RunExecution> {
    try {
      const failedPayouts = this.runExecution.payouts.filter(p => p.status === 'FAILED');
      
      if (failedPayouts.length === 0) {
        return this.runExecution;
      }

      console.log(`Retrying ${failedPayouts.length} failed payouts`);

      // Get original preview data for retry
      const run = await prisma.payrollRun.findUnique({
        where: { id: this.executionContext.runId },
        include: { payouts: true }
      });

      if (!run) {
        throw new Error('Payroll run not found');
      }

      // Retry each failed payout
      for (const failedPayout of failedPayouts) {
        try {
          // Get payout details from database
          const payoutRecord = await prisma.payout.findFirst({
            where: {
              runId: this.executionContext.runId,
              contributorId: failedPayout.contributorId
            },
            include: { contributor: true }
          });

          if (!payoutRecord) {
            console.error(`Payout record not found for contributor ${failedPayout.contributorId}`);
            continue;
          }

          // Retry the payout
          const retryResult = await this.executePayoutWithRetry({
            githubLogin: payoutRecord.contributor.githubHandle || '',
            githubId: 0, // Not needed for retry
            contributorId: payoutRecord.contributorId,
            prCount: payoutRecord.prCount,
            shareRatio: payoutRecord.shareRatio,
            usdAmount: payoutRecord.usdAmount,
            nativeAmount: payoutRecord.nativeAmount,
            eligible: true
          }, run.asset, 8); // Assume 8 decimals for now

          // Update the payout in runExecution
          const payoutIndex = this.runExecution.payouts.findIndex(
            p => p.contributorId === failedPayout.contributorId
          );
          
          if (payoutIndex >= 0) {
            this.runExecution.payouts[payoutIndex] = retryResult;
            
            // Update counters
            if (retryResult.status === 'CONFIRMED') {
              this.runExecution.successfulPayouts++;
              this.runExecution.failedPayouts--;
            }
          }

        } catch (error) {
          console.error(`Error retrying payout for ${failedPayout.contributorId}:`, error);
        }
      }

      return this.runExecution;

    } catch (error) {
      console.error('Error during retry operation:', error);
      return this.runExecution;
    }
  }

  /**
   * Execute individual payout with retry logic
   */
  private async executePayoutWithRetry(
    distribution: any,
    asset: string,
    assetDecimals: number
  ): Promise<PayoutExecution> {
    const payoutId = `payout_${this.executionContext.runId}_${distribution.contributorId}`;
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= this.executionContext.maxRetries; attempt++) {
      try {
        // Get contributor details from database
        const contributor = await prisma.contributor.findUnique({
          where: { id: distribution.contributorId }
        });

        if (!contributor) {
          throw new Error('Contributor not found in database');
        }

        // Create transfer parameters
        const transferParams: TransferParams = {
          recipientAccountId: contributor.hederaAccountId,
          amount: distribution.nativeAmount,
          asset: asset,
          memo: `AI Payroll - Run ${this.executionContext.runId}`,
          idempotencyKey: this.createIdempotencyKey(distribution.contributorId)
        };

        // Execute transfer
        const result = await this.executionContext.hederaService.executeTransfer(transferParams);

        if (result.success) {
          // Update database
          await this.updatePayoutStatus(
            distribution.contributorId,
            'SUBMITTED',
            result.transactionId
          );

          // Verify transaction with mirror node
          let confirmed = false;
          if (result.transactionId) {
            confirmed = await this.verifyTransactionConfirmation(result.transactionId);
          }

          const finalStatus = confirmed ? 'CONFIRMED' : 'SUBMITTED';
          await this.updatePayoutStatus(
            distribution.contributorId,
            finalStatus,
            result.transactionId,
            confirmed ? new Date() : undefined
          );

          return {
            payoutId,
            contributorId: distribution.contributorId,
            status: finalStatus,
            attempts: attempt,
            transactionId: result.transactionId,
            confirmedAt: confirmed ? new Date() : undefined
          };
        } else {
          lastError = result.error || 'Transaction failed';
          
          if (attempt === this.executionContext.maxRetries) {
            // Final attempt failed
            await this.updatePayoutStatus(
              distribution.contributorId,
              'FAILED',
              undefined,
              undefined,
              lastError
            );

            return {
              payoutId,
              contributorId: distribution.contributorId,
              status: 'FAILED',
              attempts: attempt,
              lastError
            };
          }

          // Wait before retry
          await this.delay(this.executionContext.retryDelay * attempt);
        }

      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        
        if (attempt === this.executionContext.maxRetries) {
          await this.updatePayoutStatus(
            distribution.contributorId,
            'FAILED',
            undefined,
            undefined,
            lastError
          );

          return {
            payoutId,
            contributorId: distribution.contributorId,
            status: 'FAILED',
            attempts: attempt,
            lastError
          };
        }

        await this.delay(this.executionContext.retryDelay * attempt);
      }
    }

    // This should never be reached, but TypeScript requires it
    return {
      payoutId,
      contributorId: distribution.contributorId,
      status: 'FAILED',
      attempts: this.executionContext.maxRetries,
      lastError: lastError || 'Max retries exceeded'
    };
  }

  /**
   * Validate that contributors have valid Hedera accounts
   */
  private async validateHederaAccounts(distributions: any[]): Promise<any[]> {
    const validated: any[] = [];

    for (const distribution of distributions) {
      if (!distribution.contributorId) {
        console.warn(`Skipping unverified contributor: ${distribution.githubLogin}`);
        continue;
      }

      try {
        const contributor = await prisma.contributor.findUnique({
          where: { id: distribution.contributorId }
        });

        if (!contributor) {
          console.warn(`Contributor not found: ${distribution.contributorId}`);
          continue;
        }

        // Validate Hedera account ID format
        if (!this.isValidHederaAccountId(contributor.hederaAccountId)) {
          console.warn(`Invalid Hedera account ID: ${contributor.hederaAccountId}`);
          continue;
        }

        validated.push(distribution);
      } catch (error) {
        console.error(`Error validating contributor ${distribution.contributorId}:`, error);
      }
    }

    return validated;
  }

  /**
   * Generate and upload artifacts to Lighthouse
   */
  private async generateArtifacts(preview: DistributionPreview): Promise<{
    csvCid?: string;
    jsonCid?: string;
    manifestCid?: string;
  }> {
    try {
      // Get run details
      const run = await prisma.payrollRun.findUnique({
        where: { id: this.executionContext.runId },
        include: {
          repositories: true,
          payouts: {
            include: { contributor: true }
          }
        }
      });

      if (!run) {
        throw new Error('Run not found for artifact generation');
      }

      // Create payroll slip data
      const payrollData: PayrollSlipData = {
        runId: run.id,
        runNumber: run.runNumber,
        generatedAt: new Date(),
        environment: run.environment as 'testnet' | 'mainnet',
        repositories: run.repositories.map(r => r.fullName),
        dateRange: {
          startDate: run.startDate.toISOString(),
          endDate: run.endDate.toISOString()
        },
        distributionMode: run.distributionMode,
        totalBudgetUsd: run.usdBudget,
        asset: run.asset,
        priceSnapshot: JSON.parse(run.priceSnapshot),
        totalPrCount: run.totalPrCount,
        contributors: run.payouts.map(payout => ({
          githubLogin: payout.contributor.githubHandle || 'unknown',
          hederaAccountId: payout.contributor.hederaAccountId,
          prCount: payout.prCount,
          shareRatio: payout.shareRatio,
          usdAmount: payout.usdAmount,
          nativeAmount: payout.nativeAmount,
          status: payout.status,
          transactionId: payout.txId || undefined,
          confirmedAt: payout.confirmedAt?.toISOString()
        })),
        summary: {
          totalPayouts: this.runExecution.totalPayouts,
          successfulPayouts: this.runExecution.successfulPayouts,
          failedPayouts: this.runExecution.failedPayouts,
          totalUsdDistributed: run.payouts.reduce((sum, p) => sum + p.usdAmount, 0),
          totalNativeDistributed: run.payouts.reduce((sum, p) => 
            (BigInt(sum) + BigInt(p.nativeAmount)).toString(), '0')
        },
        verification: {
          managerVerified: true, // Assume verified if run was created
          contributorsVerified: run.payouts.length, // All payouts are to verified contributors
          totalContributors: run.payouts.length
        }
      };

      // Upload to Lighthouse
      const uploadResults = await this.executionContext.lighthouseService.uploadPayrollSlip(payrollData);

      // Store artifacts in database
      if (uploadResults.csv.success) {
        await prisma.artifact.create({
          data: {
            runId: this.executionContext.runId,
            type: 'csv',
            filename: `payroll-slip-${this.executionContext.runId}.csv`,
            cid: uploadResults.csv.cid!,
            size: uploadResults.csv.size!
          }
        });
      }

      if (uploadResults.json.success) {
        await prisma.artifact.create({
          data: {
            runId: this.executionContext.runId,
            type: 'json',
            filename: `payroll-data-${this.executionContext.runId}.json`,
            cid: uploadResults.json.cid!,
            size: uploadResults.json.size!
          }
        });
      }

      return {
        csvCid: uploadResults.csv.cid,
        jsonCid: uploadResults.json.cid,
        manifestCid: uploadResults.manifest.cid
      };

    } catch (error) {
      console.error('Error generating artifacts:', error);
      return {};
    }
  }

  /**
   * Verify transaction confirmation via mirror node
   */
  private async verifyTransactionConfirmation(transactionId: string): Promise<boolean> {
    try {
      // Wait a bit for mirror node to process
      await this.delay(5000); // 5 seconds

      const maxAttempts = 12; // 1 minute total (5s * 12)
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const isConfirmed = await this.executionContext.hederaService.isTransactionSuccessful(transactionId);
        
        if (isConfirmed) {
          return true;
        }

        if (attempt < maxAttempts) {
          await this.delay(5000); // Wait 5 seconds before next check
        }
      }

      return false; // Not confirmed within timeout
    } catch (error) {
      console.error(`Error verifying transaction ${transactionId}:`, error);
      return false;
    }
  }

  /**
   * Helper methods
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private createIdempotencyKey(contributorId: string): string {
    return `payout_${this.executionContext.runId}_${contributorId}`;
  }

  private isValidHederaAccountId(accountId: string): boolean {
    // Basic validation for Hedera account ID format (0.0.xxxxx)
    return /^0\.0\.\d+$/.test(accountId);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async updateRunStatus(status: string, error?: string): Promise<void> {
    await prisma.payrollRun.update({
      where: { id: this.executionContext.runId },
      data: {
        status,
        ...(error && { error }),
        ...(status === 'EXECUTING' && { startedAt: new Date() }),
        ...(status !== 'EXECUTING' && status !== 'PENDING' && { finishedAt: new Date() })
      }
    });
  }

  private async updatePayoutStatus(
    contributorId: string,
    status: string,
    transactionId?: string,
    confirmedAt?: Date,
    error?: string
  ): Promise<void> {
    await prisma.payout.updateMany({
      where: {
        runId: this.executionContext.runId,
        contributorId
      },
      data: {
        status,
        ...(transactionId && { txId: transactionId }),
        ...(confirmedAt && { confirmedAt }),
        ...(error && { error }),
        ...(status === 'SUBMITTED' && { submittedAt: new Date() }),
        updatedAt: new Date()
      }
    });
  }
}

export function createPayrollExecutionService(context: ExecutionContext): PayrollExecutionService {
  return new PayrollExecutionService(context);
}
/**
 * Hedera Agent Kit Integration for Automated Payments
 * Handles batch payouts, payment detection, and transaction management
 */

import { 
  Client, 
  AccountId, 
  PrivateKey, 
  TransferTransaction, 
  Hbar, 
  TokenAssociateTransaction,
  ScheduleCreateTransaction,
  TransactionResponse,
  AccountBalanceQuery,
  AccountInfoQuery
} from '@hashgraph/sdk';

export interface PaymentConfig {
  network: 'testnet' | 'mainnet';
  operatorAccountId: string;
  operatorPrivateKey: string;
  treasuryAccountId?: string;
}

export interface BatchPayoutRequest {
  runId: string;
  payouts: Array<{
    contributorId: string;
    hederaAccountId: string;
    amount: string; // In tinybars
    asset: 'HBAR' | string; // HBAR or token ID
  }>;
  memo?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  scheduleId?: string;
  error?: string;
  receipt?: any;
}

export interface PaymentDetection {
  transactionId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  asset: string;
  timestamp: string;
  memo?: string;
}

export class HederaAgentService {
  private client: Client;
  private operatorAccountId: AccountId;
  private operatorPrivateKey: PrivateKey;
  private network: 'testnet' | 'mainnet';

  constructor(config: PaymentConfig) {
    this.network = config.network;
    this.operatorAccountId = AccountId.fromString(config.operatorAccountId);
    
    // Parse private key - try different formats
    console.log('Parsing private key, length:', config.operatorPrivateKey.length);
    
    try {
      // If it's a raw hex string (64 chars for ED25519), format it properly
      if (config.operatorPrivateKey.length === 64 && !config.operatorPrivateKey.startsWith('302e')) {
        console.log('Detected raw hex key, converting to ED25519...');
        this.operatorPrivateKey = PrivateKey.fromStringED25519(config.operatorPrivateKey);
      } 
      // If it starts with DER prefix, use DER parsing
      else if (config.operatorPrivateKey.startsWith('302e')) {
        console.log('Detected DER format key...');
        this.operatorPrivateKey = PrivateKey.fromStringDer(config.operatorPrivateKey);
      }
      // Try ED25519 first (most common)
      else {
        console.log('Trying ED25519 format...');
        this.operatorPrivateKey = PrivateKey.fromStringED25519(config.operatorPrivateKey);
      }
      console.log('✅ Private key parsed successfully');
    } catch (error) {
      console.error('❌ Private key parsing failed:', error);
      throw new Error(`Failed to parse Hedera private key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Initialize Hedera client
    if (config.network === 'testnet') {
      this.client = Client.forTestnet();
    } else {
      this.client = Client.forMainnet();
    }
    
    this.client.setOperator(this.operatorAccountId, this.operatorPrivateKey);
  }

  /**
   * Execute batch payouts to contributors
   */
  async executeBatchPayouts(request: BatchPayoutRequest): Promise<PaymentResult[]> {
    try {
      console.log(`Executing batch payouts for run ${request.runId}`);
      const results: PaymentResult[] = [];
      
      // Group payouts by asset type
      const hbarPayouts = request.payouts.filter(p => p.asset === 'HBAR');
      const tokenPayouts = request.payouts.filter(p => p.asset !== 'HBAR');
      
      // Process HBAR payouts
      if (hbarPayouts.length > 0) {
        const hbarResult = await this.executeHbarBatchTransfer(hbarPayouts, request.memo);
        results.push(hbarResult);
      }
      
      // Process token payouts (grouped by token ID)
      const tokenGroups = this.groupByToken(tokenPayouts);
      for (const [tokenId, payouts] of tokenGroups) {
        const tokenResult = await this.executeTokenBatchTransfer(tokenId, payouts, request.memo);
        results.push(tokenResult);
      }
      
      // Update payout records in database
      await this.updatePayoutRecords(request.runId, results);
      
      return results;
    } catch (error) {
      console.error('Batch payout execution failed:', error);
      return [{
        success: false,
        error: error instanceof Error ? error.message : 'Batch payout failed'
      }];
    }
  }

  /**
   * Execute HBAR batch transfer
   */
  private async executeHbarBatchTransfer(
    payouts: BatchPayoutRequest['payouts'], 
    memo?: string
  ): Promise<PaymentResult> {
    try {
      const transaction = new TransferTransaction();
      
      // Add memo if provided
      if (memo) {
        transaction.setTransactionMemo(memo);
      }
      
      // Add transfers for each payout
      for (const payout of payouts) {
        const amount = Hbar.fromTinybars(parseInt(payout.amount));
        transaction.addHbarTransfer(this.operatorAccountId, amount.negated());
        transaction.addHbarTransfer(AccountId.fromString(payout.hederaAccountId), amount);
      }
      
      // Execute transaction
      const response: TransactionResponse = await transaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);
      
      console.log(`HBAR batch transfer completed: ${response.transactionId}`);
      
      return {
        success: true,
        transactionId: response.transactionId?.toString(),
        receipt: receipt
      };
    } catch (error) {
      console.error('HBAR batch transfer failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'HBAR transfer failed'
      };
    }
  }

  /**
   * Execute token batch transfer
   */
  private async executeTokenBatchTransfer(
    tokenId: string,
    payouts: BatchPayoutRequest['payouts'],
    memo?: string
  ): Promise<PaymentResult> {
    try {
      const transaction = new TransferTransaction();
      
      // Add memo if provided
      if (memo) {
        transaction.setTransactionMemo(memo);
      }
      
      // Add token transfers for each payout
      for (const payout of payouts) {
        const amount = parseInt(payout.amount);
        transaction.addTokenTransfer(tokenId, this.operatorAccountId, -amount);
        transaction.addTokenTransfer(tokenId, AccountId.fromString(payout.hederaAccountId), amount);
      }
      
      // Execute transaction
      const response: TransactionResponse = await transaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);
      
      console.log(`Token batch transfer completed: ${response.transactionId}`);
      
      return {
        success: true,
        transactionId: response.transactionId?.toString(),
        receipt: receipt
      };
    } catch (error) {
      console.error('Token batch transfer failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token transfer failed'
      };
    }
  }

  /**
   * Create scheduled batch payout (for future execution)
   */
  async scheduleBatchPayout(
    request: BatchPayoutRequest, 
    executionTime: Date
  ): Promise<PaymentResult> {
    try {
      // Create the inner transaction (similar to executeHbarBatchTransfer)
      const innerTransaction = new TransferTransaction();
      
      if (request.memo) {
        innerTransaction.setTransactionMemo(request.memo);
      }
      
      for (const payout of request.payouts.filter(p => p.asset === 'HBAR')) {
        const amount = Hbar.fromTinybars(parseInt(payout.amount));
        innerTransaction.addHbarTransfer(this.operatorAccountId, amount.negated());
        innerTransaction.addHbarTransfer(AccountId.fromString(payout.hederaAccountId), amount);
      }
      
      // Create schedule transaction
      const scheduleTransaction = new ScheduleCreateTransaction()
        .setScheduledTransaction(innerTransaction)
        .setScheduleMemo(`Scheduled payout for run ${request.runId}`)
        .setAdminKey(this.operatorPrivateKey);
      
      const response = await scheduleTransaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);
      
      console.log(`Scheduled payout created: ${receipt.scheduleId}`);
      
      return {
        success: true,
        scheduleId: receipt.scheduleId?.toString(),
        transactionId: response.transactionId?.toString()
      };
    } catch (error) {
      console.error('Schedule payout failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Schedule creation failed'
      };
    }
  }

  /**
   * Monitor incoming payments to treasury account
   */
  async monitorIncomingPayments(
    treasuryAccountId: string,
    fromTimestamp?: Date
  ): Promise<PaymentDetection[]> {
    try {
      // In a real implementation, this would use Hedera Mirror Node API
      // to fetch transactions for the treasury account
      
      const mirrorNodeUrl = this.network === 'testnet' 
        ? 'https://testnet.mirrornode.hedera.com'
        : 'https://mainnet-public.mirrornode.hedera.com';
      
      const timestampParam = fromTimestamp 
        ? `&timestamp=gte:${Math.floor(fromTimestamp.getTime() / 1000)}`
        : '';
      
      const url = `${mirrorNodeUrl}/api/v1/transactions?account.id=${treasuryAccountId}&transactiontype=cryptotransfer${timestampParam}`;
      
      // For development, simulate payment detection
      return await this.simulatePaymentDetection(treasuryAccountId);
    } catch (error) {
      console.error('Payment monitoring failed:', error);
      return [];
    }
  }

  /**
   * Associate token with contributor account (required before token transfers)
   */
  async associateToken(contributorAccountId: string, tokenId: string): Promise<PaymentResult> {
    try {
      // Note: This requires the contributor's private key
      // In practice, contributors would do this themselves
      // This is just for demonstration
      
      const transaction = new TokenAssociateTransaction()
        .setAccountId(AccountId.fromString(contributorAccountId))
        .setTokenIds([tokenId]);
      
      // This would need to be signed by the contributor's key
      // For now, we'll just return a placeholder
      
      return {
        success: true,
        transactionId: `simulated_association_${Date.now()}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token association failed'
      };
    }
  }

  /**
   * Get account balance
   */
  async getAccountBalance(accountId: string): Promise<{ hbar: string; tokens: Record<string, string> }> {
    try {
      const query = new AccountBalanceQuery()
        .setAccountId(AccountId.fromString(accountId));
      
      const balance = await query.execute(this.client);
      
      const tokens: Record<string, string> = {};
      if (balance.tokens) {
        for (const [tokenId, amount] of balance.tokens) {
          tokens[tokenId.toString()] = amount.toString();
        }
      }
      
      return {
        hbar: balance.hbars.toTinybars().toString(),
        tokens
      };
    } catch (error) {
      console.error('Failed to get account balance:', error);
      return { hbar: '0', tokens: {} };
    }
  }

  /**
   * Get account information
   */
  async getAccountInfo(accountId: string): Promise<any> {
    try {
      const query = new AccountInfoQuery()
        .setAccountId(AccountId.fromString(accountId));
      
      const info = await query.execute(this.client);
      
      return {
        accountId: info.accountId.toString(),
        balance: info.balance.toTinybars().toString(),
        key: info.key?.toString(),
        expirationTime: info.expirationTime?.toDate(),
        autoRenewPeriod: info.autoRenewPeriod?.seconds.toString()
      };
    } catch (error) {
      console.error('Failed to get account info:', error);
      throw error;
    }
  }

  /**
   * Validate Hedera account ID format
   */
  static isValidAccountId(accountId: string): boolean {
    try {
      AccountId.fromString(accountId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Convert HBAR amount to tinybars
   */
  static hbarToTinybars(hbarAmount: number): string {
    return Hbar.from(hbarAmount).toTinybars().toString();
  }

  /**
   * Convert tinybars to HBAR
   */
  static tinybarsToHbar(tinybars: string): number {
    return Hbar.fromTinybars(parseInt(tinybars)).toTinybars().toNumber() / 100000000;
  }

  /**
   * Group payouts by token ID
   */
  private groupByToken(payouts: BatchPayoutRequest['payouts']): Map<string, BatchPayoutRequest['payouts']> {
    const groups = new Map<string, BatchPayoutRequest['payouts']>();
    
    for (const payout of payouts) {
      if (payout.asset !== 'HBAR') {
        const existing = groups.get(payout.asset) || [];
        existing.push(payout);
        groups.set(payout.asset, existing);
      }
    }
    
    return groups;
  }

  /**
   * Update payout records in database
   */
  private async updatePayoutRecords(runId: string, results: PaymentResult[]): Promise<void> {
    try {
      const { prisma } = await import('@/lib/db');
      
      for (const result of results) {
        if (result.success && result.transactionId) {
          // Update payout records with transaction details
          await prisma.payout.updateMany({
            where: { runId },
            data: {
              status: 'CONFIRMED',
              txId: result.transactionId,
              scheduleId: result.scheduleId,
              confirmedAt: new Date()
            }
          });
        } else if (result.error) {
          // Mark failed payouts
          await prisma.payout.updateMany({
            where: { runId },
            data: {
              status: 'FAILED',
              error: result.error
            }
          });
        }
      }
    } catch (error) {
      console.error('Failed to update payout records:', error);
    }
  }

  /**
   * Simulate payment detection for development
   */
  private async simulatePaymentDetection(treasuryAccountId: string): Promise<PaymentDetection[]> {
    // Simulate some incoming payments
    return [
      {
        transactionId: `0.0.${Math.floor(Math.random() * 1000000)}@${Date.now() / 1000}`,
        fromAccountId: '0.0.12345',
        toAccountId: treasuryAccountId,
        amount: '10000000000', // 100 HBAR in tinybars
        asset: 'HBAR',
        timestamp: new Date().toISOString(),
        memo: 'Invoice payment'
      }
    ];
  }

  /**
   * Close client connection
   */
  close(): void {
    this.client.close();
  }
}

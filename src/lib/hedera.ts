/**
 * Hedera Hashgraph Integration Service
 * Handles direct transfers, scheduled transactions, and mirror node verification
 */

import {
  Client,
  AccountId,
  PrivateKey,
  TransferTransaction,
  Hbar,
  ScheduleCreateTransaction,
  ScheduleSignTransaction,
  TransactionId,
  TransactionReceipt,
  TransactionRecord,
  TokenId,
  TokenAssociateTransaction,
  AccountBalanceQuery,
  ScheduleInfoQuery,
  Status,
  Timestamp
} from "@hashgraph/sdk";

export interface HederaConfig {
  network: 'testnet' | 'mainnet';
  accountId: string;
  privateKey: string;
  mirrorNodeUrl: string;
}

export interface TransferParams {
  recipientAccountId: string;
  amount: string; // Amount in smallest unit (tinybars for HBAR)
  asset: string; // 'HBAR' or token ID
  memo?: string;
  idempotencyKey: string;
}

export interface ScheduledTransferParams extends TransferParams {
  requiredSigners: string[]; // Account IDs that must sign
  expirationTime?: Date;
  adminKey?: string; // Private key for schedule admin
}

export interface TransactionResult {
  success: boolean;
  transactionId?: string;
  scheduleId?: string;
  status: string;
  fee?: string;
  error?: string;
  receiptStatus?: Status;
  timestamp?: Date;
}

export interface MirrorNodeTransaction {
  consensus_timestamp: string;
  transaction_id: string;
  result: string;
  transfers: Array<{
    account: string;
    amount: number;
  }>;
  token_transfers?: Array<{
    account: string;
    amount: number;
    token_id: string;
  }>;
}

export class HederaService {
  private client: Client;
  private config: HederaConfig;
  private operatorAccountId: AccountId;
  private operatorPrivateKey: PrivateKey;

  constructor(config: HederaConfig) {
    this.config = config;
    this.operatorAccountId = AccountId.fromString(config.accountId);
    this.operatorPrivateKey = PrivateKey.fromString(config.privateKey);

    // Initialize client based on network
    if (config.network === 'mainnet') {
      this.client = Client.forMainnet();
    } else {
      this.client = Client.forTestnet();
    }

    this.client.setOperator(this.operatorAccountId, this.operatorPrivateKey);
  }

  /**
   * Execute direct HBAR or token transfer
   */
  async executeTransfer(params: TransferParams): Promise<TransactionResult> {
    try {
      const recipientAccount = AccountId.fromString(params.recipientAccountId);
      
      let transaction;
      
      if (params.asset === 'HBAR') {
        // HBAR transfer
        const amount = Hbar.fromTinybars(parseInt(params.amount));
        transaction = new TransferTransaction()
          .addHbarTransfer(this.operatorAccountId, amount.negated())
          .addHbarTransfer(recipientAccount, amount);
      } else {
        // Token transfer
        const tokenId = TokenId.fromString(params.asset);
        transaction = new TokenTransferTransaction()
          .addTokenTransfer(tokenId, this.operatorAccountId, -parseInt(params.amount))
          .addTokenTransfer(tokenId, recipientAccount, parseInt(params.amount));
      }

      // Add memo if provided
      if (params.memo) {
        transaction.setTransactionMemo(params.memo);
      }

      // Set transaction ID for idempotency
      const transactionId = TransactionId.generate(this.operatorAccountId);
      transaction.setTransactionId(transactionId);

      // Execute transaction
      const response = await transaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);

      return {
        success: receipt.status === Status.Success,
        transactionId: transactionId.toString(),
        status: receipt.status.toString(),
        receiptStatus: receipt.status,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Create scheduled transaction for multi-signature approval
   */
  async createScheduledTransfer(params: ScheduledTransferParams): Promise<TransactionResult> {
    try {
      const recipientAccount = AccountId.fromString(params.recipientAccountId);
      
      let innerTransaction;
      
      if (params.asset === 'HBAR') {
        // HBAR transfer
        const amount = Hbar.fromTinybars(parseInt(params.amount));
        innerTransaction = new TransferTransaction()
          .addHbarTransfer(this.operatorAccountId, amount.negated())
          .addHbarTransfer(recipientAccount, amount);
      } else {
        // Token transfer
        const tokenId = TokenId.fromString(params.asset);
        innerTransaction = new TokenTransferTransaction()
          .addTokenTransfer(tokenId, this.operatorAccountId, -parseInt(params.amount))
          .addTokenTransfer(tokenId, recipientAccount, parseInt(params.amount));
      }

      // Add memo if provided
      if (params.memo) {
        innerTransaction.setTransactionMemo(params.memo);
      }

      // Create schedule
      const scheduleTransaction = new ScheduleCreateTransaction()
        .setScheduledTransaction(innerTransaction);

      // Set expiration time if provided
      if (params.expirationTime) {
        scheduleTransaction.setExpirationTime(Timestamp.fromDate(params.expirationTime));
      }

      // Set admin key if provided
      if (params.adminKey) {
        const adminKey = PrivateKey.fromString(params.adminKey);
        scheduleTransaction.setAdminKey(adminKey.publicKey);
      }

      // Execute schedule creation
      const response = await scheduleTransaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);

      return {
        success: receipt.status === Status.Success,
        scheduleId: receipt.scheduleId?.toString(),
        status: receipt.status.toString(),
        receiptStatus: receipt.status,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Sign a scheduled transaction
   */
  async signScheduledTransaction(scheduleId: string, signerPrivateKey: string): Promise<TransactionResult> {
    try {
      const scheduleIdObj = scheduleId;
      const signerKey = PrivateKey.fromString(signerPrivateKey);
      
      const signTransaction = new ScheduleSignTransaction()
        .setScheduleId(scheduleIdObj);

      // Sign with the provided key
      signTransaction.sign(signerKey);

      const response = await signTransaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);

      return {
        success: receipt.status === Status.Success,
        scheduleId,
        status: receipt.status.toString(),
        receiptStatus: receipt.status,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Check if account is associated with a token
   */
  async checkTokenAssociation(accountId: string, tokenId: string): Promise<boolean> {
    try {
      const account = AccountId.fromString(accountId);
      const balance = await new AccountBalanceQuery()
        .setAccountId(account)
        .execute(this.client);

      // Check if token is in the balance map
      if (balance.tokens) {
        return balance.tokens.get(TokenId.fromString(tokenId)) !== undefined;
      }
      return false;
    } catch (error) {
      console.error(`Error checking token association for ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Associate account with token
   */
  async associateToken(accountId: string, tokenId: string, accountPrivateKey: string): Promise<TransactionResult> {
    try {
      const account = AccountId.fromString(accountId);
      const token = TokenId.fromString(tokenId);
      const privateKey = PrivateKey.fromString(accountPrivateKey);

      const transaction = new TokenAssociateTransaction()
        .setAccountId(account)
        .setTokenIds([token]);

      // Sign with account's private key
      transaction.sign(privateKey);

      const response = await transaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);

      return {
        success: receipt.status === Status.Success,
        status: receipt.status.toString(),
        receiptStatus: receipt.status,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Get account balance
   */
  async getAccountBalance(accountId: string): Promise<{ hbar: string; tokens: Map<string, string> }> {
    try {
      const account = AccountId.fromString(accountId);
      const balance = await new AccountBalanceQuery()
        .setAccountId(account)
        .execute(this.client);

      const tokens = new Map<string, string>();
      if (balance.tokens) {
        balance.tokens.forEach((amount: any, tokenId: any) => {
          tokens.set(tokenId.toString(), amount.toString());
        });
      }

      return {
        hbar: balance.hbars.toTinybars().toString(),
        tokens
      };
    } catch (error) {
      throw new Error(`Failed to get account balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get schedule information
   */
  async getScheduleInfo(scheduleId: string) {
    try {
      const schedule = await new ScheduleInfoQuery()
        .setScheduleId(scheduleId)
        .execute(this.client);

      return {
        scheduleId: schedule.scheduleId.toString(),
        creatorAccountId: schedule.creatorAccountId?.toString(),
        payerAccountId: schedule.payerAccountId?.toString(),
        adminKey: schedule.adminKey?.toString(),
        executed: schedule.executed !== null,
        executedAt: schedule.executed,
        expirationTime: schedule.expirationTime,
        memo: schedule.scheduleMemo,
        signatories: schedule.signers?.map((key: any) => key.toString()) || []
      };
    } catch (error) {
      throw new Error(`Failed to get schedule info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify transaction using mirror node
   */
  async verifyTransactionFromMirror(transactionId: string): Promise<MirrorNodeTransaction | null> {
    try {
      const url = `${this.config.mirrorNodeUrl}/api/v1/transactions/${transactionId}`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Transaction not found yet
        }
        throw new Error(`Mirror node API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.transactions && data.transactions.length > 0) {
        return data.transactions[0] as MirrorNodeTransaction;
      }

      return null;
    } catch (error) {
      console.error(`Error verifying transaction ${transactionId}:`, error);
      return null;
    }
  }

  /**
   * Check if transaction was successful from mirror node
   */
  async isTransactionSuccessful(transactionId: string): Promise<boolean> {
    const mirrorTx = await this.verifyTransactionFromMirror(transactionId);
    return mirrorTx?.result === 'SUCCESS';
  }

  /**
   * Get transaction fee from mirror node
   */
  async getTransactionFee(transactionId: string): Promise<string | null> {
    const mirrorTx = await this.verifyTransactionFromMirror(transactionId);
    if (!mirrorTx) return null;

    // Calculate fee from transfers (operator account should have negative transfer for fee)
    const operatorTransfer = mirrorTx.transfers.find(
      transfer => transfer.account === this.operatorAccountId.toString()
    );

    return operatorTransfer ? Math.abs(operatorTransfer.amount).toString() : null;
  }

  /**
   * Close the client connection
   */
  close(): void {
    this.client.close();
  }

  /**
   * Validate account ID format
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
   * Validate token ID format
   */
  static isValidTokenId(tokenId: string): boolean {
    try {
      TokenId.fromString(tokenId);
      return true;
    } catch {
      return false;
    }
  }
}

export function createHederaService(config?: Partial<HederaConfig>): HederaService {
  const fullConfig: HederaConfig = {
    network: (process.env.HEDERA_NETWORK as 'testnet' | 'mainnet') || 'testnet',
    accountId: process.env.HEDERA_ACCOUNT_ID || '',
    privateKey: process.env.HEDERA_PRIVATE_KEY || '',
    mirrorNodeUrl: config?.network === 'mainnet' 
      ? 'https://mainnet.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com',
    ...config
  };

  return new HederaService(fullConfig);
}
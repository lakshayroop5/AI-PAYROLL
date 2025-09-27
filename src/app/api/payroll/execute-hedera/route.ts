/**
 * Execute Payroll via Hedera - Demo Version
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { HederaAgentService } from '@/lib/integrations/hedera-agent';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { payrollRunId = 'demo-run-001' } = await request.json();

    console.log(`🚀 Demo: Executing Hedera payroll for run ${payrollRunId}...`);

    // Demo payroll data (in real app, this would come from database)
    const mockPayrollData = {
      id: payrollRunId,
      title: 'December 2024 Payroll',
      payouts: [
        {
          recipientId: process.env.HEDERA_ACCOUNT_ID!, // Pay to self for demo
          amount: 100, // 100 tinybars = 0.000001 HBAR
          memo: 'AI Payroll Demo Payment 1',
          contributor: 'demo-contributor-1'
        },
        {
          recipientId: process.env.HEDERA_ACCOUNT_ID!, // Pay to self for demo  
          amount: 200, // 200 tinybars = 0.000002 HBAR
          memo: 'AI Payroll Demo Payment 2',
          contributor: 'demo-contributor-2'
        }
      ]
    };

    if (!process.env.HEDERA_ACCOUNT_ID || !process.env.HEDERA_PRIVATE_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Hedera not configured',
        message: 'Please add HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY to .env.local',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Initialize Hedera service
    const hederaService = new HederaAgentService({
      network: (process.env.HEDERA_NETWORK as 'testnet' | 'mainnet') || 'testnet',
      operatorAccountId: process.env.HEDERA_ACCOUNT_ID,
      operatorPrivateKey: process.env.HEDERA_PRIVATE_KEY
    });

    console.log(`💰 Processing ${mockPayrollData.payouts.length} demo payments...`);

    // Prepare batch payout request
    const batchRequest = {
      runId: payrollRunId,
      payouts: mockPayrollData.payouts.map(p => ({
        contributorId: p.contributor,
        hederaAccountId: p.recipientId,
        amount: p.amount.toString(), // Convert to string as required
        asset: 'HBAR' as const
      })),
      memo: 'AI Payroll System Demo Payment'
    };

    // Execute batch payment on Hedera
    const paymentResults = await hederaService.executeBatchPayouts(batchRequest);

    // Check if all payments succeeded
    const successfulPayments = paymentResults.filter(result => result.success);
    const failedPayments = paymentResults.filter(result => !result.success);

    if (successfulPayments.length > 0) {
      console.log(`✅ Demo payroll executed! ${successfulPayments.length}/${paymentResults.length} payments successful`);

      return NextResponse.json({
        success: true,
        message: `Demo payroll executed via Hedera! ${successfulPayments.length}/${paymentResults.length} payments successful`,
        data: {
          payrollRunId,
          paymentsTotal: paymentResults.length,
          paymentsSuccessful: successfulPayments.length,
          paymentsFailed: failedPayments.length,
          transactions: successfulPayments.map(result => ({
            transactionId: result.transactionId,
            hederaExplorer: `https://hashscan.io/${process.env.HEDERA_NETWORK || 'testnet'}/transaction/${result.transactionId}`
          })),
          totalAmount: mockPayrollData.payouts.reduce((sum, p) => sum + p.amount, 0),
          recipients: mockPayrollData.payouts.map(p => p.contributor),
          network: process.env.HEDERA_NETWORK || 'testnet',
          note: 'These were demo payments to your own account'
        },
        timestamp: new Date().toISOString()
      });

    } else {
      console.error(`❌ All demo payroll payments failed`);

      return NextResponse.json({
        success: false,
        error: 'All demo payroll payments failed',
        details: failedPayments.map(result => result.error).join(', '),
        troubleshooting: {
          checkBalance: 'Make sure your Hedera account has sufficient HBAR balance',
          checkCredentials: 'Verify HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY are correct',
          getFaucet: 'Get testnet HBAR from https://portal.hedera.com/register-hedera-faucet'
        },
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Demo payroll execution error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to execute demo payroll',
        details: error instanceof Error ? error.message : 'Unknown error',
        help: 'This is a demo endpoint. Check your Hedera credentials and network connection.',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

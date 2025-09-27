/**
 * Test Hedera API - Hedera Hashgraph Integration Test
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { HederaPaymentService } from '@/lib/integrations/hedera-agent';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action = 'balance' } = await request.json();

    if (!process.env.HEDERA_ACCOUNT_ID || !process.env.HEDERA_PRIVATE_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Hedera credentials not configured',
        message: 'Please add HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY to your environment',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    const hederaService = new HederaPaymentService({
      accountId: process.env.HEDERA_ACCOUNT_ID,
      privateKey: process.env.HEDERA_PRIVATE_KEY,
      network: (process.env.HEDERA_NETWORK as 'testnet' | 'mainnet') || 'testnet'
    });

    let result;

    switch (action) {
      case 'balance':
        result = await hederaService.getAccountBalance(process.env.HEDERA_ACCOUNT_ID);
        return NextResponse.json({
          success: true,
          action: 'balance_check',
          data: {
            accountId: process.env.HEDERA_ACCOUNT_ID,
            network: process.env.HEDERA_NETWORK || 'testnet',
            balance: result,
            message: `✅ Hedera connection successful! Account balance retrieved.`
          },
          timestamp: new Date().toISOString()
        });

      case 'info':
        const accountInfo = await hederaService.getAccountInfo(process.env.HEDERA_ACCOUNT_ID);
        return NextResponse.json({
          success: true,
          action: 'account_info',
          data: {
            accountId: process.env.HEDERA_ACCOUNT_ID,
            network: process.env.HEDERA_NETWORK || 'testnet',
            info: accountInfo,
            message: `✅ Hedera integration working! Account info retrieved.`
          },
          timestamp: new Date().toISOString()
        });

      case 'test_payment':
        // Test micro-payment to self (1 tinybar = 0.00000001 HBAR)
        const testPayment = await hederaService.executePayment([{
          recipientId: process.env.HEDERA_ACCOUNT_ID, // Send to self
          amount: 1, // 1 tinybar
          memo: 'AI Payroll System Test Payment'
        }]);
        
        return NextResponse.json({
          success: testPayment.success,
          action: 'test_payment',
          data: {
            accountId: process.env.HEDERA_ACCOUNT_ID,
            network: process.env.HEDERA_NETWORK || 'testnet',
            payment: testPayment,
            message: testPayment.success ? 
              `✅ Test payment successful! Transaction ID: ${testPayment.transactionId}` :
              `❌ Test payment failed: ${testPayment.error}`
          },
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action',
          availableActions: ['balance', 'info', 'test_payment'],
          timestamp: new Date().toISOString()
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Hedera test failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Hedera test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        troubleshooting: {
          checkCredentials: 'Verify HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY in .env.local',
          checkNetwork: 'Ensure you are using testnet for testing',
          checkBalance: 'Make sure your testnet account has HBAR balance',
          getFaucet: 'Get testnet HBAR from https://portal.hedera.com/register-hedera-faucet'
        },
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Test endpoint to quickly check PYUSD balance and transactions
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const address = url.searchParams.get('address');

    if (!address) {
      return NextResponse.json({
        error: 'Please provide an address parameter',
        example: '/api/test-pyusd?address=0xYourAddress'
      });
    }

    console.log(`🧪 Testing PYUSD balance for address: ${address}`);

    // Test Etherscan API directly
    const ETHERSCAN_API_KEY = process.env.ETHER_API || 'GJFQSSNKBXCVUFDT5BRFEEE2KRZ6XWNP3G';
    const PYUSD_CONTRACT = '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9'; // Correct Sepolia PYUSD

    // 1. Test PYUSD balance
    const balanceUrl = `https://api-sepolia.etherscan.io/api?module=account&action=tokenbalance&contractaddress=${PYUSD_CONTRACT}&address=${address}&tag=latest&apikey=${ETHERSCAN_API_KEY}`;
    
    console.log('📊 Calling Etherscan balance API...');
    const balanceResponse = await fetch(balanceUrl);
    const balanceData = await balanceResponse.json();
    
    console.log('Balance API response:', balanceData);
    
    // 2. Test token transfers
    const transfersUrl = `https://api-sepolia.etherscan.io/api?module=account&action=tokentx&address=${address}&startblock=0&endblock=999999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
    
    console.log('📜 Calling Etherscan transfers API...');
    const transfersResponse = await fetch(transfersUrl);
    const transfersData = await transfersResponse.json();
    
    console.log('Transfers API response:', transfersData);

    // Process balance
    let pyusdBalance = '0';
    if (balanceData.status === '1' && balanceData.result) {
      // Convert from raw units (6 decimals for PYUSD)
      const rawBalance = BigInt(balanceData.result);
      pyusdBalance = (Number(rawBalance) / Math.pow(10, 6)).toFixed(6);
    }

    // Process transfers - filter for PYUSD only
    let pyusdTransfers = [];
    if (transfersData.status === '1' && Array.isArray(transfersData.result)) {
      pyusdTransfers = transfersData.result
        .filter((tx: any) => 
          tx.contractAddress.toLowerCase() === PYUSD_CONTRACT.toLowerCase() ||
          tx.tokenSymbol === 'PYUSD'
        )
        .slice(0, 5) // Last 5 transfers
        .map((tx: any) => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          amount: (Number(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal))).toFixed(6),
          timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
          blockNumber: tx.blockNumber
        }));
    }

    return NextResponse.json({
      success: true,
      address,
      contractAddress: PYUSD_CONTRACT,
      balance: {
        raw: balanceData.result || '0',
        formatted: pyusdBalance + ' PYUSD',
        etherscanStatus: balanceData.status,
        etherscanMessage: balanceData.message
      },
      transfers: {
        count: pyusdTransfers.length,
        totalFound: transfersData.result?.length || 0,
        recent: pyusdTransfers,
        etherscanStatus: transfersData.status,
        etherscanMessage: transfersData.message
      },
      debug: {
        balanceApiUrl: balanceUrl.replace(ETHERSCAN_API_KEY, 'HIDDEN'),
        transfersApiUrl: transfersUrl.replace(ETHERSCAN_API_KEY, 'HIDDEN'),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

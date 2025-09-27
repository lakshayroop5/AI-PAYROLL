/**
 * Blockchain Monitoring API
 * Monitors PYUSD transactions and updates donation records
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { monitorPYUSDTransactions, getPYUSDBalance, SEPOLIA_CONFIG } from '@/lib/blockchain';
import { ethers } from 'ethers';

export async function POST(request: NextRequest) {
  try {
    // Get all active donation pages with wallet addresses
    const donationPages = await prisma.donationPage.findMany({
      where: { isActive: true },
      include: {
        manager: {
          select: {
            id: true,
            managerWalletAddress: true,
            email: true
          }
        }
      }
    });

    const results = [];

    for (const page of donationPages) {
      if (!page.manager.managerWalletAddress) continue;

      try {
        // Monitor transactions to this address
        const transactions = await monitorPYUSDTransactions(page.manager.managerWalletAddress);
        
        // Get current balance
        const currentBalance = await getPYUSDBalance(page.manager.managerWalletAddress);
        
        let newDonationsCount = 0;
        let totalNewAmount = 0;

        // Process each transaction
        for (const tx of transactions) {
          // Check if we already have this transaction
          const existingDonation = await prisma.donation.findFirst({
            where: { transactionHash: tx.transactionHash }
          });

          if (!existingDonation) {
            // Create new donation record
            const donation = await prisma.donation.create({
              data: {
                managerId: page.manager.id,
                amount: parseFloat(tx.amount),
                currency: 'PYUSD',
                paymentMethod: 'PYUSD',
                status: 'CONFIRMED',
                transactionHash: tx.transactionHash,
                paymentAddress: page.manager.managerWalletAddress,
                network: 'sepolia',
                confirmedAt: tx.timestamp,
                companyName: 'Blockchain Payment',
                qrCodeGenerated: false,
                metadata: JSON.stringify({
                  blockNumber: tx.blockNumber,
                  fromAddress: tx.from,
                  explorerUrl: tx.explorerUrl,
                  autoDetected: true,
                  timestamp: tx.timestamp.toISOString()
                })
              }
            });

            newDonationsCount++;
            totalNewAmount += parseFloat(tx.amount);

            // Log the detection
            await prisma.auditLog.create({
              data: {
                userId: page.manager.id,
                action: 'DONATION_DETECTED',
                resource: donation.id,
                details: JSON.stringify({
                  donationId: donation.id,
                  transactionHash: tx.transactionHash,
                  amount: tx.amount,
                  fromAddress: tx.from,
                  timestamp: tx.timestamp.toISOString()
                })
              }
            });
          }
        }

        // Update donation page statistics
        if (newDonationsCount > 0) {
          await prisma.donationPage.update({
            where: { id: page.id },
            data: {
              totalDonations: {
                increment: totalNewAmount
              },
              donationCount: {
                increment: newDonationsCount
              },
              lastDonationAt: new Date()
            }
          });
        }

        results.push({
          managerId: page.manager.id,
          managerEmail: page.manager.email,
          walletAddress: page.manager.managerWalletAddress,
          currentBalance,
          newTransactions: transactions.length,
          newDonations: newDonationsCount,
          totalNewAmount
        });

      } catch (error) {
        console.error(`Error monitoring ${page.manager.managerWalletAddress}:`, error);
        results.push({
          managerId: page.manager.id,
          managerEmail: page.manager.email,
          walletAddress: page.manager.managerWalletAddress,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Blockchain monitoring completed',
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error monitoring blockchain:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to monitor blockchain',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Etherscan API key from environment variables
const ETHERSCAN_API_KEY = process.env.ETHER_API || 'GJFQSSNKBXCVUFDT5BRFEEE2KRZ6XWNP3G'; // Use your API key

/**
 * Alternative method to get token transfers using Etherscan API
 */
async function getEtherscanTokenTransfers(address: string): Promise<any[]> {
  try {
    console.log(`Fetching ERC-20 transfers from Etherscan for address: ${address}`);
    
    // Etherscan API endpoint for Sepolia testnet
    const apiUrl = `https://api-sepolia.etherscan.io/api?module=account&action=tokentx&address=${address}&startblock=0&endblock=999999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
    
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    if (data.status === '1' && Array.isArray(data.result)) {
      console.log(`Etherscan found ${data.result.length} token transfers`);
      
      // Filter for PYUSD token transfers
      const pyusdTransfers = data.result.filter(
        (tx: any) => tx.tokenSymbol === 'PYUSD' || 
                      tx.contractAddress.toLowerCase() === SEPOLIA_CONFIG.pyusdTokenAddress.toLowerCase()
      );
      
      console.log(`Found ${pyusdTransfers.length} PYUSD transfers from Etherscan`);
      
      // Convert to our standard format
      return pyusdTransfers.map((tx: any) => ({
        transactionHash: tx.hash,
        blockNumber: parseInt(tx.blockNumber),
        from: tx.from,
        to: tx.to,
        amount: ethers.formatUnits(tx.value, parseInt(tx.tokenDecimal)),
        timestamp: new Date(parseInt(tx.timeStamp) * 1000),
        explorerUrl: `${SEPOLIA_CONFIG.explorerUrl}/tx/${tx.hash}`
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching from Etherscan API:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const address = url.searchParams.get('address');
    const timeoutMs = 15000; // 15 second timeout

    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter required' },
        { status: 400 }
      );
    }
    
    // Normalize address format to ensure consistent checks
    const normalizedAddress = address.toLowerCase();
    
    // Add address validation
    if (!normalizedAddress.match(/^0x[a-f0-9]{40}$/)) {
      return NextResponse.json(
        { error: 'Invalid Ethereum address format' },
        { status: 400 }
      );
    }

    console.log(`📊 Monitoring blockchain for address: ${address}`);
    
    // Get current balance
    const balance = await getPYUSDBalance(address);
    console.log(`PYUSD Balance: ${balance}`);
    
    // Helper function to add timeout to Promises
    function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(errorMessage)), ms);
      });
      return Promise.race([promise, timeout]) as Promise<T>;
    }
    
    // Try getting transactions with ethers.js, but with timeout
    let ethersTransactions: any[] = [];
    try {
      console.log('Attempting to fetch transactions using ethers.js...');
      ethersTransactions = await withTimeout(
        monitorPYUSDTransactions(normalizedAddress, -5000), // Reduced block range for faster response
        timeoutMs,
        'Ethers transaction query timed out'
      );
      console.log(`Found ${ethersTransactions.length} transactions using ethers.js`);
    } catch (ethersError) {
      console.error('Error or timeout in ethers.js transaction query:', ethersError);
      ethersTransactions = [];
    }
    
    // Always try Etherscan API as a parallel source of truth
    let etherscanTransactions: any[] = [];
    try {
      console.log('Querying Etherscan API for token transfers...');
      etherscanTransactions = await withTimeout(
        getEtherscanTokenTransfers(normalizedAddress),
        timeoutMs,
        'Etherscan API query timed out'
      );
      console.log(`Found ${etherscanTransactions.length} transactions using Etherscan API`);
    } catch (etherscanError) {
      console.error('Error or timeout in Etherscan API query:', etherscanError);
    }
    
    // Combine transactions from both sources
    let transactions = [...ethersTransactions];
    if (etherscanTransactions.length > 0) {
      transactions = [...transactions, ...etherscanTransactions];
    }
    
    // If no transactions were found with either method, prioritize showing Etherscan ones
    if (transactions.length === 0 && etherscanTransactions.length > 0) {
      transactions = etherscanTransactions;
    }
    
    // Combine and deduplicate if needed (by transaction hash)
    const seen = new Set();
    const uniqueTransactions = transactions.filter(tx => {
      if (seen.has(tx.transactionHash)) {
        return false;
      }
      seen.add(tx.transactionHash);
      return true;
    });

    return NextResponse.json({
      success: true,
      address,
      balance,
      transactions: uniqueTransactions.slice(0, 10), // Last 10 transactions
      transactionCount: uniqueTransactions.length,
      timestamp: new Date().toISOString(),
      methods: {
        ethers: ethersTransactions.length > 0,
        etherscan: ethersTransactions.length === 0 && transactions.length > 0
      }
    });

  } catch (error) {
    console.error('❌ Error getting blockchain data:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to get blockchain data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

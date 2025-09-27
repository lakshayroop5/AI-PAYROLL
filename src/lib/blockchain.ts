/**
 * Blockchain utilities for PYUSD transactions on Ethereum Sepolia testnet
 */

import { ethers } from 'ethers';

// Sepolia testnet configuration
export const SEPOLIA_CONFIG = {
  chainId: 11155111,
  name: 'Sepolia',
  rpcUrl: 'https://rpc.ankr.com/eth_sepolia', // Free public RPC endpoint
  backupRpcUrls: [
    'https://eth-sepolia.public.blastapi.io',
    'https://sepolia.gateway.tenderly.co',
    'https://ethereum-sepolia.blockpi.network/v1/rpc/public'
  ],
  explorerUrl: 'https://sepolia.etherscan.io',
  pyusdTokenAddress: '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9', // Official PYUSD Sepolia contract
};

// PYUSD ERC-20 ABI (minimal)
export const PYUSD_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

/**
 * Get token balance from Etherscan API
 */
async function getTokenBalanceFromEtherscan(tokenAddress: string, walletAddress: string): Promise<string> {
  try {
    // Use Etherscan API to get token balance
    const apiKey = process.env.ETHER_API || 'GJFQSSNKBXCVUFDT5BRFEEE2KRZ6XWNP3G';
    const url = `https://api-sepolia.etherscan.io/api?module=account&action=tokenbalance&contractaddress=${tokenAddress}&address=${walletAddress}&tag=latest&apikey=${apiKey}`;
    
    console.log('Fetching token balance from Etherscan API...');
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === '1' && data.result) {
      // Etherscan returns raw balance, we need to format it
      console.log(`Etherscan reports balance: ${data.result}`);
      return ethers.formatUnits(data.result, 6); // PYUSD uses 6 decimals
    }
    
    console.log('Etherscan API returned no valid data for balance');
    return '0';
  } catch (error) {
    console.error('Error getting balance from Etherscan:', error);
    return '0';
  }
}

/**
 * Get PYUSD balance for an address
 */
export async function getPYUSDBalance(address: string): Promise<string> {
  console.log(`Getting PYUSD balance for ${address}...`);
  
  try {
    // Try using RPC provider first
    try {
      const provider = new ethers.JsonRpcProvider(SEPOLIA_CONFIG.rpcUrl);
      const contract = new ethers.Contract(SEPOLIA_CONFIG.pyusdTokenAddress, PYUSD_ABI, provider);
      
      console.log('Attempting to get balance using RPC...');
      const balance = await contract.balanceOf(address);
      const decimals = await contract.decimals();
      
      // Convert from wei to PYUSD (usually 6 decimals for PYUSD)
      const formattedBalance = ethers.formatUnits(balance, decimals);
      console.log(`RPC balance check successful: ${formattedBalance} PYUSD`);
      return formattedBalance;
    } catch (rpcError) {
      console.error('RPC balance check failed, trying Etherscan API:', rpcError);
      
      // Fall back to Etherscan API
      const etherscanBalance = await getTokenBalanceFromEtherscan(
        SEPOLIA_CONFIG.pyusdTokenAddress,
        address
      );
      
      console.log(`Etherscan balance: ${etherscanBalance} PYUSD`);
      return etherscanBalance;
    }
  } catch (error) {
    console.error('All balance check methods failed:', error);
    return '0';
  }
}

/**
 * Monitor PYUSD transactions to a specific address
 */
export async function monitorPYUSDTransactions(
  toAddress: string,
  fromBlock: number = -10000 // Last 10000 blocks - increased to catch more transactions
): Promise<any[]> {
  try {
    const provider = new ethers.JsonRpcProvider(SEPOLIA_CONFIG.rpcUrl);
    const contract = new ethers.Contract(SEPOLIA_CONFIG.pyusdTokenAddress, PYUSD_ABI, provider);
    
    console.log(`🔍 Monitoring ERC-20 transfers to ${toAddress}`);
    
    // Create filter for Transfer events to this address
    const filter = contract.filters.Transfer(null, toAddress);
    
    // Try to get the current block number
    const currentBlock = await provider.getBlockNumber();
    console.log(`Current block: ${currentBlock}`);
    
    // Calculate starting block - either relative or absolute
    let startBlock;
    if (fromBlock < 0) {
      startBlock = Math.max(0, currentBlock + fromBlock); // go back N blocks
    } else {
      startBlock = fromBlock;
    }
    
    console.log(`Searching for events from block ${startBlock} to ${currentBlock}`);
    
    // Get recent events - use smaller chunks to avoid RPC timeout errors
    const CHUNK_SIZE = 3000;
    let events: ethers.EventLog[] = [];
    
    for (let i = startBlock; i < currentBlock; i += CHUNK_SIZE) {
      const endBlock = Math.min(i + CHUNK_SIZE - 1, currentBlock);
      console.log(`Querying blocks ${i} to ${endBlock}...`);
      
      try {
        const chunk = await contract.queryFilter(filter, i, endBlock) as ethers.EventLog[];
        events = [...events, ...chunk];
        console.log(`Found ${chunk.length} events in this chunk`);
      } catch (err) {
        console.error(`Error querying blocks ${i}-${endBlock}:`, err);
      }
    }
    
    console.log(`Total events found: ${events.length}`);
    
    // Get decimals once outside the loop for efficiency
    const decimals = await contract.decimals();
    
    const transactions = [];
    for (const event of events) {
      try {
        // Check if we have event.args
        if (!event.args || event.args.length < 3) {
          console.error('Event missing args:', event);
          continue;
        }
        
        // Get block for timestamp
        const block = await provider.getBlock(event.blockNumber);
        if (!block) {
          console.error(`Block not found for block number ${event.blockNumber}`);
          continue;
        }
        
        // Debug logging
        console.log(`Processing transfer: ${event.args[0]} -> ${event.args[1]} (${ethers.formatUnits(event.args[2], decimals)} PYUSD)`);
        
        transactions.push({
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          from: event.args[0],
          to: event.args[1],
          amount: ethers.formatUnits(event.args[2], decimals),
          timestamp: new Date(Number(block.timestamp) * 1000), // Ensure timestamp is a number
          explorerUrl: `${SEPOLIA_CONFIG.explorerUrl}/tx/${event.transactionHash}`
        });
      } catch (err) {
        console.error(`Error processing event ${event.transactionHash}:`, err);
      }
    }
    
    return transactions.reverse(); // Most recent first
  } catch (error) {
    console.error('Error monitoring PYUSD transactions:', error);
    return [];
  }
}

/**
 * Get transaction details
 */
export async function getTransactionDetails(txHash: string) {
  try {
    const provider = new ethers.JsonRpcProvider(SEPOLIA_CONFIG.rpcUrl);
    const tx = await provider.getTransaction(txHash);
    
    // Check if transaction exists
    if (!tx) {
      console.error(`Transaction not found: ${txHash}`);
      return null;
    }
    
    const receipt = await provider.getTransactionReceipt(txHash);
    
    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to || 'Contract Creation', // handle contract creation transactions
      value: ethers.formatEther(tx.value),
      gasUsed: receipt?.gasUsed?.toString() || 'unknown',
      status: receipt?.status === 1 ? 'success' : 'failed',
      blockNumber: tx.blockNumber,
      confirmations: await tx.confirmations()
    };
  } catch (error) {
    console.error('Error getting transaction details:', error);
    return null;
  }
}

/**
 * Generate wallet connection instructions for third parties
 */
export function getWalletSetupInstructions() {
  return {
    title: "How Third Parties Can Pay with Testnet PYUSD",
    steps: [
      {
        step: 1,
        title: "Install MetaMask",
        description: "Download MetaMask browser extension or mobile app",
        action: "Visit metamask.io"
      },
      {
        step: 2,
        title: "Add Sepolia Network",
        description: "Add Ethereum Sepolia testnet to MetaMask",
        details: {
          networkName: "Sepolia",
          rpcUrl: SEPOLIA_CONFIG.rpcUrl,
          chainId: SEPOLIA_CONFIG.chainId,
          symbol: "ETH",
          explorerUrl: SEPOLIA_CONFIG.explorerUrl
        }
      },
      {
        step: 3,
        title: "Get Testnet ETH",
        description: "Get free Sepolia ETH for gas fees",
        action: "Visit sepolia-faucet.pk910.de or sepoliafaucet.com"
      },
      {
        step: 4,
        title: "Get Testnet PYUSD",
        description: "Add PYUSD token and get test tokens",
        details: {
          tokenAddress: SEPOLIA_CONFIG.pyusdTokenAddress,
          symbol: "PYUSD",
          decimals: 6
        },
        action: "Request from faucet or testnet exchange"
      },
      {
        step: 5,
        title: "Make Payment",
        description: "Scan QR or send PYUSD to donation address",
        action: "Use MetaMask to send PYUSD tokens"
      }
    ]
  };
}

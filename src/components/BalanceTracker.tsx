'use client';

/**
 * Balance Tracker Component
 * Shows real PYUSD balance and recent transactions
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface Transaction {
  transactionHash: string;
  from: string;
  to: string;
  amount: string;
  timestamp: Date;
  explorerUrl: string;
  blockNumber?: number;
}

interface PriceData {
  pyusd: {
    price: number | null;
    symbol: string;
    name: string;
    icon: string;
  };
  hbar: {
    price: number | null;
    symbol: string;
    name: string;
    icon: string;
  };
}

interface BalanceData {
  address: string;
  balance: string;
  transactions: Transaction[];
  transactionCount?: number;
  timestamp?: string;
  methods?: {
    ethers: boolean;
    etherscan: boolean;
  };
}

interface BalanceTrackerProps {
  walletAddress: string;
  managerName: string;
}

export default function BalanceTracker({ walletAddress, managerName }: BalanceTrackerProps) {
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true); // Auto-refresh enabled by default
  const [countdown, setCountdown] = useState(30);
  const [showTransactions, setShowTransactions] = useState(false); // Hide transactions by default

  useEffect(() => {
    if (walletAddress) {
      fetchBalance();
      fetchPrices(); // Also fetch prices on component mount
    }
  }, [walletAddress]);

  // Auto-refresh with countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            fetchBalance(); // Refresh when countdown reaches 0
            fetchPrices(); // Also refresh prices
            return 30; // Reset countdown
          }
          return prev - 1;
        });
      }, 1000); // Update every second
    } else {
      setCountdown(30); // Reset countdown when auto-refresh is disabled
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

  async function fetchBalance() {
    if (!walletAddress) return;

    setLoading(true);
    try {
      // Inform user that we're checking blockchain data
      console.log('Checking ERC-20 transfers on Etherscan for address:', walletAddress);
      
      const response = await fetch(`/api/blockchain/monitor-donations?address=${walletAddress}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Blockchain data received:', data);
        
        if (data.transactions && data.transactions.length > 0) {
          console.log(`Found ${data.transactions.length} ERC-20 transfers`);
        } else {
          console.log('No ERC-20 transfers found');
        }
        
        setBalanceData(data);
        setLastUpdated(new Date());
      } else {
        const errorData = await response.json();
        console.error('Failed to fetch balance:', errorData);
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPrices() {
    setPriceLoading(true);
    try {
      console.log('🪙 Fetching live crypto prices...');
      
      const response = await fetch('/api/crypto-prices');
      
      if (response.ok) {
        const data = await response.json();
        console.log('Price data received:', data);
        
        if (data.success) {
          setPriceData(data.prices);
        }
      } else {
        console.error('Failed to fetch prices');
      }
    } catch (error) {
      console.error('Error fetching prices:', error);
    } finally {
      setPriceLoading(false);
    }
  }

  // Filter transactions for current month
  function getThisMonthTransactions(transactions: Transaction[]): Transaction[] {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    return transactions.filter(tx => {
      const txDate = new Date(tx.timestamp);
      return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
    });
  }

  // Calculate this month's transaction summary
  function getThisMonthSummary(transactions: Transaction[]) {
    const thisMonth = getThisMonthTransactions(transactions);
    let incoming = 0;
    let outgoing = 0;
    
    thisMonth.forEach(tx => {
      const amount = parseFloat(tx.amount);
      const isIncoming = tx.to.toLowerCase() === walletAddress.toLowerCase();
      
      if (isIncoming) {
        incoming += amount;
      } else {
        outgoing += amount;
      }
    });
    
    return {
      incoming,
      outgoing,
      net: incoming - outgoing,
      total: thisMonth.length
    };
  }

  async function syncDonations() {
    setLoading(true);
    try {
      const response = await fetch('/api/blockchain/monitor-donations', {
        method: 'POST'
      });
      if (response.ok) {
        await fetchBalance(); // Refresh after sync
        alert('✅ Donations synced successfully!');
      } else {
        alert('❌ Failed to sync donations');
      }
    } catch (error) {
      alert('❌ Error syncing donations');
    } finally {
      setLoading(false);
    }
  }

  if (!walletAddress) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">
          ⚠️ No wallet address configured. Please set up your wallet in settings to track balance.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <img src="/payPal.png" alt="PYUSD" className="h-8 w-8 rounded-full" />
          <h2 className="text-xl font-bold text-blue-600">PYUSD Balance</h2>
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={() => {
              fetchBalance();
              fetchPrices();
            }}
            disabled={loading || priceLoading}
            size="sm"
            variant="outline"
          >
            {loading || priceLoading ? 'Loading...' : '🔄 Refresh All'}
          </Button>
          <Button
            onClick={syncDonations}
            disabled={loading}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Syncing...' : '🔄 Sync Blockchain'}
          </Button>
        </div>
      </div>

      {/* Balance Display */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className={`rounded-lg p-4 border ${loading ? 'bg-gray-50 border-gray-200' : parseFloat(balanceData?.balance || '0') > 0 ? 'bg-gradient-to-r from-green-50 to-blue-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Current PYUSD Balance</p>
            {loading ? (
              <div className="flex justify-center items-center h-8">
                <div className="animate-pulse h-6 w-24 bg-gray-200 rounded"></div>
              </div>
            ) : (
              <p className={`text-2xl font-bold ${parseFloat(balanceData?.balance || '0') > 0 ? 'text-green-600' : 'text-yellow-600'}`}>
                {balanceData ? `${parseFloat(balanceData.balance).toFixed(2)} PYUSD` : '0.00 PYUSD'}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              ≈ ${balanceData ? parseFloat(balanceData.balance).toFixed(2) : '0.00'} USD
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Available for Distribution</p>
            {loading ? (
              <div className="flex justify-center items-center h-8">
                <div className="animate-pulse h-6 w-24 bg-gray-200 rounded"></div>
              </div>
            ) : (
              <p className="text-2xl font-bold text-blue-600">
                {balanceData ? `${parseFloat(balanceData.balance).toFixed(2)} PYUSD` : '0.00 PYUSD'}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">Ready to distribute</p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">This Month</p>
            {loading ? (
              <div className="flex justify-center items-center h-8">
                <div className="animate-pulse h-6 w-12 bg-gray-200 rounded"></div>
              </div>
            ) : (
              <p className="text-2xl font-bold text-purple-600">
                {balanceData?.transactions ? getThisMonthTransactions(balanceData.transactions).length : 0}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">This month transactions</p>
          </div>
        </div>
      </div>

      {/* Live Crypto Prices */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center">
            📈 Live Crypto Prices
          </h2>
          {priceLoading && (
            <div className="flex items-center space-x-2 text-blue-600">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs">Updating...</span>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* PYUSD Price */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <img 
                  src="/payPal.png" 
                  alt="PYUSD" 
                  className="w-6 h-6 rounded-full"
                  onError={(e) => {
                    // Fallback to emoji if image fails to load
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = '💳';
                  }}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold text-gray-900">PYUSD</h3>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">PayPal USD</span>
                </div>
                {priceData?.pyusd?.price ? (
                  <p className="text-lg font-bold text-blue-600">
                    ${priceData.pyusd.price.toFixed(4)}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">Price loading...</p>
                )}
              </div>
              
              {/* Show PYUSD equivalent of user's balance */}
              {balanceData && priceData?.pyusd?.price && (
                <div className="text-right">
                  <p className="text-xs text-gray-500">Your Balance Value</p>
                  <p className="text-sm font-semibold text-green-600">
                    ${(parseFloat(balanceData.balance) * priceData.pyusd.price).toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* HBAR Price */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <img 
                  src="/hbar.png" 
                  alt="HBAR" 
                  className="w-6 h-6 rounded-full"
                  onError={(e) => {
                    // Fallback to emoji if image fails to load
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = '⚡';
                  }}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold text-gray-900">HBAR</h3>
                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">Hedera</span>
                </div>
                {priceData?.hbar?.price ? (
                  <p className="text-lg font-bold text-purple-600">
                    ${priceData.hbar.price.toFixed(4)}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">Price loading...</p>
                )}
              </div>
              
              {/* Show HBAR equivalent of user's PYUSD balance */}
              {balanceData && priceData?.hbar?.price && priceData?.pyusd?.price && (
                <div className="text-right">
                  <p className="text-xs text-gray-500">HBAR Equivalent</p>
                  <p className="text-sm font-semibold text-purple-600">
                    {((parseFloat(balanceData.balance) * priceData.pyusd.price) / priceData.hbar.price).toFixed(2)} HBAR
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Price Update Info */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            Prices update every 30 seconds • Source: CoinGecko API
            {priceData && (
              <span className="ml-2">
                Last updated: {new Date().toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Wallet Info */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Manager: {managerName}</p>
            <p className="text-xs text-gray-500 font-mono">{walletAddress}</p>
          </div>
          <Button
            onClick={() => navigator.clipboard.writeText(walletAddress)}
            variant="outline"
            size="sm"
          >
            Copy Address
          </Button>
        </div>
      </div>

      {/* Auto Refresh Toggle with Countdown */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-700">Auto-refresh</span>
          </label>
          
          {autoRefresh && (
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full transition-colors ${
              countdown <= 5 ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
            }`}>
              <div className={`w-2 h-2 rounded-full animate-pulse ${
                countdown <= 5 ? 'bg-orange-600' : 'bg-blue-600'
              }`}></div>
              <span className={`text-xs font-medium ${countdown <= 3 ? 'animate-pulse' : ''}`}>
                Next refresh in: <span className="font-bold">{countdown}s</span>
              </span>
            </div>
          )}
          
          {lastUpdated && (
            <p className="text-xs text-gray-500">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <a
          href={`https://sepolia.etherscan.io/address/${walletAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline text-sm"
        >
          View on Etherscan →
        </a>
      </div>

      {/* This Month Transactions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <h3 className="font-medium text-gray-900">This Month PYUSD Transactions</h3>
            <Button
              onClick={() => setShowTransactions(!showTransactions)}
              size="sm"
              variant="outline"
              className="text-xs"
            >
              {showTransactions ? '🔽 Hide Details' : '🔼 Show Details'} 
              {balanceData?.transactions ? `(${getThisMonthTransactions(balanceData.transactions).length})` : '(0)'}
            </Button>
          </div>
          {balanceData?.methods && (
            <div className="text-xs text-gray-500 rounded-full bg-gray-100 px-2 py-1">
              Source: {balanceData.methods.etherscan ? 'Etherscan API' : balanceData.methods.ethers ? 'Blockchain RPC' : 'Unknown'}
            </div>
          )}
        </div>

        {/* Show transaction details only when toggled */}
        {showTransactions && (
          <>
            {/* Month Summary */}
            {balanceData?.transactions && getThisMonthTransactions(balanceData.transactions).length > 0 && (
              <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-200">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Received</p>
                    <p className="text-sm font-bold text-green-600">
                      +{getThisMonthSummary(balanceData.transactions).incoming.toFixed(2)} PYUSD
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Sent</p>
                    <p className="text-sm font-bold text-red-600">
                      -{getThisMonthSummary(balanceData.transactions).outgoing.toFixed(2)} PYUSD
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Net Change</p>
                    <p className={`text-sm font-bold ${
                      getThisMonthSummary(balanceData.transactions).net >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {getThisMonthSummary(balanceData.transactions).net >= 0 ? '+' : ''}
                      {getThisMonthSummary(balanceData.transactions).net.toFixed(2)} PYUSD
                    </p>
                  </div>
                </div>
              </div>
            )}
        
        {loading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-sm text-gray-500">Scanning blockchain for transactions...</p>
          </div>
        ) : balanceData?.transactions && getThisMonthTransactions(balanceData.transactions).length > 0 ? (
          <div className="space-y-2">
            {getThisMonthTransactions(balanceData.transactions).map((tx) => {
              // Check if transaction is incoming (to wallet) or outgoing (from wallet)
              const isIncoming = tx.to.toLowerCase() === walletAddress.toLowerCase();
              const isOutgoing = tx.from.toLowerCase() === walletAddress.toLowerCase();
              
              return (
                <div key={tx.transactionHash} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div>
                    <p className={`text-sm font-medium ${
                      isIncoming ? 'text-green-600' : isOutgoing ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {isIncoming ? '+' : isOutgoing ? '-' : ''}
                      {parseFloat(tx.amount).toFixed(2)} PYUSD
                    </p>
                    <p className="text-xs text-gray-500">
                      {isIncoming ? 'From' : 'To'}: {
                        isIncoming ? 
                          `${tx.from.slice(0, 6)}...${tx.from.slice(-4)}` : 
                          `${tx.to.slice(0, 6)}...${tx.to.slice(-4)}`
                      }
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(tx.timestamp).toLocaleString()}
                    </p>
                    {tx.blockNumber && (
                      <p className="text-xs text-gray-400">
                        Block: {tx.blockNumber}
                      </p>
                    )}
                    {/* Transaction Type Badge */}
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        isIncoming ? 'bg-green-100 text-green-800' : 
                        isOutgoing ? 'bg-red-100 text-red-800' : 
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {isIncoming ? '↓ Received' : isOutgoing ? '↑ Sent' : 'Transfer'}
                      </span>
                    </div>
                  </div>
                  <a
                    href={tx.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-xs px-3 py-1 bg-blue-50 rounded"
                  >
                    View on Etherscan →
                  </a>
                </div>
              );
            })}
            
            <div className="mt-2 text-center">
              <a
                href={`https://sepolia.etherscan.io/token/0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9?a=${walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-xs"
              >
                View all transactions on Etherscan →
              </a>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-gray-50 rounded-lg border border-gray-200 text-center">
            <p className="text-gray-500 mb-2">No PYUSD transactions this month</p>
            
            <div className="flex flex-col space-y-2 items-center mt-4">
              <a
                href={`https://sepolia.etherscan.io/token/0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9?a=${walletAddress}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-xs"
              >
                Check on Etherscan directly →
              </a>
              
              <div className="text-xs text-gray-400 mt-2 max-w-md">
                If you believe you should have transactions, make sure you're checking the correct address 
                and that you've received PYUSD tokens (not ETH) on Sepolia testnet.
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {loading && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm text-gray-500 mt-2">Loading blockchain data...</p>
        </div>
      )}
    </div>
  );
}

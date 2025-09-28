'use client';

/**
 * Contributors Management Demo
 * Shows the complete wallet management system
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';

// Mock data for demo
const mockContributors = [
  {
    id: 'github-1',
    githubLogin: 'alice-dev',
    avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
    name: 'Alice Johnson',
    hederaAccountId: '0.0.123456',
    isRegistered: true,
    stats: {
      totalCommits: 145,
      totalPRs: 23,
      repositories: ['ai-payroll', 'web3-tools']
    },
    earnings: {
      totalUsd: 285.50,
      totalPayouts: 3
    }
  },
  {
    id: 'github-2',
    githubLogin: 'bob-contributor',
    avatarUrl: 'https://avatars.githubusercontent.com/u/2?v=4',
    name: 'Bob Smith',
    hederaAccountId: null,
    isRegistered: false,
    stats: {
      totalCommits: 89,
      totalPRs: 12,
      repositories: ['ai-payroll']
    },
    earnings: {
      totalUsd: 0,
      totalPayouts: 0
    }
  },
  {
    id: 'github-3',
    githubLogin: 'charlie-coder',
    avatarUrl: 'https://avatars.githubusercontent.com/u/3?v=4',
    name: 'Charlie Brown',
    hederaAccountId: '0.0.789012',
    isRegistered: true,
    stats: {
      totalCommits: 67,
      totalPRs: 8,
      repositories: ['web3-tools']
    },
    earnings: {
      totalUsd: 150.00,
      totalPayouts: 2
    }
  }
];

export default function ContributorsDemoPage() {
  const [contributors, setContributors] = useState(mockContributors);
  const [editingWallet, setEditingWallet] = useState<string | null>(null);
  const [walletInputs, setWalletInputs] = useState<Record<string, string>>({});

  function validateWalletAddress(address: string): boolean {
    if (!address || address.trim().length < 10) return false;
    
    // Basic validation for common wallet address formats
    const patterns = [
      /^0\.0\.\d+$/, // Hedera format (0.0.123456)
      /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/, // Bitcoin legacy format
      /^bc1[a-z0-9]{39,59}$/, // Bitcoin Bech32 format
      /^0x[a-fA-F0-9]{40}$/, // Ethereum format
      /^[a-zA-Z0-9]{32,44}$/, // Solana format
      /^[a-zA-Z0-9_-]{10,}$/ // Generic crypto address format
    ];
    
    return patterns.some(pattern => pattern.test(address.trim()));
  }

  function getStatusBadge(contributor: any) {
    if (contributor.hederaAccountId) {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Ready for Payouts</span>;
    } else if (contributor.isRegistered) {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Wallet Needed</span>;
    } else {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Not Registered</span>;
    }
  }

  function startEditingWallet(contributorId: string, currentWallet?: string) {
    setEditingWallet(contributorId);
    setWalletInputs(prev => ({ ...prev, [contributorId]: currentWallet || '' }));
  }

  function cancelEditingWallet() {
    setEditingWallet(null);
    setWalletInputs({});
  }

  function updateContributorWallet(contributorId: string, hederaAccountId: string) {
    // Simulate API call
    setTimeout(() => {
      setContributors(prev => prev.map(c => 
        c.id === contributorId 
          ? { ...c, hederaAccountId, isRegistered: true }
          : c
      ));
      setEditingWallet(null);
      setWalletInputs(prev => ({ ...prev, [contributorId]: '' }));
      alert('✅ Wallet address updated successfully! (Demo)');
    }, 500);
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🎯 Contributors Management Demo</h1>
          <p className="text-gray-600">See how managers can directly add wallet addresses for contributors</p>
        </div>

        {/* Demo Alert */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <span className="text-2xl">🚀</span>
            <div>
              <h3 className="font-medium text-blue-900">Live Demo Features</h3>
              <ul className="text-blue-700 text-sm mt-1 space-y-1">
                <li>• Click "Add" or "Edit" buttons to manage wallet addresses</li>
                <li>• Real-time validation of Hedera account IDs (0.0.xxxxxx)</li>
                <li>• Instant status updates and visual feedback</li>
                <li>• No actual blockchain transactions (demo mode)</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">👥</span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Total Contributors</p>
                <p className="text-2xl font-semibold text-gray-900">{contributors.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">✅</span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Ready for Payouts</p>
                <p className="text-2xl font-semibold text-green-600">
                  {contributors.filter(c => c.hederaAccountId).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Need Wallets</p>
                <p className="text-2xl font-semibold text-yellow-600">
                  {contributors.filter(c => !c.hederaAccountId).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">💰</span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Total Distributed</p>
                <p className="text-2xl font-semibold text-gray-900">
                  ${contributors.reduce((sum, c) => sum + c.earnings.totalUsd, 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Contributors List */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Active Contributors</h3>
          </div>
          
          <div className="divide-y divide-gray-200">
            {contributors.map((contributor) => (
              <div key={contributor.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <img 
                        className="w-12 h-12 rounded-full" 
                        src={contributor.avatarUrl} 
                        alt={contributor.githubLogin}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-lg font-medium text-gray-900">
                          {contributor.name || contributor.githubLogin}
                        </h4>
                        {getStatusBadge(contributor)}
                      </div>
                      <p className="text-sm text-gray-500">@{contributor.githubLogin}</p>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-xs text-gray-400">
                          {contributor.stats.totalPRs} PRs
                        </span>
                        <span className="text-xs text-gray-400">
                          {contributor.stats.totalCommits} commits
                        </span>
                        <span className="text-xs text-gray-400">
                          {contributor.stats.repositories.length} repos
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right space-y-2">
                    <div className="flex items-center space-x-6">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          ${contributor.earnings.totalUsd.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">Total Earnings</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {contributor.earnings.totalPayouts}
                        </p>
                        <p className="text-xs text-gray-500">Payouts</p>
                      </div>
                    </div>
                    
                    {/* Wallet Management */}
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-xs font-medium text-gray-700 mb-2">💳 Crypto Wallet</p>
                      {editingWallet === contributor.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={walletInputs[contributor.id] || ''}
                            onChange={(e) => setWalletInputs(prev => ({ 
                              ...prev, 
                              [contributor.id]: e.target.value 
                            }))}
                              placeholder="Enter wallet address (BTC, ETH, hedera, etc.)"
                              className={`block w-full text-xs border rounded px-2 py-1 ${
                                walletInputs[contributor.id] && !validateWalletAddress(walletInputs[contributor.id])
                                  ? 'border-red-300 focus:border-red-500'
                                  : 'border-gray-300 focus:border-blue-500'
                              }`}
                          />
                          <div className="flex space-x-1">
                            <Button
                              size="sm"
                              onClick={() => updateContributorWallet(
                                contributor.id,
                                walletInputs[contributor.id] || ''
                              )}
                              disabled={!validateWalletAddress(walletInputs[contributor.id] || '')}
                              className="text-xs px-2 py-1 h-auto"
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelEditingWallet}
                              className="text-xs px-2 py-1 h-auto"
                            >
                              Cancel
                            </Button>
                          </div>
                          {walletInputs[contributor.id] && !validateWalletAddress(walletInputs[contributor.id]) && (
                            <p className="text-xs text-red-500">Invalid wallet address format</p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            {contributor.hederaAccountId ? (
                              <p className="text-xs font-mono text-gray-600">
                                {contributor.hederaAccountId}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-500 italic">Not set</p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEditingWallet(contributor.id, contributor.hederaAccountId || undefined)}
                            className="text-xs px-2 py-1 h-auto ml-2"
                          >
                            {contributor.hederaAccountId ? 'Edit' : 'Add'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="font-medium text-green-900 mb-3">🎉 Try It Out!</h3>
          <div className="space-y-2 text-green-700 text-sm">
            <p>1. <strong>Click "Add"</strong> next to Bob's wallet to add a crypto address</p>
            <p>2. <strong>Try entering:</strong> <code className="bg-white px-1 rounded">0x742d35C6d</code> or <code className="bg-white px-1 rounded">0.0.555777</code></p>
            <p>3. <strong>Click "Edit"</strong> next to Alice's wallet to modify it</p>
            <p>4. <strong>Watch the stats update</strong> as you add wallets</p>
            <p>5. <strong>Supports:</strong> Bitcoin, Ethereum, Hedera, Solana, and more!</p>
          </div>
        </div>

        {/* Back to Dashboard */}
        <div className="mt-8 text-center">
          <Button onClick={() => window.location.href = '/dashboard'}>
            ← Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

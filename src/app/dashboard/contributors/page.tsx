'use client';

/**
 * Contributors management page
 */

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { SafeLink } from '@/components/ui/safe-link';
import { Button } from '@/components/ui/button';
import DashboardLayout from '@/components/layout/dashboard-layout';

interface Contributor {
  id: string;
  githubLogin: string;
  githubId?: number;
  avatarUrl?: string;
  name?: string;
  email?: string;
  hederaAccountId?: string;
  isRegistered: boolean;
  stats: {
    totalCommits: number;
    totalPRs: number;
    recentActivity: string;
    repositories: string[];
  };
  earnings: {
    totalUsd: number;
    totalPayouts: number;
    lastPayout?: string;
  };
}

export default function ContributorsPage() {
  const { data: session } = useSession();
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingWallet, setEditingWallet] = useState<string | null>(null);
  const [walletInputs, setWalletInputs] = useState<Record<string, string>>({});
  const [selectedRepository, setSelectedRepository] = useState<string>('all');
  const [repositories, setRepositories] = useState<string[]>([]);

  useEffect(() => {
    fetchContributors();
  }, []);

  async function fetchContributors() {
    try {
      setLoading(true);
      const response = await fetch('/api/contributors/github-stats');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const contributorList = data.contributors || [];
          setContributors(contributorList);
          
          // Extract unique repository names
          const allRepos = new Set<string>();
          contributorList.forEach((contributor: Contributor) => {
            contributor.stats.repositories.forEach((repo: string) => {
              allRepos.add(repo);
            });
          });
          setRepositories(Array.from(allRepos).sort());
        }
      }
    } catch (error) {
      console.error('Error fetching contributors:', error);
    } finally {
      setLoading(false);
    }
  }

  // Filter contributors by selected repository
  const filteredContributors = selectedRepository === 'all' 
    ? contributors
    : contributors.filter(contributor => 
        contributor.stats.repositories.includes(selectedRepository)
      );

  function getStatusBadge(contributor: Contributor) {
    if (contributor.hederaAccountId) {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Ready for Payouts</span>;
    } else if (contributor.isRegistered) {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Wallet Needed</span>;
    } else {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Not Registered</span>;
    }
  }

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

  async function updateContributorWallet(contributorId: string, githubLogin: string, hederaAccountId: string) {
    try {
      const response = await fetch('/api/contributors/update-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contributorId, githubLogin, hederaAccountId })
      });

      if (response.ok) {
        // Update local state
        setContributors(prev => prev.map(c => 
          c.id === contributorId 
            ? { ...c, hederaAccountId, isRegistered: true }
            : c
        ));
        setEditingWallet(null);
        setWalletInputs(prev => ({ ...prev, [contributorId]: '' }));
        alert('✅ Wallet address updated successfully!');
      } else {
        const error = await response.json();
        alert(`❌ Failed to update wallet: ${error.error}`);
      }
    } catch (error) {
      alert('❌ Error updating wallet address');
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contributors</h1>
            <p className="text-gray-600 mt-1">
              View and manage contributor profiles and payouts.
            </p>
          </div>
          <div className="flex space-x-3">
            <Button onClick={() => fetchContributors()}>
              🔄 Refresh
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <span className="text-2xl">💳</span>
            <div className="flex-1">
              <h3 className="font-medium text-green-900">Direct Wallet Management</h3>
              <p className="text-green-700 text-sm mt-1">
                Add cryptocurrency wallet addresses directly for any contributor below.
              </p>
              <div className="mt-2 flex items-center space-x-4 text-xs">
                <span className="text-green-600">✅ Bitcoin, Ethereum, Hedera, etc.</span>
                <span className="text-green-600">✅ Any public wallet address</span>
                <span className="text-green-600">✅ Immediate setup</span>
              </div>
            </div>
          </div>
        </div>

        {/* Repository Filter */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Contributors by Repository</h3>
              <div className="flex items-center space-x-3">
                <label className="text-sm text-gray-600">Filter by repository:</label>
                <select
                  value={selectedRepository}
                  onChange={(e) => setSelectedRepository(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="all">All Repositories ({contributors.length})</option>
                  {repositories.map(repo => {
                    const count = contributors.filter(c => c.stats.repositories.includes(repo)).length;
                    return (
                      <option key={repo} value={repo}>
                        {repo} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>
          
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading contributors...</p>
            </div>
          ) : filteredContributors.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {filteredContributors.map((contributor) => (
                <div key={contributor.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        {contributor.avatarUrl ? (
                          <img 
                            className="w-12 h-12 rounded-full" 
                            src={contributor.avatarUrl} 
                            alt={contributor.githubLogin}
                          />
                        ) : (
                          <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                            {contributor.githubLogin.charAt(0).toUpperCase()}
                          </div>
                        )}
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
                            {contributor.stats.totalCommits} commits
                          </span>
                          <span className="text-xs text-gray-400">
                            {contributor.stats.totalPRs} PRs
                          </span>
                          <span className="text-xs text-gray-400">
                            {contributor.stats.repositories.length} repos
                          </span>
                        </div>
                        {/* Repository tags */}
                        <div className="flex items-center space-x-1 mt-2 flex-wrap">
                          <span className="text-xs text-gray-500 mr-1">Repositories:</span>
                          {contributor.stats.repositories.slice(0, 3).map((repo, index) => (
                            <span 
                              key={repo}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 cursor-pointer hover:bg-blue-200"
                              onClick={() => setSelectedRepository(repo)}
                            >
                              {repo.split('/').pop() || repo}
                            </span>
                          ))}
                          {contributor.stats.repositories.length > 3 && (
                            <span className="text-xs text-gray-400">
                              +{contributor.stats.repositories.length - 3} more
                            </span>
                          )}
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
                        <SafeLink href={`/dashboard/contributors/${contributor.githubLogin}`}>
                          <Button variant="outline" size="sm">
                            View Profile
                          </Button>
                        </SafeLink>
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
                              placeholder="Enter wallet address (BTC, ETH, Hedera, etc.)"
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
                                  contributor.githubLogin,
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
                              onClick={() => startEditingWallet(contributor.id, contributor.hederaAccountId)}
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
          ) : (
            <div className="p-6 text-center">
              <div className="text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  {selectedRepository === 'all' ? 'No contributors found' : `No contributors in ${selectedRepository}`}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedRepository === 'all' 
                    ? 'Contributors will appear here once repositories are connected and they make contributions.' 
                    : 'Try selecting a different repository or "All Repositories" to see more contributors.'
                  }
                </p>
                {selectedRepository !== 'all' && (
                  <Button 
                    onClick={() => setSelectedRepository('all')} 
                    variant="outline" 
                    size="sm" 
                    className="mt-3"
                  >
                    View All Contributors
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">👥</span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">
                  {selectedRepository === 'all' ? 'Total Contributors' : 'Contributors in Repo'}
                </p>
                <p className="text-2xl font-semibold text-gray-900">{filteredContributors.length}</p>
                {selectedRepository !== 'all' && (
                  <p className="text-xs text-gray-400">of {contributors.length} total</p>
                )}
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
                  {filteredContributors.filter(c => c.hederaAccountId).length}
                </p>
                {selectedRepository !== 'all' && (
                  <p className="text-xs text-gray-400">of {contributors.filter(c => c.hederaAccountId).length} total</p>
                )}
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
                  {filteredContributors.filter(c => !c.hederaAccountId).length}
                </p>
                {selectedRepository !== 'all' && (
                  <p className="text-xs text-gray-400">of {contributors.filter(c => !c.hederaAccountId).length} total</p>
                )}
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
      </div>
    </DashboardLayout>
  );
}

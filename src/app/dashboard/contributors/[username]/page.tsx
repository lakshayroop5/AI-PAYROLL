'use client';

/**
 * Individual Contributor Profile Page
 * Shows detailed stats and allows wallet management
 */

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { SafeLink } from '@/components/ui/safe-link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import DashboardLayout from '@/components/layout/dashboard-layout';

interface ContributorProfile {
  githubLogin: string;
  githubId: number;
  avatarUrl?: string;
  name?: string;
  email?: string;
  hederaAccountId?: string;
  isRegistered: boolean;
  bio?: string;
  location?: string;
  company?: string;
  stats: {
    totalCommits: number;
    totalPRs: number;
    repositories: string[];
    languages: Record<string, number>;
    recentActivity: any[];
  };
  earnings: {
    totalUsd: number;
    totalPayouts: number;
    recentPayouts: any[];
  };
}

export default function ContributorProfilePage() {
  const { data: session } = useSession();
  const params = useParams();
  const username = params.username as string;
  
  const [profile, setProfile] = useState<ContributorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingWallet, setEditingWallet] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');

  useEffect(() => {
    if (username) {
      fetchContributorProfile();
    }
  }, [username]);

  async function fetchContributorProfile() {
    try {
      setLoading(true);
      const response = await fetch(`/api/contributors/${username}/profile`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
        setWalletAddress(data.profile.hederaAccountId || '');
      }
    } catch (error) {
      console.error('Error fetching contributor profile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateWalletAddress() {
    try {
      const response = await fetch(`/api/contributors/${username}/wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hederaAccountId: walletAddress })
      });

      if (response.ok) {
        setProfile(prev => prev ? { ...prev, hederaAccountId: walletAddress } : null);
        setEditingWallet(false);
        alert('✅ Wallet address updated successfully!');
      } else {
        const error = await response.json();
        alert(`❌ Failed to update wallet: ${error.error}`);
      }
    } catch (error) {
      alert('❌ Error updating wallet address');
    }
  }

  const isOwnProfile = session?.user?.githubLogin === username;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!profile) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Contributor Not Found</h1>
          <p className="text-gray-600 mb-6">The contributor profile you're looking for doesn't exist.</p>
          <SafeLink href="/dashboard/contributors">
            <Button>Back to Contributors</Button>
          </SafeLink>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <SafeLink href="/dashboard/contributors" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            ← Back to Contributors
          </SafeLink>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Contributor Profile</h1>
        </div>

        {/* Profile Overview */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start space-x-6">
              <div className="flex-shrink-0">
                {profile.avatarUrl ? (
                  <img 
                    className="w-20 h-20 rounded-full" 
                    src={profile.avatarUrl} 
                    alt={profile.githubLogin}
                  />
                ) : (
                  <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-medium">
                    {profile.githubLogin.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {profile.name || profile.githubLogin}
                  </h2>
                  {profile.hederaAccountId ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Ready for Payouts
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Wallet Needed
                    </span>
                  )}
                </div>
                <p className="text-gray-600">@{profile.githubLogin}</p>
                {profile.company && (
                  <p className="text-sm text-gray-500 mt-1">🏢 {profile.company}</p>
                )}
                {profile.location && (
                  <p className="text-sm text-gray-500">📍 {profile.location}</p>
                )}
                {profile.bio && (
                  <p className="text-gray-700 mt-2">{profile.bio}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Wallet Management */}
        <Card>
          <CardHeader>
            <CardTitle>💎 Hedera Wallet</CardTitle>
          </CardHeader>
          <CardContent>
            {editingWallet ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hedera Account ID
                  </label>
                  <input
                    type="text"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    placeholder="0.0.123456"
                    className="block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter your Hedera account ID (format: 0.0.xxxxxx)
                  </p>
                </div>
                <div className="flex space-x-3">
                  <Button onClick={updateWalletAddress}>
                    Save Wallet
                  </Button>
                  <Button variant="outline" onClick={() => setEditingWallet(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  {profile.hederaAccountId ? (
                    <div>
                      <p className="text-sm font-medium text-gray-900">Connected Wallet</p>
                      <p className="text-gray-600 font-mono">{profile.hederaAccountId}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-gray-900">No Wallet Connected</p>
                      <p className="text-gray-500">Add your Hedera wallet to receive payments</p>
                    </div>
                  )}
                </div>
                {isOwnProfile && (
                  <Button onClick={() => setEditingWallet(true)}>
                    {profile.hederaAccountId ? 'Update Wallet' : 'Add Wallet'}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">💻</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Total Commits</p>
                  <p className="text-2xl font-semibold text-gray-900">{profile.stats.totalCommits.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">🔀</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Pull Requests</p>
                  <p className="text-2xl font-semibold text-gray-900">{profile.stats.totalPRs}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">💰</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Total Earned</p>
                  <p className="text-2xl font-semibold text-gray-900">${profile.earnings.totalUsd.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Repositories */}
        <Card>
          <CardHeader>
            <CardTitle>📁 Active Repositories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {profile.stats.repositories.map((repo) => (
                <div key={repo} className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  <span className="text-sm text-gray-700">{repo}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>🔄 Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {profile.stats.recentActivity.length > 0 ? (
                profile.stats.recentActivity.map((activity, index) => (
                  <div key={index} className="border-l-2 border-blue-200 pl-4">
                    <p className="text-sm text-gray-700">{activity.description}</p>
                    <p className="text-xs text-gray-500">{activity.date}</p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No recent activity data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

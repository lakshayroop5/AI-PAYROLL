'use client';

/**
 * Main dashboard page showing overview and recent activity
 */

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { SafeLink } from '@/components/ui/safe-link';
import { Button } from '@/components/ui/button';
import DashboardLayout from '@/components/layout/dashboard-layout';
import BalanceTracker from '@/components/BalanceTracker';
import { formatCurrency, formatDate, getStatusColor, cn } from '@/lib/utils';

interface DashboardStats {
  totalRuns: number;
  activeRuns: number;
  totalContributors: number;
  totalDistributed: number;
  successRate: number;
}

interface RecentActivity {
  id: string;
  type: 'run_created' | 'run_executed' | 'contributor_added' | 'verification_completed';
  title: string;
  description: string;
  timestamp: string;
  status?: string;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [userWallet, setUserWallet] = useState<string>('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      setLoading(true);
      
      // Fetch dashboard stats
      const statsResponse = await fetch('/api/dashboard/stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      // Fetch recent activity
      const activityResponse = await fetch('/api/dashboard/activity');
      if (activityResponse.ok) {
        const activityData = await activityResponse.json();
        setRecentActivity(activityData.activities || []);
      }

      // Fetch user wallet address
      const walletResponse = await fetch('/api/settings/manager-wallet');
      if (walletResponse.ok) {
        const walletData = await walletResponse.json();
        setUserWallet(walletData.walletAddress || '');
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  const isManager = session?.user.roles?.includes('manager');
  const isContributor = session?.user.roles?.includes('contributor');
  const isSelfVerified = session?.user.selfVerified;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {session?.user.name || session?.user.email}!
            </h1>
            <p className="text-gray-600 mt-1">
              Here's what's happening with your AI Payroll system.
            </p>
          </div>
          
          {isManager && (
            <SafeLink href="/dashboard/runs/new">
              <Button>Create Payroll Run</Button>
            </SafeLink>
          )}
        </div>

        {/* Verification Status alert */}
        {!isSelfVerified && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Self Identity Verification Required
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    Complete your Self identity verification to {isManager ? 'create payroll runs' : 'receive payouts'}.
                  </p>
                </div>
                <div className="mt-4">
                  <div className="-mx-2 -my-1.5 flex">
                    <SafeLink href="/dashboard/profile#verification">
                      <Button variant="outline" size="sm">
                        Verify Identity
                      </Button>
                    </SafeLink>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PYUSD Balance Tracker */}
        {isManager && userWallet && (
          <BalanceTracker 
            walletAddress={userWallet}
            managerName={session?.user.email || 'Manager'}
          />
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {isManager && (
            <>
              <SafeLink href="/dashboard/repositories" className="block">
                <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <span className="text-2xl">📁</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500">Manage</p>
                      <p className="text-lg font-semibold text-gray-900">Repositories</p>
                    </div>
                  </div>
                </div>
              </SafeLink>

              <SafeLink href="/dashboard/runs/new" className="block">
                <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <span className="text-2xl">🚀</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500">Create</p>
                      <p className="text-lg font-semibold text-gray-900">Payroll Run</p>
                    </div>
                  </div>
                </div>
              </SafeLink>
            </>
          )}

          <SafeLink href="/dashboard/contributors" className="block">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">👥</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">View</p>
                  <p className="text-lg font-semibold text-gray-900">Contributors</p>
                </div>
              </div>
            </div>
          </SafeLink>

          <SafeLink href="/dashboard/profile" className="block">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">👤</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Update</p>
                  <p className="text-lg font-semibold text-gray-900">Profile</p>
                </div>
              </div>
            </div>
          </SafeLink>
        </div>

        {/* Stats Grid */}
        {stats && isManager && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">📊</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Total Runs</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.totalRuns}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">⚡</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Active Runs</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.activeRuns}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">👥</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Contributors</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.totalContributors}</p>
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
                    {formatCurrency(stats.totalDistributed)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">✅</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Success Rate</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {(stats.successRate * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {loading ? (
                <div className="p-6 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-500">Loading activity...</p>
                </div>
              ) : recentActivity.length > 0 ? (
                recentActivity.slice(0, 5).map((activity) => (
                  <div key={activity.id} className="p-6">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm">
                            {activity.type === 'run_created' && '🚀'}
                            {activity.type === 'run_executed' && '✅'}
                            {activity.type === 'contributor_added' && '👤'}
                            {activity.type === 'verification_completed' && '🔒'}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                        <p className="text-sm text-gray-500">{activity.description}</p>
                        <div className="flex items-center mt-2 space-x-2">
                          <p className="text-xs text-gray-400">{formatDate(activity.timestamp)}</p>
                          {activity.status && (
                            <span className={cn(
                              "inline-flex items-center px-2 py-1 rounded text-xs font-medium",
                              getStatusColor(activity.status)
                            )}>
                              {activity.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center">
                  <p className="text-sm text-gray-500">No recent activity</p>
                </div>
              )}
            </div>
            {recentActivity.length > 5 && (
              <div className="px-6 py-3 border-t border-gray-200">
                <SafeLink href="/dashboard/activity" className="text-sm text-blue-600 hover:text-blue-700">
                  View all activity →
                </SafeLink>
              </div>
            )}
          </div>

          {/* Getting Started Guide */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Getting Started</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                      isSelfVerified ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-600"
                    )}>
                      {isSelfVerified ? '✓' : '1'}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Complete Self Verification</p>
                    <p className="text-sm text-gray-500">
                      Verify your identity to access full features
                    </p>
                    {!isSelfVerified && (
                      <SafeLink href="/dashboard/profile#verification" className="text-sm text-blue-600 hover:text-blue-700">
                        Start verification →
                      </SafeLink>
                    )}
                  </div>
                </div>

                {isManager && (
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-6 h-6 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-xs font-medium">
                        2
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Add Repositories</p>
                      <p className="text-sm text-gray-500">
                        Connect your GitHub repositories for payroll management
                      </p>
                      <SafeLink href="/dashboard/repositories" className="text-sm text-blue-600 hover:text-blue-700">
                        Manage repositories →
                      </SafeLink>
                    </div>
                  </div>
                )}

                {isContributor && (
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-6 h-6 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-xs font-medium">
                        2
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Set Up Contributor Profile</p>
                      <p className="text-sm text-gray-500">
                        Link your Hedera account to receive payouts
                      </p>
                      <SafeLink href="/dashboard/profile#contributor" className="text-sm text-blue-600 hover:text-blue-700">
                        Complete profile →
                      </SafeLink>
                    </div>
                  </div>
                )}

                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-6 h-6 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-xs font-medium">
                      3
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Explore Documentation</p>
                    <p className="text-sm text-gray-500">
                      Learn more about AI Payroll features and best practices
                    </p>
                    <a href="#" className="text-sm text-blue-600 hover:text-blue-700">
                      Read docs →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
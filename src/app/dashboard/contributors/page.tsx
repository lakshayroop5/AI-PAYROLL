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
  userId: string;
  hederaAccountId: string;
  githubHandle?: string;
  active: boolean;
  totalEarnings: number;
  totalPayouts: number;
  createdAt: string;
  user?: {
    email: string;
    githubLogin?: string;
  };
}

export default function ContributorsPage() {
  const { data: session } = useSession();
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContributors();
  }, []);

  async function fetchContributors() {
    try {
      setLoading(true);
      const response = await fetch('/api/contributors');
      if (response.ok) {
        const data = await response.json();
        setContributors(data.contributors || []);
      }
    } catch (error) {
      console.error('Error fetching contributors:', error);
    } finally {
      setLoading(false);
    }
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
        </div>

        {/* Contributors List */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Active Contributors</h3>
          </div>
          
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading contributors...</p>
            </div>
          ) : contributors.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {contributors.map((contributor) => (
                <div key={contributor.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                          {contributor.user?.githubLogin?.charAt(0) || contributor.user?.email?.charAt(0) || '?'}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">
                          {contributor.user?.githubLogin || contributor.githubHandle || 'Unknown User'}
                        </h4>
                        <p className="text-sm text-gray-500">{contributor.user?.email}</p>
                        <p className="text-xs text-gray-400">
                          Hedera: {contributor.hederaAccountId}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center space-x-6">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            ${contributor.totalEarnings.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">Total Earnings</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {contributor.totalPayouts}
                          </p>
                          <p className="text-xs text-gray-500">Payouts</p>
                        </div>
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          contributor.active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {contributor.active ? 'Active' : 'Inactive'}
                        </span>
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
                <h3 className="mt-2 text-sm font-medium text-gray-900">No contributors</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Contributors will appear here once they set up their profiles.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                <p className="text-sm font-medium text-gray-500">Active Contributors</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {contributors.filter(c => c.active).length}
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
                  ${contributors.reduce((sum, c) => sum + c.totalEarnings, 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

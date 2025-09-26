'use client';

/**
 * User profile management page
 */

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { SafeLink } from '@/components/ui/safe-link';
import { Button } from '@/components/ui/button';
import DashboardLayout from '@/components/layout/dashboard-layout';

export default function ProfilePage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);

  const isManager = session?.user.roles?.includes('manager');
  const isContributor = session?.user.roles?.includes('contributor');
  const isSelfVerified = session?.user.selfVerified;

  async function handleAddRole(role: string) {
    try {
      setLoading(true);
      const response = await fetch('/api/user/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      
      if (response.ok) {
        // Refresh the page to update session
        window.location.reload();
      }
    } catch (error) {
      console.error('Error adding role:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
          <p className="text-gray-600 mt-1">
            Manage your account settings and preferences.
          </p>
        </div>

        {/* User Info */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Account Information</h3>
          </div>
          <div className="p-6">
            <div className="flex items-center space-x-6">
              <div className="flex-shrink-0">
                <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium text-xl">
                  {session?.user.name?.charAt(0) || session?.user.email?.charAt(0)}
                </div>
              </div>
              <div>
                <h4 className="text-xl font-medium text-gray-900">
                  {session?.user.name || 'Unknown User'}
                </h4>
                <p className="text-gray-500">{session?.user.email}</p>
                {session?.user.githubLogin && (
                  <p className="text-sm text-gray-400">
                    GitHub: @{session.user.githubLogin}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Roles */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Account Roles</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Manager</h4>
                  <p className="text-sm text-gray-500">
                    Create payroll runs and manage repositories
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  {isManager ? (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                      ✓ Active
                    </span>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleAddRole('manager')}
                      disabled={loading}
                    >
                      Become Manager
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Contributor</h4>
                  <p className="text-sm text-gray-500">
                    Receive payments for your code contributions
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  {isContributor ? (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                      ✓ Active
                    </span>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleAddRole('contributor')}
                      disabled={loading}
                    >
                      Become Contributor
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Self Verification */}
        <div id="verification" className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Identity Verification</h3>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Self Identity Verification</h4>
                <p className="text-sm text-gray-500">
                  Verify your identity to access full platform features
                </p>
              </div>
              <div className="flex items-center space-x-3">
                {isSelfVerified ? (
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                    ✓ Verified
                  </span>
                ) : (
                  <Button variant="outline" size="sm">
                    Start Verification
                  </Button>
                )}
              </div>
            </div>
            
            {!isSelfVerified && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-700">
                  Complete your identity verification to {isManager ? 'create payroll runs' : 'receive payouts'}.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Contributor Profile */}
        {isContributor && (
          <div id="contributor" className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Contributor Profile</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Hedera Account ID
                  </label>
                  <input
                    type="text"
                    placeholder="0.0.123456"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Your Hedera account ID for receiving payments
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Minimum Payout Threshold (USD)
                  </label>
                  <input
                    type="number"
                    placeholder="10.00"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Minimum amount before a payout is triggered
                  </p>
                </div>

                <Button>Save Contributor Settings</Button>
              </div>
            </div>
          </div>
        )}

        {/* Danger Zone */}
        <div className="bg-white shadow rounded-lg border border-red-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-red-900">Danger Zone</h3>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-red-900">Delete Account</h4>
                <p className="text-sm text-red-600">
                  Permanently delete your account and all associated data
                </p>
              </div>
              <Button variant="destructive">
                Delete Account
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

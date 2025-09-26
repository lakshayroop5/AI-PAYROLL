'use client';

/**
 * Settings page
 */

import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import DashboardLayout from '@/components/layout/dashboard-layout';

export default function SettingsPage() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState({
    email: true,
    payrollRuns: true,
    security: true,
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">
            Manage your account preferences and notifications.
          </p>
        </div>

        {/* Notifications */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Notification Preferences</h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Email Notifications</h4>
                <p className="text-sm text-gray-500">
                  Receive email updates about your account activity
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifications.email}
                onChange={(e) => setNotifications({ ...notifications, email: e.target.checked })}
                className="h-4 w-4 text-blue-600 rounded"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Payroll Run Notifications</h4>
                <p className="text-sm text-gray-500">
                  Get notified when payroll runs are completed or fail
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifications.payrollRuns}
                onChange={(e) => setNotifications({ ...notifications, payrollRuns: e.target.checked })}
                className="h-4 w-4 text-blue-600 rounded"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Security Alerts</h4>
                <p className="text-sm text-gray-500">
                  Important security notifications and login alerts
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifications.security}
                onChange={(e) => setNotifications({ ...notifications, security: e.target.checked })}
                className="h-4 w-4 text-blue-600 rounded"
              />
            </div>

            <div className="pt-4">
              <Button>Save Preferences</Button>
            </div>
          </div>
        </div>

        {/* API Settings */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">API Configuration</h3>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                GitHub Personal Access Token
              </label>
              <input
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Required for accessing private repositories and detailed PR data
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Hedera Network
              </label>
              <select className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2">
                <option value="testnet">Testnet</option>
                <option value="mainnet">Mainnet</option>
              </select>
            </div>

            <div className="pt-4">
              <Button>Update API Settings</Button>
            </div>
          </div>
        </div>

        {/* System Information */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">System Information</h3>
          </div>
          <div className="p-6">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Environment</dt>
                <dd className="text-sm text-gray-900">Development</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Version</dt>
                <dd className="text-sm text-gray-900">v1.0.0</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                <dd className="text-sm text-gray-900">{new Date().toLocaleDateString()}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">User ID</dt>
                <dd className="text-sm text-gray-900 font-mono">{session?.user.id}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

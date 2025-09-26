'use client';

/**
 * Create new payroll run page
 */

import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { SafeLink } from '@/components/ui/safe-link';
import { Button } from '@/components/ui/button';
import DashboardLayout from '@/components/layout/dashboard-layout';

export default function NewPayrollRunPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    usdBudget: '',
    asset: 'HBAR',
    repositories: [] as string[],
  });

  const isManager = session?.user.roles?.includes('manager');
  const isSelfVerified = session?.user.selfVerified;

  if (!isManager) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You need manager role to create payroll runs.</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!isSelfVerified) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Verification Required</h1>
          <p className="text-gray-600 mb-6">
            You need to complete Self identity verification before creating payroll runs.
          </p>
          <SafeLink href="/dashboard/profile#verification">
            <Button>Complete Verification</Button>
          </SafeLink>
        </div>
      </DashboardLayout>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/payroll/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        // Redirect to runs page
        window.location.href = '/dashboard/runs';
      } else {
        alert('Failed to create payroll run');
      }
    } catch (error) {
      console.error('Error creating payroll run:', error);
      alert('Error creating payroll run');
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Payroll Run</h1>
          <p className="text-gray-600 mt-1">
            Set up a new payroll distribution for your repositories.
          </p>
        </div>

        {/* Form */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Payroll Run Details</h3>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Start Date
                </label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  End Date
                </label>
                <input
                  type="date"
                  required
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>

            {/* Budget */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Budget (USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="100.00"
                value={formData.usdBudget}
                onChange={(e) => setFormData({ ...formData, usdBudget: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Total USD amount to distribute among contributors
              </p>
            </div>

            {/* Asset */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Payment Asset
              </label>
              <select
                value={formData.asset}
                onChange={(e) => setFormData({ ...formData, asset: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="HBAR">HBAR (Hedera Hashgraph)</option>
                <option value="USDC">USDC (USD Coin)</option>
              </select>
            </div>

            {/* Repositories */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Repositories
              </label>
              <div className="mt-1 p-4 border border-gray-300 rounded-md">
                <p className="text-sm text-gray-500">
                  No repositories connected. <SafeLink href="/dashboard/repositories" className="text-blue-600 hover:text-blue-700">Add repositories</SafeLink> to include them in payroll runs.
                </p>
              </div>
            </div>

            {/* Distribution Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Distribution Method
              </label>
              <select className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2">
                <option value="PR_COUNT_PROPORTIONAL">Proportional by PR Count</option>
                <option value="LINES_WEIGHTED">Weighted by Lines Changed</option>
                <option value="EQUAL_SPLIT">Equal Split</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                How to distribute the budget among contributors
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <SafeLink href="/dashboard/runs">
                <Button variant="outline">Cancel</Button>
              </SafeLink>
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Payroll Run'}
              </Button>
            </div>
          </form>
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                About Payroll Runs
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  Payroll runs automatically distribute payments to contributors based on their merged pull requests during the specified date range.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

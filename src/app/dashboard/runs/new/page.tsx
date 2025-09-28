'use client';

/**
 * Create new payroll run page
 */

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { SafeLink } from '@/components/ui/safe-link';
import { Button } from '@/components/ui/button';
import DashboardLayout from '@/components/layout/dashboard-layout';

interface Repository {
  id: string;
  name: string;
  fullName: string;
  url: string;
  isActive: boolean;
}

export default function NewPayrollRunPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [repositoriesLoading, setRepositoriesLoading] = useState(true);
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    usdBudget: '',
    asset: 'HBAR',
    repositories: [] as string[],
  });

  const isManager = session?.user.roles?.includes('manager');
  const isSelfVerified = session?.user.selfVerified;

  useEffect(() => {
    if (session?.user) {
      fetchRepositories();
    }
  }, [session]);

  async function fetchRepositories() {
    try {
      setRepositoriesLoading(true);
      const response = await fetch('/api/repositories');
      if (response.ok) {
        const data = await response.json();
        console.log('Repository API response:', data); // Debug log
        
        // Transform storedRepos to match our interface
        const transformedRepos: Repository[] = (data.storedRepos || []).map((repo: any) => ({
          id: repo.id,
          name: repo.name,
          fullName: repo.fullName,
          url: `https://github.com/${repo.fullName}`,
          isActive: repo.active
        }));
        
        setRepositories(transformedRepos);
        console.log('Transformed repositories:', transformedRepos); // Debug log
      } else {
        console.error('Failed to fetch repositories:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching repositories:', error);
    } finally {
      setRepositoriesLoading(false);
    }
  }

  function toggleRepository(repoId: string) {
    setFormData(prev => ({
      ...prev,
      repositories: prev.repositories.includes(repoId)
        ? prev.repositories.filter(id => id !== repoId)
        : [...prev.repositories, repoId]
    }));
  }

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
    
    // Validation
    if (formData.repositories.length === 0) {
      alert('Please select at least one repository for the payroll run.');
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      alert('Please select both start and end dates.');
      return;
    }

    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      alert('End date must be after start date.');
      return;
    }

    if (!formData.usdBudget || parseFloat(formData.usdBudget) <= 0) {
      alert('Please enter a valid budget amount.');
      return;
    }

    setLoading(true);

    try {
      // Transform form data to match API expectations
      const payrollData = {
        action: 'create',
        repositoryIds: formData.repositories,
        startDate: formData.startDate,
        endDate: formData.endDate,
        usdBudget: parseFloat(formData.usdBudget),
        asset: formData.asset,
        distributionMode: 'PR_COUNT_PROPORTIONAL',
        environment: 'testnet'
      };

      console.log('Sending payroll data:', payrollData); // Debug log

      const response = await fetch('/api/payroll/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payrollData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Payroll creation result:', result); // Debug log
        alert(`✅ Payroll run created successfully!\nRun ID: ${result.run?.id || 'N/A'}`);
        // Redirect to runs page
        window.location.href = '/dashboard/runs';
      } else {
        const error = await response.json();
        console.error('Payroll creation error:', error); // Debug log
        alert(`Failed to create payroll run: ${error.error || 'Unknown error'}\n\nStatus: ${response.status}\nDetails: ${JSON.stringify(error, null, 2)}`);
      }
    } catch (error) {
      console.error('Error creating payroll run:', error);
      alert('Error creating payroll run. Please try again.');
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
                {repositoriesLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-gray-500">Loading repositories...</span>
                  </div>
                ) : repositories.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-700 mb-3">
                      Select repositories to include in this payroll run:
                    </p>
                    {repositories.map((repo) => (
                      <label key={repo.id} className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          checked={formData.repositories.includes(repo.id)}
                          onChange={() => toggleRepository(repo.id)}
                          className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-900">
                              {repo.name}
                            </span>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              repo.isActive 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {repo.isActive ? 'Active' : 'Setup Pending'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {repo.fullName}
                          </p>
                        </div>
                      </label>
                    ))}
                    {formData.repositories.length > 0 && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-md">
                        <p className="text-sm text-blue-800">
                          ✓ {formData.repositories.length} repository{formData.repositories.length > 1 ? 'ies' : 'y'} selected for payroll run
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-500">
                      No repositories found. 
                    </p>
                    <SafeLink href="/dashboard/repositories" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                      Add repositories
                    </SafeLink>
                    <span className="text-sm text-gray-500"> to include them in payroll runs.</span>
                  </div>
                )}
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
              <Button 
                type="submit" 
                disabled={loading || formData.repositories.length === 0}
                className={formData.repositories.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}
              >
                {loading ? 'Creating...' : 'Create Payroll Run'}
              </Button>
            </div>
            
            {formData.repositories.length === 0 && repositories.length > 0 && (
              <p className="text-xs text-amber-600 text-center">
                Please select at least one repository to create a payroll run
              </p>
            )}
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

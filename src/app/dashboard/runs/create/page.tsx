'use client';

/**
 * Create Payroll Run Page - Repository-Centric Flow
 */

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SafeLink } from '@/components/ui/safe-link';
import { Button } from '@/components/ui/button';
import DashboardLayout from '@/components/layout/dashboard-layout';

interface Repository {
  id: string;
  name: string;
  fullName: string;
  description?: string;
  active: boolean;
}

interface PayoutRule {
  type: 'equal' | 'contribution_based' | 'role_based';
  description: string;
}

export default function CreatePayrollRunPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [formData, setFormData] = useState({
    repositoryId: '',
    startDate: '',
    endDate: '',
    usdBudget: 1000,
    payoutRule: 'contribution_based' as PayoutRule['type'],
    description: ''
  });

  const isManager = session?.user.roles?.includes('manager');

  useEffect(() => {
    if (isManager) {
      fetchRepositories();
    }
  }, [isManager]);

  async function fetchRepositories() {
    try {
      setLoadingRepos(true);
      console.log('🔍 Fetching repositories...');
      
      const response = await fetch('/api/repositories');
      console.log('📡 Repository API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📁 Repository API data:', data);
        
        if (data.storedRepos) {
          console.log(`✅ Found ${data.storedRepos.length} stored repositories from API`);
          // Filter for active repositories
          const activeRepos = data.storedRepos.filter((repo: Repository) => repo.active);
          console.log(`✅ Found ${activeRepos.length} active repositories`);
          setRepositories(activeRepos);
        } else {
          console.warn('⚠️ No stored repositories found:', data);
          setRepositories([]);
        }
      } else {
        const errorData = await response.json();
        console.error('❌ Repository API error:', errorData);
      }
    } catch (error) {
      console.error('❌ Error fetching repositories:', error);
    } finally {
      setLoadingRepos(false);
    }
  }

  const handleRepositorySelect = (repo: Repository) => {
    setSelectedRepo(repo);
    setFormData(prev => ({ ...prev, repositoryId: repo.id }));
  };

  const payoutRules: { [key in PayoutRule['type']]: PayoutRule } = {
    contribution_based: {
      type: 'contribution_based',
      description: 'Distribute based on actual GitHub contributions (commits, PRs). Contributors with more activity get larger payouts.'
    },
    equal: {
      type: 'equal',
      description: 'Split the budget equally among all contributors. Every contributor gets the same amount.'
    },
    role_based: {
      type: 'role_based',
      description: 'Distribute based on repository roles (admin, maintainer, contributor). Higher roles get larger payouts.'
    }
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Calculate default dates
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const defaultStartDate = startOfWeek.toISOString().split('T')[0];
    const defaultEndDate = endOfWeek.toISOString().split('T')[0];
    
    // Use default dates if not explicitly set
    const finalStartDate = formData.startDate || defaultStartDate;
    const finalEndDate = formData.endDate || defaultEndDate;
    
    console.log('🔍 Form validation:', {
      repositoryId: formData.repositoryId,
      selectedRepo: selectedRepo?.id,
      startDate: finalStartDate,
      endDate: finalEndDate,
      budget: formData.usdBudget
    });
    
    if (!formData.repositoryId || !finalStartDate || !finalEndDate || !formData.usdBudget) {
      alert('Please fill in all required fields including repository selection');
      return;
    }

    const payload = {
      action: 'create',
      repositoryIds: [formData.repositoryId],
      startDate: finalStartDate,
      endDate: finalEndDate,
      distributionMode: formData.payoutRule === 'equal' ? 'EQUAL_DISTRIBUTION' : 
                      formData.payoutRule === 'contribution_based' ? 'PR_COUNT_PROPORTIONAL' : 
                      'PR_COUNT_PROPORTIONAL', // Default for role_based
      usdBudget: formData.usdBudget,
      asset: 'HBAR',
      environment: 'testnet',
      description: formData.description
    };

    console.log('🚀 Creating payroll run with payload:', payload);

    try {
      setLoading(true);
      const response = await fetch('/api/payroll/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`✅ Payroll run created successfully! Run #${result.run?.runNumber || 'N/A'} for ${selectedRepo?.fullName}`);
        router.push('/dashboard/runs');
      } else {
        alert(`❌ Failed to create payroll run: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ Error creating payroll run: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Set default dates (current week)
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const defaultStartDate = formData.startDate || startOfWeek.toISOString().split('T')[0];
  const defaultEndDate = formData.endDate || endOfWeek.toISOString().split('T')[0];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create Payroll Run</h1>
            <p className="text-gray-600 mt-1">Set up a new payroll period for your contributors</p>
          </div>
          <SafeLink href="/dashboard/runs">
            <Button variant="outline">← Back to Runs</Button>
          </SafeLink>
        </div>

        {/* Repository Selection */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Step 1: Select Repository</h3>
            <p className="text-sm text-gray-600 mt-1">Choose which repository to create payroll for</p>
          </div>
          
          <div className="p-6">
            {loadingRepos ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500">Loading repositories...</p>
              </div>
            ) : repositories.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-500">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No active repositories found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    You need to add and activate repositories first. Check the browser console for debugging information.
                  </p>
                  <div className="mt-4 space-y-2">
                    <SafeLink href="/dashboard/repositories">
                      <Button className="mr-2" size="sm">Manage Repositories</Button>
                    </SafeLink>
                    <Button 
                      onClick={fetchRepositories} 
                      variant="outline" 
                      size="sm"
                      disabled={loadingRepos}
                    >
                      {loadingRepos ? 'Refreshing...' : '🔄 Refresh'}
                    </Button>
                  </div>
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-left">
                    <p className="text-xs text-yellow-800">
                      <strong>Debug Steps:</strong><br />
                      1. Open browser console (F12)<br />
                      2. Look for repository API logs<br />
                      3. Ensure repositories are added and active<br />
                      4. Check GitHub token permissions
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {repositories.map((repo) => (
                  <div
                    key={repo.id}
                    onClick={() => handleRepositorySelect(repo)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedRepo?.id === repo.id
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">{repo.fullName}</h4>
                        {repo.description && (
                          <p className="text-sm text-gray-600 mt-1">{repo.description}</p>
                        )}
                      </div>
                      {selectedRepo?.id === repo.id && (
                        <div className="text-blue-600">
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Payroll Configuration */}
        {selectedRepo && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Step 2: Configure Payroll</h3>
              <p className="text-sm text-gray-600 mt-1">Set payout rules and budget for {selectedRepo.fullName}</p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Payout Rule Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Payout Distribution Rule *
                </label>
                <div className="space-y-3">
                  {Object.entries(payoutRules).map(([key, rule]) => (
                    <div key={key} className="relative">
                      <label className="flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="payoutRule"
                          value={key}
                          checked={formData.payoutRule === key}
                          onChange={(e) => setFormData({ ...formData, payoutRule: e.target.value as PayoutRule['type'] })}
                          className="mt-1 focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {key === 'contribution_based' && '📊 Contribution-Based'}
                            {key === 'equal' && '⚖️ Equal Distribution'}
                            {key === 'role_based' && '👑 Role-Based'}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">{rule.description}</p>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Start Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formData.startDate || defaultStartDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date *
                  </label>
                  <input
                    type="date"
                    value={formData.endDate || defaultEndDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Budget */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Total Budget (USD) *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={formData.usdBudget}
                    onChange={(e) => setFormData({ ...formData, usdBudget: parseFloat(e.target.value) || 0 })}
                    className="block w-full pl-7 border border-gray-300 rounded-md px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="1000.00"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  This amount will be distributed using the selected payout rule
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Brief description of this payroll period..."
                />
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <span className="text-2xl">🎯</span>
                  <div>
                    <h4 className="font-medium text-blue-900">Dynamic Payroll Process</h4>
                    <ul className="text-blue-700 text-sm mt-2 space-y-1">
                      <li>• Contributors will be fetched live from {selectedRepo.fullName}</li>
                      <li>• Payments calculated using {payoutRules[formData.payoutRule].description.toLowerCase()}</li>
                      <li>• Failed payments are handled gracefully with retry options</li>
                      <li>• Only contributors with valid wallet addresses will receive payments</li>
                    </ul>
                    <div className="mt-3">
                      <SafeLink href="/dashboard/contributors">
                        <Button size="sm" variant="outline" className="text-blue-800 border-blue-300">
                          Manage Contributors →
                        </Button>
                      </SafeLink>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <SafeLink href="/dashboard/runs">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </SafeLink>
                <Button 
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    `Create Payroll for ${selectedRepo.fullName}`
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Preview */}
        {selectedRepo && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Step 3: Preview</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-gray-500">Repository</p>
                  <p className="font-medium">{selectedRepo.fullName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Payout Rule</p>
                  <p className="font-medium">
                    {formData.payoutRule === 'contribution_based' && '📊 Contribution-Based'}
                    {formData.payoutRule === 'equal' && '⚖️ Equal Distribution'}
                    {formData.payoutRule === 'role_based' && '👑 Role-Based'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Budget</p>
                  <p className="font-medium text-green-600">${formData.usdBudget.toLocaleString()}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-500">Period</p>
                  <p className="font-medium">
                    {formData.startDate || defaultStartDate} to {formData.endDate || defaultEndDate}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status After Creation</p>
                  <p className="font-medium text-yellow-600">PENDING (ready for execution)</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

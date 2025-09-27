'use client';

/**
 * Payroll Run Detail Page
 * Shows detailed information about a specific payroll run
 */

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { SafeLink } from '@/components/ui/safe-link';
import { Button } from '@/components/ui/button';
import DashboardLayout from '@/components/layout/dashboard-layout';

interface PayrollRunDetail {
  id: string;
  runNumber: number;
  startDate: string;
  endDate: string;
  usdBudget: number;
  status: string;
  totalPrCount: number;
  totalPayouts: number;
  successfulPayouts: number;
  createdAt: string;
  updatedAt: string;
  payouts: Array<{
    id: string;
    contributorId: string;
    usdAmount: number;
    status: string;
    transactionId?: string;
    contributor: {
      githubHandle: string;
      hederaAccountId?: string;
    };
  }>;
}

export default function PayrollRunDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const runId = params?.id as string;
  
  const [run, setRun] = useState<PayrollRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    if (runId) {
      fetchPayrollRunDetail();
    }
  }, [runId]);

  async function fetchPayrollRunDetail() {
    try {
      setLoading(true);
      const response = await fetch(`/api/payroll/runs/${runId}`);
      if (response.ok) {
        const data = await response.json();
        setRun(data.run);
      } else {
        console.error('Failed to fetch payroll run detail');
      }
    } catch (error) {
      console.error('Error fetching payroll run detail:', error);
    } finally {
      setLoading(false);
    }
  }

  async function executePayrollWithHedera() {
    try {
      setExecuting(true);
      const response = await fetch('/api/payroll/execute-hedera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payrollRunId: runId })
      });

      const result = await response.json();
      
      if (result.success) {
        const breakdown = result.data.paymentBreakdown;
        const contributions = result.data.contributionBreakdown || [];
        
        let contributionDetails = '';
        if (contributions.length > 0) {
          contributionDetails = '\n\nContribution-Based Payments:\n' + 
            contributions.map(c => `• ${c.contributor}: ${c.contributions} contributions → $${c.amount} (${c.percentage})`).join('\n');
        }
        
        const summaryText = `✅ AI Payroll executed successfully!
        
Budget Distribution: $${result.data.totalAmountUsd} / $${result.data.totalBudget}
Based on ${result.data.totalContributions} total GitHub contributions
Payments: ${result.data.paymentsSuccessful}/${result.data.paymentsCount} successful

Payment Types:
• Hedera: ${breakdown.hederaPayments} payments
• Ethereum: ${breakdown.ethereumPayments} payments  
• Bitcoin: ${breakdown.bitcoinPayments} payments
• Other: ${breakdown.otherPayments} payments${contributionDetails}

${result.data.hederaExplorer ? `\nHedera Explorer: ${result.data.hederaExplorer}` : ''}`;
        
        alert(summaryText);
        fetchPayrollRunDetail(); // Refresh the data
      } else {
        alert(`❌ Payroll execution failed: ${result.error}\n\n${result.message || ''}`);
      }
    } catch (error) {
      alert(`❌ Error executing payroll: ${error}`);
    } finally {
      setExecuting(false);
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'EXECUTING':
        return 'bg-blue-100 text-blue-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      case 'PENDING':
      case 'APPROVED':
        return 'bg-yellow-100 text-yellow-800';
      case 'PARTIAL':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function getPayoutStatusColor(status: string) {
    switch (status) {
      case 'PAID':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  const isManager = session?.user.roles?.includes('manager');

  if (!isManager) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You need manager role to access payroll runs.</p>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">Loading payroll run details...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!run) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Payroll Run Not Found</h1>
          <p className="text-gray-600 mb-6">The requested payroll run could not be found.</p>
          <SafeLink href="/dashboard/runs">
            <Button>← Back to Payroll Runs</Button>
          </SafeLink>
        </div>
      </DashboardLayout>
    );
  }

  const contributorsWithWallets = run.payouts.filter(p => p.contributor.hederaAccountId).length;
  const contributorsWithoutWallets = run.payouts.filter(p => !p.contributor.hederaAccountId).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <SafeLink href="/dashboard/runs">
                <Button variant="outline" size="sm">← Back</Button>
              </SafeLink>
              <h1 className="text-2xl font-bold text-gray-900">
                Payroll Run #{run.runNumber}
              </h1>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(run.status)}`}>
                {run.status}
              </span>
            </div>
            <p className="text-gray-600 mt-1">
              {new Date(run.startDate).toLocaleDateString()} - {new Date(run.endDate).toLocaleDateString()}
            </p>
          </div>
          {run.status === 'APPROVED' && (
            <Button 
              onClick={executePayrollWithHedera}
              disabled={executing}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {executing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Executing...
                </>
              ) : (
                <>💎 Pay with Hedera</>
              )}
            </Button>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">💰</span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Total Budget</p>
                <p className="text-2xl font-semibold text-gray-900">${run.usdBudget}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">📝</span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Pull Requests</p>
                <p className="text-2xl font-semibold text-gray-900">{run.totalPrCount}</p>
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
                <p className="text-2xl font-semibold text-gray-900">{run.totalPayouts}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">✅</span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Successful Payouts</p>
                <p className="text-2xl font-semibold text-green-600">{run.successfulPayouts}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Wallet Status Alert */}
        {contributorsWithoutWallets > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="font-medium text-yellow-900">Wallet Setup Required</h3>
                <p className="text-yellow-700 text-sm mt-1">
                  {contributorsWithoutWallets} contributor(s) need to add their Hedera wallet addresses before payroll can be executed.
                </p>
                <div className="mt-2">
                  <SafeLink href="/dashboard/contributors">
                    <Button size="sm" variant="outline" className="text-yellow-800 border-yellow-300">
                      Manage Contributor Wallets →
                    </Button>
                  </SafeLink>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payouts List */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Contributor Payouts</h3>
              <div className="text-sm text-gray-500">
                {contributorsWithWallets} ready • {contributorsWithoutWallets} pending setup
              </div>
            </div>
          </div>
          
          <div className="divide-y divide-gray-200">
            {run.payouts.map((payout) => (
              <div key={payout.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">
                          {payout.contributor.githubHandle?.[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">
                        @{payout.contributor.githubHandle}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {payout.contributor.hederaAccountId ? (
                          <span className="font-mono">{payout.contributor.hederaAccountId}</span>
                        ) : (
                          <span className="text-yellow-600">No wallet address</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        ${payout.usdAmount.toFixed(2)}
                      </p>
                      {payout.transactionId && (
                        <p className="text-xs text-blue-600 font-mono">
                          {payout.transactionId}
                        </p>
                      )}
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getPayoutStatusColor(payout.status)}`}>
                      {payout.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Run Metadata */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Run Details</h3>
          </div>
          <div className="p-6">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Run ID</dt>
                <dd className="text-sm text-gray-900 font-mono">{run.id}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="text-sm text-gray-900">{run.status}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Created</dt>
                <dd className="text-sm text-gray-900">{new Date(run.createdAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                <dd className="text-sm text-gray-900">{new Date(run.updatedAt).toLocaleString()}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

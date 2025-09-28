'use client';

/**
 * Payroll runs management page
 */

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { SafeLink } from '@/components/ui/safe-link';
import { Button } from '@/components/ui/button';
import DashboardLayout from '@/components/layout/dashboard-layout';

interface PayrollRun {
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
}

export default function PayrollRunsPage() {
  const { data: session } = useSession();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchPayrollRuns();
  }, []);

  async function fetchPayrollRuns() {
    try {
      setLoading(true);
      const response = await fetch('/api/payroll/runs');
      if (response.ok) {
        const data = await response.json();
        setRuns(data.runs || []);
      }
    } catch (error) {
      console.error('Error fetching payroll runs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function executePayrollWithHedera(runId: string) {
    try {
      setExecuting(runId);
      const response = await fetch('/api/payroll/execute-hedera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payrollRunId: runId })
      });

      const result = await response.json();
      
      if (result.success) {
        const breakdown = result.data.paymentBreakdown || { hederaPayments: 0, ethereumPayments: 0, bitcoinPayments: 0, otherPayments: 0 };
        const contributions = result.data.contributionBreakdown || [];
        
        let contributionDetails = '';
        if (contributions.length > 0) {
          contributionDetails = '\n\nContribution-Based Payments:\n' + 
            contributions.map((c: any) => `• ${c.contributor}: ${c.contributions} contributions → $${c.amount} (${c.percentage})`).join('\n');
        }
        
        const summaryText = `✅ Foss It executed successfully!
        
Budget Distribution: $${result.data.totalAmountUsd} / $${result.data.totalBudget || 1000}
Based on ${result.data.totalContributions || 'demo'} total contributions
Payments: ${result.data.paymentsSuccessful}/${result.data.paymentsCount} successful

Payment Types:
• Hedera: ${breakdown.hederaPayments} payments
• Ethereum: ${breakdown.ethereumPayments} payments  
• Bitcoin: ${breakdown.bitcoinPayments} payments
• Other: ${breakdown.otherPayments} payments${contributionDetails}

${result.data.transactionId ? `\nTransaction ID: ${result.data.transactionId}` : ''}`;
        
        alert(summaryText);
        fetchPayrollRuns(); // Refresh the list
      } else {
        alert(`❌ Payroll execution failed: ${result.error}\n\n${result.message || ''}`);
      }
    } catch (error) {
      alert(`❌ Error executing payroll: ${error}`);
    } finally {
      setExecuting(null);
    }
  }

  async function approvePayrollRun(runId: string, runNumber: number) {
    if (!confirm(`Are you sure you want to approve and execute Payroll Run #${runNumber}? This will start the payment process.`)) {
      return;
    }

    try {
      setExecuting(runId);
      const response = await fetch('/api/payroll/execute-hedera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payrollRunId: runId })
      });

      const result = await response.json();
      
      if (result.success) {
        const breakdown = result.data.paymentBreakdown || { hederaPayments: 0, ethereumPayments: 0, bitcoinPayments: 0, otherPayments: 0 };
        const contributions = result.data.contributionBreakdown || [];
        
        let contributionDetails = '';
        if (contributions.length > 0) {
          contributionDetails = '\n\nContribution-Based Payments:\n' + 
            contributions.map((c: any) => `• ${c.contributor}: ${c.contributions} contributions → $${c.amount} (${c.percentage})`).join('\n');
        }
        
        const summaryText = `✅ Payroll Run #${runNumber} executed successfully!
        
Budget Distribution: $${result.data.totalAmountUsd} / $${result.data.totalBudget || 1000}
Based on ${result.data.totalContributions || 'demo'} total contributions
Payments: ${result.data.paymentsSuccessful}/${result.data.paymentsCount} successful

Payment Types:
• Hedera: ${breakdown.hederaPayments} payments
• Ethereum: ${breakdown.ethereumPayments} payments  
• Bitcoin: ${breakdown.bitcoinPayments} payments
• Other: ${breakdown.otherPayments} payments${contributionDetails}

${result.data.transactionId ? `\nTransaction ID: ${result.data.transactionId}` : ''}`;
        
        alert(summaryText);
        fetchPayrollRuns(); // Refresh the list
      } else {
        alert(`❌ Payroll execution failed: ${result.error}\n\n${result.message || ''}`);
      }
    } catch (error) {
      alert(`❌ Error executing payroll: ${error}`);
    } finally {
      setExecuting(null);
    }
  }

  async function deletePayrollRun(runId: string, runNumber: number) {
    if (!confirm(`Are you sure you want to delete Payroll Run #${runNumber}? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeleting(runId);
      const response = await fetch(`/api/payroll/runs/${runId}/delete`, {
        method: 'DELETE'
      });

      const result = await response.json();
      
      if (result.success) {
        alert('✅ Payroll run deleted successfully!');
        fetchPayrollRuns(); // Refresh the list
      } else {
        alert(`❌ Failed to delete payroll run: ${result.error}\n\n${result.message || ''}`);
      }
    } catch (error) {
      alert(`❌ Error deleting payroll run: ${error}`);
    } finally {
      setDeleting(null);
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

  function getStatusColor(status: string) {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'EXECUTING':
        return 'bg-blue-100 text-blue-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'PREVIEW_READY':
        return 'bg-purple-100 text-purple-800';
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Payroll Runs</h1>
          <SafeLink href="/dashboard/runs/create">
            <Button>Create New Run</Button>
          </SafeLink>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-6">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 text-sm font-medium rounded-md ${
              activeTab === 'active'
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Active Payrolls ({runs.filter(r => r.status !== 'COMPLETED' && r.status !== 'FAILED').length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-medium rounded-md ${
              activeTab === 'history'
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            History ({runs.filter(r => r.status === 'COMPLETED' || r.status === 'FAILED').length})
          </button>
        </div>

        {/* Payroll Runs List */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              {activeTab === 'active' ? 'Active Payroll Runs' : 'Payroll History'}
            </h3>
          </div>
          
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading payroll runs...</p>
            </div>
          ) : runs.length === 0 ? (
            <div className="p-6 text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No payroll runs yet</h3>
              <p className="text-gray-600 mb-4">Create your first payroll run to get started.</p>
              <SafeLink href="/dashboard/runs/create">
                <Button>Create New Run</Button>
              </SafeLink>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {runs
                .filter(run => activeTab === 'active' 
                  ? (run.status !== 'COMPLETED' && run.status !== 'FAILED')
                  : (run.status === 'COMPLETED' || run.status === 'FAILED')
                )
                .map((run) => (
                  <div key={run.id} className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">
                          Payroll Run #{run.runNumber}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {new Date(run.startDate).toLocaleDateString()} - {new Date(run.endDate).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-400">
                          Created {new Date(run.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getStatusColor(run.status)}`}>
                          {run.status}
                        </span>
                        
                        {/* Action buttons based on status and tab */}
                        {activeTab === 'active' && (
                          <>
                            {run.status === 'PREVIEW_READY' && (
                              <Button
                                onClick={() => approvePayrollRun(run.id, run.runNumber)}
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                ✅ Approve & Execute
                              </Button>
                            )}
                            
                            {run.status === 'APPROVED' && (
                              <Button
                                onClick={() => executePayrollWithHedera(run.id)}
                                disabled={executing === run.id}
                                size="sm"
                                className="bg-purple-600 hover:bg-purple-700"
                              >
                                {executing === run.id ? (
                                  <>
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                                    Paying...
                                  </>
                                ) : (
                                  <>💎 Pay with Hedera</>
                                )}
                              </Button>
                            )}
                            
                            {(run.status === 'PENDING' || run.status === 'APPROVED' || run.status === 'PREVIEW_READY') && (
                              <Button
                                onClick={() => deletePayrollRun(run.id, run.runNumber)}
                                disabled={deleting === run.id}
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-300 hover:bg-red-50"
                              >
                                {deleting === run.id ? (
                                  <>
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600 mr-2"></div>
                                    Deleting...
                                  </>
                                ) : (
                                  <>🗑️ Delete</>
                                )}
                              </Button>
                            )}
                          </>
                        )}
                        
                        <SafeLink href={`/dashboard/runs/${run.id}`}>
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </SafeLink>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Budget</p>
                        <p className="text-sm font-medium">${run.usdBudget}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Contributors</p>
                        <p className="text-sm font-medium">{run.totalPayouts}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Paid Out</p>
                        <p className="text-sm font-medium">{run.successfulPayouts}/{run.totalPayouts}</p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

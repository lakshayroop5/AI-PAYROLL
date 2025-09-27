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
        alert(`✅ Payroll executed successfully!\nTransaction: ${result.data.transactionId}\nPayments: ${result.data.paymentsCount}\n\nView on Hedera Explorer: ${result.data.hederaExplorer}`);
        fetchPayrollRuns(); // Refresh the list
      } else {
        alert(`❌ Payroll execution failed: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ Error executing payroll: ${error}`);
    } finally {
      setExecuting(null);
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
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payroll Runs</h1>
            <p className="text-gray-600 mt-1">
              Manage and track your payroll distributions.
            </p>
          </div>
          <SafeLink href="/dashboard/runs/new">
            <Button>Create New Run</Button>
          </SafeLink>
        </div>

        {/* Runs List */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Payroll Runs</h3>
          </div>
          
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading payroll runs...</p>
            </div>
          ) : runs.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {runs.map((run) => (
                <div key={run.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-medium text-gray-900">
                        Run #{run.runNumber}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {new Date(run.startDate).toLocaleDateString()} - {new Date(run.endDate).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-500">
                        Budget: ${run.usdBudget} • {run.totalPrCount} PRs • {run.successfulPayouts}/{run.totalPayouts} payouts
                      </p>
                      <p className="text-xs text-gray-400">
                        Created {new Date(run.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getStatusColor(run.status)}`}>
                        {run.status}
                      </span>
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
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center">
              <div className="text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No payroll runs</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Get started by creating your first payroll run.
                </p>
                <div className="mt-6">
                  <SafeLink href="/dashboard/runs/new">
                    <Button>Create Payroll Run</Button>
                  </SafeLink>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

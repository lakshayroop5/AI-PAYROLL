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
  const [payslips, setPayslips] = useState<any[]>([]);
  const [generatingPayslips, setGeneratingPayslips] = useState(false);
  const [payslipError, setPayslipError] = useState<string | null>(null);

  useEffect(() => {
    if (runId) {
      fetchPayrollRunDetail();
      fetchPayslips();
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

  async function fetchPayslips() {
    try {
      const response = await fetch(`/api/payroll/payslips/${runId}`);
      if (response.ok) {
        const data = await response.json();
        setPayslips(data.payslips || []);
      }
    } catch (error) {
      console.error('Error fetching payslips:', error);
    }
  }

  async function generatePayslips(regenerate = false) {
    try {
      setGeneratingPayslips(true);
      setPayslipError(null);
      
      const response = await fetch(`/api/payroll/payslips/${runId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyInfo: {
            name: `${session?.user?.name || 'Foss It'} Organization`,
            address: 'Decentralized Autonomous Organization',
            website: 'https://ai-payroll.vercel.app'
          },
          regenerate
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setPayslips(result.payslips || []);
        
        // Check if any payslips were generated with simulation
        const simulatedCount = result.payslips?.filter((p: any) => p.metadata?.note?.includes('simulation')).length || 0;
        const message = simulatedCount > 0 
          ? `✅ Generated ${result.summary.successful}/${result.summary.total} payslips successfully!\n\n⚠️ Note: ${simulatedCount} payslip(s) used simulation due to Lighthouse API unavailability.\nAll payslips are accessible via IPFS gateways.`
          : `✅ Generated ${result.summary.successful}/${result.summary.total} payslips successfully!\n\nAll payslips are now stored permanently on IPFS via Lighthouse.`;
        
        alert(message);
      } else {
        setPayslipError(result.error || 'Failed to generate payslips');
        alert(`❌ Payslip generation failed: ${result.error}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setPayslipError(errorMsg);
      alert(`❌ Error generating payslips: ${errorMsg}`);
    } finally {
      setGeneratingPayslips(false);
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
            contributions.map((c: any) => `• ${c.contributor}: ${c.contributions} contributions → $${c.amount} (${c.percentage})`).join('\n');
        }
        
        const summaryText = `✅ Foss It executed successfully via Hedera!
        
Budget Distribution: $${result.data.totalAmountUsd} / $${result.data.totalBudget}
Based on ${result.data.totalContributions} total GitHub contributions
Payments: ${result.data.paymentsSuccessful}/${result.data.paymentsCount} successful

Payment Breakdown:
• Hedera Payments: ${breakdown.hederaPayments} transactions
• Total Contributors Paid: ${result.data.paymentsSuccessful}
• Network: ${result.data.environment || 'testnet'}${contributionDetails}

${result.data.hederaExplorer ? `\n🔗 View on Hedera Explorer: ${result.data.hederaExplorer}` : ''}`;
        
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

        {/* Payslips Section */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <h3 className="text-lg font-medium text-gray-900">📄 Digital Payslips</h3>
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  IPFS + Lighthouse
                </span>
              </div>
              {(run.status === 'COMPLETED' || run.status === 'PARTIALLY_COMPLETED') && (
                <Button 
                  onClick={() => generatePayslips(false)}
                  disabled={generatingPayslips}
                  className="bg-green-600 hover:bg-green-700"
                  size="sm"
                >
                  {generatingPayslips ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    <>🌐 Generate Payslips</>
                  )}
                </Button>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Professional HTML payslips stored permanently on IPFS for immutable record keeping
            </p>
          </div>
          
          <div className="p-6">
            {payslipError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start space-x-3">
                  <span className="text-red-500 text-lg">❌</span>
                  <div>
                    <h4 className="font-medium text-red-900">Payslip Generation Failed</h4>
                    <p className="text-red-700 text-sm mt-1">{payslipError}</p>
                  </div>
                </div>
              </div>
            )}

            {payslips.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📄</span>
                </div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">No Payslips Generated</h4>
                <p className="text-gray-600 mb-4">
                  {run.status === 'COMPLETED' || run.status === 'PARTIALLY_COMPLETED' 
                    ? 'Generate professional payslips for all contributors with blockchain transaction details.'
                    : 'Payslips can be generated after the payroll run is completed.'
                  }
                </p>
                {(run.status === 'COMPLETED' || run.status === 'PARTIALLY_COMPLETED') && (
                  <Button
                    onClick={() => generatePayslips(false)}
                    disabled={generatingPayslips}
                    variant="outline"
                  >
                    {generatingPayslips ? 'Generating...' : '🌐 Generate Payslips'}
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900">Generated Payslips ({payslips.length})</h4>
                  <div className="flex items-center space-x-3">
                    <div className="text-sm text-gray-500">
                      All payslips are stored on IPFS via Lighthouse
                    </div>
                    <Button
                      onClick={() => generatePayslips(true)}
                      disabled={generatingPayslips}
                      variant="outline"
                      size="sm"
                    >
                      {generatingPayslips ? 'Regenerating...' : '🔄 Regenerate'}
                    </Button>
                  </div>
                </div>
                
                <div className="grid gap-4">
                  {payslips.map((payslip: any, index: number) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                              <span className="text-green-600 text-sm font-medium">
                                {payslip.contributorName?.[0]?.toUpperCase() || '?'}
                              </span>
                            </div>
                          </div>
                          <div>
                            <h5 className="text-sm font-medium text-gray-900">
                              {payslip.contributorName || 'Unknown Contributor'}
                            </h5>
                            <p className="text-xs text-gray-500">
                              Payslip ID: {payslip.payslipId || payslip.metadata?.payslipId}
                            </p>
                            {payslip.success && payslip.ipfsCid && (
                              <p className="text-xs text-blue-600 font-mono mt-1">
                                IPFS: {payslip.ipfsCid}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {payslip.success ? (
                            <>
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                                ✅ Generated
                              </span>
                              {payslip.gatewayUrl && (
                                <a
                                  href={payslip.gatewayUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center px-3 py-1 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-700"
                                >
                                  📄 View Payslip
                                </a>
                              )}
                            </>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                              ❌ Failed
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {!payslip.success && payslip.error && (
                        <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                          Error: {payslip.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                  <div className="flex items-start space-x-3">
                    <span className="text-blue-500 text-lg">🌐</span>
                    <div>
                      <h4 className="font-medium text-blue-900">Decentralized Storage</h4>
                      <p className="text-blue-700 text-sm mt-1">
                        All payslips are permanently stored on IPFS via Lighthouse. They include transaction details, 
                        contribution summaries, and can be accessed from multiple IPFS gateways for maximum availability.
                      </p>
                      <div className="mt-2 text-xs text-blue-600">
                        <strong>Features:</strong> Immutable records • Blockchain verification • Professional formatting • Audit trail
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
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

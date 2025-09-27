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
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationStep, setVerificationStep] = useState<'idle' | 'requesting' | 'showing_qr' | 'verifying' | 'completed' | 'error'>('idle');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [requestId, setRequestId] = useState<string>('');
  const [verificationError, setVerificationError] = useState<string>('');

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

  async function startVerification() {
    try {
      setVerificationLoading(true);
      setVerificationStep('requesting');
      setVerificationError('');

      // Determine user type for verification
      const userType = isManager ? 'manager' : 'contributor';

      const response = await fetch('/api/self/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request_proof',
          userType
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setRequestId(data.requestId);
        setQrCodeUrl(data.qrCodeUrl);
        setVerificationStep('showing_qr');
        
        // Start polling for verification completion
        pollVerificationStatus(data.requestId);
      } else {
        throw new Error(data.error || 'Failed to request verification');
      }
    } catch (error) {
      console.error('Error starting verification:', error);
      setVerificationError(error instanceof Error ? error.message : 'Failed to start verification');
      setVerificationStep('error');
    } finally {
      setVerificationLoading(false);
    }
  }

  async function pollVerificationStatus(requestId: string) {
    // Poll every 3 seconds for verification completion
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/self/verification');
        if (response.ok) {
          const data = await response.json();
          if (data.verified) {
            setVerificationStep('completed');
            clearInterval(pollInterval);
            // Refresh session to get updated verification status
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          }
        }
      } catch (error) {
        console.error('Error polling verification status:', error);
      }
    }, 3000);

    // Stop polling after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      if (verificationStep === 'showing_qr') {
        setVerificationStep('error');
        setVerificationError('Verification timeout. Please try again.');
      }
    }, 300000); // 5 minutes
  }

  function resetVerification() {
    setVerificationStep('idle');
    setQrCodeUrl('');
    setRequestId('');
    setVerificationError('');
  }

  async function testCompleteVerification() {
    try {
      const response = await fetch('/api/self/verification/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complete: true }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Test verification completed:', data);
        // Refresh the page to update session
        window.location.reload();
      }
    } catch (error) {
      console.error('Error completing test verification:', error);
    }
  }

  async function unverifyIdentity() {
    try {
      setLoading(true);
      const response = await fetch('/api/self/verification/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complete: false }),
      });

      if (response.ok) {
        // Refresh the page to update session
        window.location.reload();
      }
    } catch (error) {
      console.error('Error unverifying identity:', error);
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
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-900">Manager</h4>
                  <p className="text-sm text-gray-500">
                    Create payroll runs and manage repositories
                  </p>
                </div>
                <div className="flex items-center justify-end sm:justify-start">
                  {isManager ? (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-green-100 text-green-800">
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

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-900">Contributor</h4>
                  <p className="text-sm text-gray-500">
                    Receive payments for your code contributions
                  </p>
                </div>
                <div className="flex items-center justify-end sm:justify-start">
                  {isContributor ? (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-green-100 text-green-800">
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900">Self Identity Verification</h4>
                <p className="text-sm text-gray-500 mt-1">
                  Verify your identity to access full platform features
                </p>
              </div>
              <div className="flex items-center justify-end sm:justify-start">
                {isSelfVerified ? (
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-green-100 text-green-800">
                      ✓ Verified
                    </span>
                    {process.env.NODE_ENV !== 'production' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={unverifyIdentity}
                        disabled={loading}
                        className="text-xs bg-red-50 border-red-200 text-red-700 hover:bg-red-100 hover:border-red-300"
                      >
                        Unverify
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={startVerification}
                    disabled={verificationLoading || verificationStep !== 'idle'}
                    className="min-w-[140px]"
                  >
                    {verificationLoading ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-600 mr-2"></div>
                        Starting...
                      </div>
                    ) : (
                      'Start Verification'
                    )}
                  </Button>
                )}
              </div>
            </div>
            
            {isSelfVerified ? (
              <div className="mt-4">
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-700">
                    ✓ Your identity is verified! You can now {isManager ? 'create payroll runs and manage repositories' : 'receive payouts from verified projects'}.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-700">
                    Complete your identity verification to {isManager ? 'create payroll runs' : 'receive payouts'}.
                  </p>
                </div>

                {/* Verification Steps */}
                {verificationStep === 'requesting' && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
                      <p className="text-sm text-blue-700">
                        Requesting identity verification...
                      </p>
                    </div>
                  </div>
                )}

                {verificationStep === 'showing_qr' && (
                  <div className="p-4 sm:p-6 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="text-center">
                      <h4 className="text-lg font-medium text-blue-900 mb-4">
                        Scan QR Code with Self App
                      </h4>
                      
                      {/* Responsive QR Code Container */}
                      <div className="flex justify-center mb-4">
                        <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm">
                          {qrCodeUrl ? (
                            qrCodeUrl.startsWith('data:image') ? (
                              <img 
                                src={qrCodeUrl} 
                                alt="Self Verification QR Code"
                                className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 mx-auto"
                              />
                            ) : (
                              <div className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300 rounded">
                                <div className="text-center">
                                  <div className="text-3xl sm:text-4xl mb-2">📱</div>
                                  <div className="text-sm text-gray-600">QR Code</div>
                                  <div className="text-xs text-gray-500 mt-2 px-2">
                                    Request ID: {requestId.slice(0, 8)}...
                                  </div>
                                </div>
                              </div>
                            )
                          ) : (
                            <div className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 bg-gray-100 flex items-center justify-center rounded">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Instructions */}
                      <div className="text-sm text-blue-700 mb-4 space-y-1">
                        <p>1. Open the Self app on your mobile device</p>
                        <p>2. Scan this QR code</p>
                        <p>3. Complete the identity verification process</p>
                      </div>

                      {/* Waiting indicator */}
                      <div className="flex items-center justify-center text-sm text-blue-600 mb-4">
                        <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                        Waiting for verification completion...
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col sm:flex-row gap-2 justify-center items-center">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={resetVerification}
                          className="w-full sm:w-auto"
                        >
                          Cancel Verification
                        </Button>
                        
                        {/* Test button only in development and as a small secondary option */}
                        {process.env.NODE_ENV !== 'production' && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={testCompleteVerification}
                            className="text-xs text-gray-500 hover:text-gray-700 w-full sm:w-auto"
                          >
                            (Dev: Complete Test)
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {verificationStep === 'completed' && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-center">
                      <div className="text-green-600 mr-3">✓</div>
                      <p className="text-sm text-green-700">
                        Identity verification completed successfully! Refreshing...
                      </p>
                    </div>
                  </div>
                )}

                {verificationStep === 'error' && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                      <div className="text-red-600 text-center sm:text-left sm:mt-0.5">⚠</div>
                      <div className="flex-1 text-center sm:text-left">
                        <p className="text-sm text-red-700 mb-3">
                          Verification failed: {verificationError}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={resetVerification}
                            className="w-full sm:w-auto"
                          >
                            Try Again
                          </Button>
                          {process.env.NODE_ENV !== 'production' && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={testCompleteVerification}
                              className="text-xs text-green-600 hover:text-green-700 w-full sm:w-auto"
                            >
                              (Dev: Complete Test)
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
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

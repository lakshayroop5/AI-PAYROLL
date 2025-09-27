'use client';

/**
 * Settings page
 */

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import DashboardLayout from '@/components/layout/dashboard-layout';

export default function SettingsPage() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState({
    email: true,
    payrollRuns: true,
    security: true,
  });
  
  const [managerWallet, setManagerWallet] = useState('');
  const [editingWallet, setEditingWallet] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentWallet, setCurrentWallet] = useState('');
  const [donationPage, setDonationPage] = useState<any>(null);
  const [creatingDonationPage, setCreatingDonationPage] = useState(false);
  const [donationPageForm, setDonationPageForm] = useState({
    slug: '',
    pageTitle: 'Support Our Open Source Work',
    description: 'Help us continue building amazing open source software!',
    customMessage: 'Thank you for supporting our work! Every donation helps us maintain and improve our projects.',
    minimumAmount: 1,
    maximumAmount: 1000
  });

  useEffect(() => {
    fetchManagerWallet();
    fetchDonationPage();
  }, []);

  async function fetchManagerWallet() {
    try {
      const response = await fetch('/api/settings/manager-wallet');
      if (response.ok) {
        const data = await response.json();
        setCurrentWallet(data.walletAddress || '');
        setManagerWallet(data.walletAddress || '');
      }
    } catch (error) {
      console.error('Error fetching manager wallet:', error);
    }
  }

  function validateWalletAddress(address: string): boolean {
    if (!address || address.trim().length < 10) return false;
    
    // Basic validation for common wallet address formats
    const patterns = [
      /^0\.0\.\d+$/, // Hedera format (0.0.123456)
      /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/, // Bitcoin legacy format
      /^bc1[a-z0-9]{39,59}$/, // Bitcoin Bech32 format
      /^0x[a-fA-F0-9]{40}$/, // Ethereum format
      /^[a-zA-Z0-9]{32,44}$/, // Solana format
      /^[a-zA-Z0-9_.-]{10,}$/ // Generic crypto address or PayPal email format
    ];
    
    return patterns.some(pattern => pattern.test(address.trim()));
  }

  async function saveManagerWallet() {
    if (!validateWalletAddress(managerWallet)) {
      alert('Please enter a valid wallet address or PayPal email');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/settings/manager-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: managerWallet })
      });

      if (response.ok) {
        setCurrentWallet(managerWallet);
        setEditingWallet(false);
        alert('✅ Manager wallet updated successfully!');
      } else {
        const error = await response.json();
        alert(`❌ Failed to update wallet: ${error.error}`);
      }
    } catch (error) {
      alert('❌ Error updating wallet address');
    } finally {
      setLoading(false);
    }
  }

  function cancelEditWallet() {
    setManagerWallet(currentWallet);
    setEditingWallet(false);
  }

  async function fetchDonationPage() {
    try {
      const response = await fetch('/api/settings/donation-page');
      if (response.ok) {
        const data = await response.json();
        setDonationPage(data.donationPage);
      }
    } catch (error) {
      console.error('Error fetching donation page:', error);
    }
  }

  async function createDonationPage() {
    if (!donationPageForm.slug.trim()) {
      alert('Please enter a URL slug for your donation page');
      return;
    }

    setCreatingDonationPage(true);
    try {
      const response = await fetch('/api/settings/donation-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(donationPageForm)
      });

      if (response.ok) {
        const data = await response.json();
        setDonationPage(data.donationPage);
        alert('✅ Donation page created successfully!');
      } else {
        const error = await response.json();
        alert(`❌ Failed to create donation page: ${error.error}`);
      }
    } catch (error) {
      alert('❌ Error creating donation page');
    } finally {
      setCreatingDonationPage(false);
    }
  }

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

        {/* Manager Wallet */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Payment Wallet</h3>
            <p className="text-sm text-gray-500 mt-1">
              Configure where corporate payments (PayPal, etc.) will be received
            </p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <span className="text-2xl">💰</span>
                  <div>
                    <h4 className="font-medium text-blue-900">Corporate Payment Collection</h4>
                    <p className="text-blue-700 text-sm mt-1">
                      This is your main wallet where all corporate payments will be collected before 
                      distributing to contributors. Supports crypto wallets and PayPal.
                    </p>
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-blue-600">✅ PayPal email addresses</p>
                      <p className="text-xs text-blue-600">✅ Bitcoin, Ethereum, Hedera wallet addresses</p>
                      <p className="text-xs text-blue-600">✅ Any cryptocurrency wallet</p>
                    </div>
                  </div>
                </div>
              </div>

              {editingWallet ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Address/Email
                    </label>
                    <input
                      type="text"
                      value={managerWallet}
                      onChange={(e) => setManagerWallet(e.target.value)}
                      placeholder="your-email@paypal.com or 0x1234... or 0.0.123456"
                      className={`block w-full border rounded-md px-3 py-2 ${
                        managerWallet && !validateWalletAddress(managerWallet)
                          ? 'border-red-300 focus:border-red-500'
                          : 'border-gray-300 focus:border-blue-500'
                      }`}
                    />
                    {managerWallet && !validateWalletAddress(managerWallet) && (
                      <p className="text-red-500 text-sm mt-1">
                        Please enter a valid wallet address or PayPal email (min 10 characters)
                      </p>
                    )}
                    {managerWallet && validateWalletAddress(managerWallet) && (
                      <p className="text-green-500 text-sm mt-1">
                        ✅ Valid payment address
                      </p>
                    )}
                  </div>
                  <div className="flex space-x-3">
                    <Button 
                      onClick={saveManagerWallet} 
                      disabled={!validateWalletAddress(managerWallet) || loading}
                    >
                      {loading ? 'Saving...' : 'Save Wallet'}
                    </Button>
                    <Button variant="outline" onClick={cancelEditWallet}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Current Payment Address</p>
                      {currentWallet ? (
                        <p className="text-sm font-mono text-gray-600 mt-1">{currentWallet}</p>
                      ) : (
                        <p className="text-sm text-gray-500 italic mt-1">Not configured</p>
                      )}
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={() => setEditingWallet(true)}
                    >
                      {currentWallet ? 'Edit' : 'Add'} Wallet
                    </Button>
                  </div>
                  
                  {!currentWallet && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <span className="text-2xl">⚠️</span>
                        <div>
                          <h4 className="font-medium text-yellow-900">Setup Required</h4>
                          <p className="text-yellow-700 text-sm mt-1">
                            Add your payment wallet to start receiving corporate payments and 
                            distributing funds to contributors.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Company Donation Page */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Company Donation Page</h3>
            <p className="text-sm text-gray-500 mt-1">
              Create a dedicated page for companies to donate PYUSD to support your open source work
            </p>
          </div>
          <div className="p-6">
            {donationPage ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <span className="text-2xl">🎉</span>
                    <div>
                      <h4 className="font-medium text-green-900">Donation Page Active</h4>
                      <p className="text-green-700 text-sm mt-1">
                        Your donation page is live and ready to receive PYUSD donations from companies.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Page URL</label>
                    <div className="flex items-center space-x-2 mt-1">
                      <code className="flex-1 p-3 bg-gray-100 rounded text-sm">
                        /donate/{donationPage.slug}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/donate/${donationPage.slug}`, '_blank')}
                      >
                        View
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Statistics</label>
                    <div className="mt-1 space-y-1">
                      <p className="text-sm">Total: <span className="font-medium">${donationPage.totalDonations}</span></p>
                      <p className="text-sm">Count: <span className="font-medium">{donationPage.donationCount}</span></p>
                    </div>
                  </div>
                </div>
              </div>
            ) : currentWallet ? (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <span className="text-2xl">💰</span>
                    <div>
                      <h4 className="font-medium text-blue-900">Ready to Create Donation Page</h4>
                      <p className="text-blue-700 text-sm mt-1">
                        Your wallet is configured! Create a donation page to start receiving PYUSD donations from companies.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      URL Slug *
                    </label>
                    <input
                      type="text"
                      value={donationPageForm.slug}
                      onChange={(e) => setDonationPageForm({...donationPageForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})}
                      placeholder="my-project"
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      URL: /donate/{donationPageForm.slug || 'your-slug'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Page Title
                    </label>
                    <input
                      type="text"
                      value={donationPageForm.pageTitle}
                      onChange={(e) => setDonationPageForm({...donationPageForm, pageTitle: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={donationPageForm.description}
                    onChange={(e) => setDonationPageForm({...donationPageForm, description: e.target.value})}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Minimum Amount ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={donationPageForm.minimumAmount}
                      onChange={(e) => setDonationPageForm({...donationPageForm, minimumAmount: parseFloat(e.target.value) || 1})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maximum Amount ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={donationPageForm.maximumAmount}
                      onChange={(e) => setDonationPageForm({...donationPageForm, maximumAmount: parseFloat(e.target.value) || 1000})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Thank You Message
                  </label>
                  <textarea
                    value={donationPageForm.customMessage}
                    onChange={(e) => setDonationPageForm({...donationPageForm, customMessage: e.target.value})}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>

                <Button 
                  onClick={createDonationPage}
                  disabled={!donationPageForm.slug.trim() || creatingDonationPage}
                >
                  {creatingDonationPage ? 'Creating...' : 'Create Donation Page'}
                </Button>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <h4 className="font-medium text-yellow-900">Wallet Required</h4>
                    <p className="text-yellow-700 text-sm mt-1">
                      Please configure your payment wallet above before creating a donation page.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
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

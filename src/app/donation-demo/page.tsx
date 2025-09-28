'use client';

/**
 * Donation Demo Page
 * Showcases the PYUSD donation functionality
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function DonationDemoPage() {
  const [isInitializing, setIsInitializing] = useState(false);
  const [demoData, setDemoData] = useState<any>(null);

  async function initializeDemoPage() {
    setIsInitializing(true);
    try {
      const response = await fetch('/api/demo/init-donation-page', {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        setDemoData(data);
        alert('✅ Demo donation page initialized successfully!');
      } else {
        const error = await response.json();
        alert(`❌ Failed to initialize demo: ${error.error}`);
      }
    } catch (error) {
      alert('❌ Error initializing demo');
    } finally {
      setIsInitializing(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">AI-Payroll Donation Demo</h1>
          <p className="text-gray-600 mt-2">
            Experience our PYUSD donation system for open source projects
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Feature Overview */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">🚀 What You Can Do</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl mb-3">💰</div>
              <h3 className="font-medium text-gray-900 mb-2">Set Up Wallet</h3>
              <p className="text-sm text-gray-600">
                Configure your PYUSD wallet address in settings to receive donations
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">📱</div>
              <h3 className="font-medium text-gray-900 mb-2">Generate QR Codes</h3>
              <p className="text-sm text-gray-600">
                Create donation pages with QR codes for easy PYUSD payments
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">📊</div>
              <h3 className="font-medium text-gray-900 mb-2">Track History</h3>
              <p className="text-sm text-gray-600">
                Monitor all donations and payment history in real-time
              </p>
            </div>
          </div>
        </div>

        {/* Demo Initialization */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Initialize Demo</h2>
          <p className="text-gray-600 mb-6">
            Click the button below to set up a demo donation page with sample data. 
            This will create a test donation page that you can use to see how the system works.
          </p>
          
          <Button 
            onClick={initializeDemoPage}
            disabled={isInitializing}
            className="mb-4"
          >
            {isInitializing ? 'Setting up demo...' : 'Initialize Demo Donation Page'}
          </Button>

          {demoData && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-medium text-green-900 mb-2">✅ Demo Ready!</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Donation Page:</strong> {demoData.donationPage.pageTitle}</p>
                <p><strong>Total Donations:</strong> ${demoData.donationPage.totalDonations}</p>
                <p><strong>Donation Count:</strong> {demoData.donationPage.donationCount}</p>
                <div className="mt-4">
                  <Button
                    variant="outline"
                    onClick={() => window.open(demoData.donationPageUrl, '_blank')}
                  >
                    View Demo Donation Page
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* How It Works */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">How It Works</h2>
          <div className="space-y-4">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-bold">1</span>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Manager Sets Up Wallet</h3>
                <p className="text-gray-600 text-sm">
                  Repository maintainers configure their PYUSD wallet address in the settings page.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-bold">2</span>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Create Donation Page</h3>
                <p className="text-gray-600 text-sm">
                  Managers create a custom donation page with their project details and payment preferences.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-bold">3</span>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Companies Donate</h3>
                <p className="text-gray-600 text-sm">
                  Companies visit the donation page, enter donation amount, and get QR codes for PYUSD payments.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-bold">4</span>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Track & Distribute</h3>
                <p className="text-gray-600 text-sm">
                  Payment history is tracked automatically, and managers can distribute funds to contributors.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">⚙️ Settings</h3>
            <p className="text-gray-600 text-sm mb-4">
              Configure your wallet address and create donation pages
            </p>
            <Button 
              variant="outline"
              onClick={() => window.open('/dashboard/settings', '_blank')}
            >
              Go to Settings
            </Button>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">📊 Dashboard</h3>
            <p className="text-gray-600 text-sm mb-4">
              View your payroll runs and contributor management
            </p>
            <Button 
              variant="outline"
              onClick={() => window.open('/dashboard', '_blank')}
            >
              Go to Dashboard
            </Button>
          </div>
        </div>

        {/* Demo Notice */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h4 className="font-medium text-yellow-900">Demo Environment</h4>
              <p className="text-yellow-700 text-sm mt-1">
                This is a demo environment using test PYUSD tokens. All transactions are simulated 
                and no real money is involved. Perfect for testing and development!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

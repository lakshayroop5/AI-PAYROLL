'use client';

/**
 * Simple Wallet Registration Page
 */

import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function WalletRegisterPage() {
  const { data: session } = useSession();
  const [hederaAccountId, setHederaAccountId] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function registerWallet() {
    if (!session?.user?.githubLogin || !hederaAccountId) return;

    setLoading(true);
    try {
      const response = await fetch('/api/register-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hederaAccountId })
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(true);
        alert('✅ Wallet registered successfully! You can now receive payouts.');
      } else {
        alert(`❌ Registration failed: ${data.error}`);
      }
    } catch (error) {
      alert('❌ Error registering wallet');
    } finally {
      setLoading(false);
    }
  }

  function validateHederaId(id: string): boolean {
    const pattern = /^0\.0\.\d+$/;
    return pattern.test(id);
  }

  const isValidId = validateHederaId(hederaAccountId);

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-center mb-4">💎 Wallet Registration</h1>
          <p className="text-gray-600 text-center mb-6">Please sign in with GitHub to register your Hedera wallet.</p>
          <Button 
            className="w-full" 
            onClick={() => window.location.href = '/api/auth/signin'}
          >
            Sign In with GitHub
          </Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-green-600 mb-4">Wallet Registered!</h1>
          <p className="text-gray-600 mb-4">
            Your Hedera wallet has been successfully registered.
          </p>
          <div className="bg-green-50 p-4 rounded-lg mb-6">
            <p className="text-green-800 font-semibold">Registered Wallet:</p>
            <p className="text-green-700 font-mono text-lg">{hederaAccountId}</p>
          </div>
          <div className="space-y-2 mb-6">
            <p className="text-sm text-gray-600">✅ You can now receive cryptocurrency payouts</p>
            <p className="text-sm text-gray-600">✅ Payments are processed automatically</p>
            <p className="text-sm text-gray-600">✅ You'll get email notifications</p>
          </div>
          <Button onClick={() => window.location.href = '/dashboard'}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">💎 Register Wallet</h1>
          <p className="text-gray-600">Add your Hedera account to receive crypto payouts</p>
        </div>

        {/* User Info */}
        <div className="flex items-center space-x-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <img 
            src={session.user?.image || ''} 
            alt="Profile" 
            className="w-12 h-12 rounded-full"
          />
          <div>
            <p className="font-medium text-gray-900">@{session.user?.githubLogin}</p>
            <p className="text-gray-500 text-sm">{session.user?.email}</p>
          </div>
        </div>

        {/* Wallet Setup Info */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-yellow-900 mb-2">🏦 Need a Hedera wallet?</h3>
          <p className="text-yellow-700 text-sm mb-3">Create a free account:</p>
          <div className="space-y-2">
            <a 
              href="https://portal.hedera.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-blue-600 hover:text-blue-700 text-sm"
            >
              🌐 Hedera Portal (Official) ↗
            </a>
            <a 
              href="https://www.hashpack.app/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-blue-600 hover:text-blue-700 text-sm"
            >
              📱 HashPack Wallet ↗
            </a>
          </div>
        </div>

        {/* Wallet Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Hedera Account ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={hederaAccountId}
            onChange={(e) => setHederaAccountId(e.target.value)}
            placeholder="0.0.123456"
            className={`block w-full border rounded-md px-3 py-2 text-lg ${
              hederaAccountId && !isValidId 
                ? 'border-red-300 focus:border-red-500' 
                : 'border-gray-300 focus:border-blue-500'
            }`}
          />
          {hederaAccountId && !isValidId && (
            <p className="text-red-500 text-sm mt-1">
              Please enter a valid format: 0.0.xxxxxx
            </p>
          )}
          {hederaAccountId && isValidId && (
            <p className="text-green-500 text-sm mt-1">
              ✅ Valid Hedera Account ID
            </p>
          )}
          <p className="text-gray-500 text-xs mt-1">
            Find this in your Hedera wallet (e.g., 0.0.123456)
          </p>
        </div>

        {/* Security Note */}
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h4 className="font-medium text-gray-900 mb-2">🔒 Privacy & Security</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• We only store your Account ID, never private keys</li>
            <li>• Your wallet remains under your full control</li>
            <li>• You can update your Account ID anytime</li>
          </ul>
        </div>

        {/* Register Button */}
        <Button 
          onClick={registerWallet}
          disabled={!isValidId || loading}
          className="w-full"
        >
          {loading ? 'Registering...' : 'Register Wallet'}
        </Button>

        <p className="text-center text-sm text-gray-500 mt-4">
          By registering, you agree to receive cryptocurrency payments for your contributions.
        </p>
      </div>
    </div>
  );
}

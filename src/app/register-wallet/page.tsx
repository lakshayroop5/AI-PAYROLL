'use client';

/**
 * Contributor Wallet Registration Page
 * Simple flow for contributors to add their Hedera wallet addresses
 */

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function RegisterWalletPage() {
  const { data: session } = useSession();
  const [step, setStep] = useState(1);
  const [hederaAccountId, setHederaAccountId] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (session?.user?.githubLogin) {
      fetchProfile();
    }
  }, [session]);

  async function fetchProfile() {
    try {
      const response = await fetch(`/api/contributors/${session?.user?.githubLogin}/profile`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
        if (data.profile.hederaAccountId) {
          setStep(3); // Already registered
          setHederaAccountId(data.profile.hederaAccountId);
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  }

  async function registerWallet() {
    if (!session?.user?.githubLogin) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/contributors/${session.user.githubLogin}/wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hederaAccountId })
      });

      if (response.ok) {
        setStep(3);
        alert('✅ Wallet registered successfully! You can now receive payouts.');
      } else {
        const error = await response.json();
        alert(`❌ Registration failed: ${error.error}`);
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
        <div className="w-full max-w-md bg-white rounded-lg shadow-md">
          <div className="p-6 text-center">
            <h1 className="text-xl font-bold mb-4">Sign In Required</h1>
            <p className="text-gray-600 mb-4">Please sign in with GitHub to register your wallet.</p>
            <Button onClick={() => window.location.href = '/api/auth/signin'}>
              Sign In with GitHub
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">💎 Register Your Wallet</h1>
          <p className="text-gray-600">Add your Hedera account to receive cryptocurrency payouts</p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              1
            </div>
            <div className={`w-12 h-1 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              2
            </div>
            <div className={`w-12 h-1 ${step >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= 3 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              ✓
            </div>
          </div>
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Welcome, {session.user.name || session.user.githubLogin}! 👋</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-4">
                <img 
                  src={session.user.image || ''} 
                  alt="Profile" 
                  className="w-16 h-16 rounded-full"
                />
                <div>
                  <p className="font-medium text-gray-900">@{session.user.githubLogin}</p>
                  <p className="text-gray-500">{session.user.email}</p>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">🎉 You're eligible for payouts!</h3>
                <p className="text-blue-700 text-sm">
                  As a contributor to repositories using our Foss It system, you can receive 
                  cryptocurrency payments directly to your Hedera wallet.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">What you'll need:</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                    <span>A Hedera wallet account (we'll help you get one)</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                    <span>Your Hedera Account ID (format: 0.0.xxxxxx)</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                    <span>2 minutes of your time</span>
                  </li>
                </ul>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => window.history.back()}>
                  ← Back
                </Button>
                <Button onClick={() => setStep(2)}>
                  Get Started →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Wallet Setup */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>💼 Add Your Hedera Wallet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h3 className="font-medium text-yellow-900 mb-2">🏦 Don't have a Hedera wallet yet?</h3>
                <p className="text-yellow-700 text-sm mb-3">
                  You can create a free Hedera account in minutes:
                </p>
                <div className="space-y-2 text-sm">
                  <a 
                    href="https://portal.hedera.com/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
                  >
                    <span>🌐</span>
                    <span>Hedera Portal (Official)</span>
                    <span>↗</span>
                  </a>
                  <a 
                    href="https://www.hashpack.app/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
                  >
                    <span>📱</span>
                    <span>HashPack Wallet (Mobile)</span>
                    <span>↗</span>
                  </a>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hedera Account ID
                </label>
                <input
                  type="text"
                  value={hederaAccountId}
                  onChange={(e) => setHederaAccountId(e.target.value)}
                  placeholder="0.0.123456"
                  className={`block w-full border rounded-md px-3 py-2 ${
                    hederaAccountId && !isValidId 
                      ? 'border-red-300 focus:border-red-500' 
                      : 'border-gray-300 focus:border-blue-500'
                  }`}
                />
                {hederaAccountId && !isValidId && (
                  <p className="text-red-500 text-xs mt-1">
                    Please enter a valid Hedera Account ID (format: 0.0.xxxxxx)
                  </p>
                )}
                {hederaAccountId && isValidId && (
                  <p className="text-green-500 text-xs mt-1">
                    ✅ Valid Hedera Account ID
                  </p>
                )}
                <p className="text-gray-500 text-xs mt-1">
                  Your Account ID can be found in your Hedera wallet (e.g., 0.0.123456)
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">🔒 Privacy & Security</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• We only store your Account ID, never your private keys</li>
                  <li>• Your wallet remains under your full control</li>
                  <li>• You can update or remove your Account ID anytime</li>
                </ul>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  ← Back
                </Button>
                <Button 
                  onClick={registerWallet}
                  disabled={!isValidId || loading}
                >
                  {loading ? 'Registering...' : 'Register Wallet →'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>🎉 Wallet Registered Successfully!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <span className="text-2xl">✅</span>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">You're all set!</h3>
                <p className="text-gray-600">
                  Your Hedera wallet has been registered and you can now receive payouts.
                </p>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-green-800 font-medium">Registered Wallet:</p>
                <p className="text-green-700 font-mono text-lg">{hederaAccountId}</p>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">What happens next?</h4>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                    <span>You'll receive payouts based on your contributions</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                    <span>Payments are processed automatically</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                    <span>You'll get email notifications for each payout</span>
                  </li>
                </ul>
              </div>

              <div className="flex justify-center space-x-4">
                <Button variant="outline" onClick={() => window.location.href = `/dashboard/contributors/${session.user.githubLogin}`}>
                  View My Profile
                </Button>
                <Button onClick={() => window.location.href = '/dashboard'}>
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

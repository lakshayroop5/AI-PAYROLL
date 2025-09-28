/**
 * Custom sign-in page
 */

'use client';

import { signIn, getSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function SignInPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    // Check if user is already signed in
    getSession().then((session) => {
      if (session) {
        router.push('/dashboard');
      }
    });

    // Check if GitHub OAuth is configured
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
    const isConfigured = clientId && 
                        clientId !== 'your-github-client-id' && 
                        clientId !== '' &&
                        clientId.startsWith('Ov');
    setDemoMode(!isConfigured);
    
    console.log('GitHub Client ID:', clientId);
    console.log('Demo Mode:', !isConfigured);
  }, [router]);

  const handleGitHubSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      
      const result = await signIn('github', {
        callbackUrl: '/dashboard',
        redirect: false
      });

      if (result?.error) {
        setError('Failed to sign in with GitHub. Please try again.');
      } else if (result?.url) {
        router.push(result.url);
      }
    } catch (error) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-xl font-bold">AI</span>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Foss It System
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Decentralized payroll with Self identity verification
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {demoMode && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
              <p className="text-sm font-medium mb-2">⚠️ Demo Mode</p>
              <p className="text-sm">
                GitHub OAuth is not configured. To set up authentication:
              </p>
              <ol className="text-xs mt-2 space-y-1 list-decimal list-inside">
                <li>Go to <a href="https://github.com/settings/applications/new" target="_blank" className="underline">GitHub OAuth Apps</a></li>
                <li>Create new app with callback: http://172.20.10.2:3000/api/auth/callback/github</li>
                <li>Update GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env.local</li>
                <li>Restart the development server</li>
              </ol>
            </div>
          )}

          <div>
            <Button
              onClick={handleGitHubSignIn}
              disabled={loading || demoMode}
              loading={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </span>
              {demoMode ? 'GitHub OAuth Not Configured' : 'Sign in with GitHub'}
            </Button>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500">
              By signing in, you agree to our Terms of Service and Privacy Policy.
              <br />
              You'll need to complete Self identity verification after signing in.
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-200 pt-6">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-4">How it works</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-center">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mr-3">1</span>
                <span>Sign in with your GitHub account</span>
              </div>
              <div className="flex items-center">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mr-3">2</span>
                <span>Complete Self identity verification</span>
              </div>
              <div className="flex items-center">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mr-3">3</span>
                <span>Set up your profile and start managing payroll</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
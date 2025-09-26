/**
 * Authentication error page
 */

'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const errorMessages: Record<string, string> = {
  Configuration: 'There is a problem with the server configuration.',
  AccessDenied: 'You do not have permission to sign in.',
  Verification: 'The verification token has expired or has already been used.',
  Default: 'An error occurred during authentication.',
};

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams?.get('error') || 'Default';
  const message = errorMessages[error] || errorMessages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 bg-red-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-xl">⚠</span>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Authentication Error
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {message}
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <p className="text-sm">
              Error: {error}
            </p>
          </div>

          <div className="flex flex-col space-y-3">
            <Link href="/auth/signin">
              <Button className="w-full">
                Try Again
              </Button>
            </Link>
            
            <Link href="/">
              <Button variant="outline" className="w-full">
                Back to Home
              </Button>
            </Link>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500">
              If you continue to experience issues, please contact support.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
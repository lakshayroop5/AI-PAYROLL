'use client';

/**
 * Main dashboard layout component
 */

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SafeLink } from '@/components/ui/safe-link';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: string;
  roles?: string[];
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Repositories', href: '/dashboard/repositories', icon: '📁', roles: ['manager'] },
  { name: 'Contributors', href: '/dashboard/contributors', icon: '👥' },
  { name: 'Payroll Runs', href: '/dashboard/runs', icon: '💰', roles: ['manager'] },
  { name: 'Integrations', href: '/dashboard/integrations', icon: '🔗', roles: ['manager'] },
  { name: 'Admin', href: '/dashboard/admin', icon: '⚡', roles: ['manager'] },
  { name: 'Profile', href: '/dashboard/profile', icon: '👤' },
  { name: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="mb-4">You need to be signed in to view this page.</p>
          <SafeLink href="/auth/signin">
            <Button>Sign In</Button>
          </SafeLink>
        </div>
      </div>
    );
  }

  const filteredNavigation = navigation.filter(item => 
    !item.roles || item.roles.some(role => session.user.roles?.includes(role))
  );

  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 lg:flex-shrink-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 px-4 bg-blue-600 text-white">
            <h1 className="text-xl font-bold">AI Payroll</h1>
          </div>

          {/* User info */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                  {session.user.name?.charAt(0) || session.user.email?.charAt(0)}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {session.user.name || session.user.email}
                </p>
                <div className="flex items-center mt-1">
                  {session.user.selfVerified ? (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                      ✓ Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                      ⚠ Unverified
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-2">
            {filteredNavigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <SafeLink
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    isActive
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  <span className="mr-3 text-lg">{item.icon}</span>
                  {item.name}
                </SafeLink>
              );
            })}
          </nav>

          {/* Sign out */}
          <div className="p-4 border-t border-gray-200">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => signOut()}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:flex-1 w-full flex flex-col min-h-screen lg:pl-0">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <button
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <span className="sr-only">Open sidebar</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Environment: <span className="font-medium text-blue-600">Testnet</span>
              </span>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
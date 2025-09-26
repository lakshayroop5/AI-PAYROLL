'use client';

/**
 * Repositories management page
 */

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { SafeLink } from '@/components/ui/safe-link';
import { Button } from '@/components/ui/button';
import DashboardLayout from '@/components/layout/dashboard-layout';

interface Repository {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBudgetUsd?: number;
  active: boolean;
  createdAt: string;
}

export default function RepositoriesPage() {
  const { data: session } = useSession();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRepositories();
  }, []);

  async function fetchRepositories() {
    try {
      setLoading(true);
      const response = await fetch('/api/repositories');
      if (response.ok) {
        const data = await response.json();
        setRepositories(data.repositories || []);
      }
    } catch (error) {
      console.error('Error fetching repositories:', error);
    } finally {
      setLoading(false);
    }
  }

  const isManager = session?.user.roles?.includes('manager');

  if (!isManager) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You need manager role to access repository management.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Repository Management</h1>
            <p className="text-gray-600 mt-1">
              Manage GitHub repositories for payroll processing.
            </p>
          </div>
          <Button>Add Repository</Button>
        </div>

        {/* Repositories List */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Connected Repositories</h3>
          </div>
          
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading repositories...</p>
            </div>
          ) : repositories.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {repositories.map((repo) => (
                <div key={repo.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-medium text-gray-900">{repo.fullName}</h4>
                      <p className="text-sm text-gray-500">
                        Default Budget: ${repo.defaultBudgetUsd || 'Not set'}
                      </p>
                      <p className="text-xs text-gray-400">
                        Added {new Date(repo.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        repo.active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {repo.active ? 'Active' : 'Inactive'}
                      </span>
                      <Button variant="outline" size="sm">
                        Configure
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 1v6h8V1" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No repositories</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Get started by connecting your first GitHub repository.
                </p>
                <div className="mt-6">
                  <Button>Add Repository</Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Repository Setup
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  To add a repository, you need admin access to the GitHub repository and it must be connected to your GitHub account.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

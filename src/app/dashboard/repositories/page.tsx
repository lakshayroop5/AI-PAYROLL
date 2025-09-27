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

interface GitHubRepository {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  description?: string | null;
  private: boolean;
  fork: boolean;
  language?: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  html_url: string;
  permissions?: {
    admin: boolean;
    maintain: boolean;
  };
  isAlreadyAdded: boolean;
  isOrganization?: boolean;
}

export default function RepositoriesPage() {
  const { data: session } = useSession();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  
  // GitHub repository search states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [githubRepos, setGithubRepos] = useState<GitHubRepository[]>([]);
  const [allGithubRepos, setAllGithubRepos] = useState<GitHubRepository[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addingRepoId, setAddingRepoId] = useState<number | null>(null);

  useEffect(() => {
    fetchRepositories();
  }, []);

  async function fetchRepositories() {
    try {
      setLoading(true);
      const response = await fetch('/api/repositories');
      if (response.ok) {
        const data = await response.json();
        setRepositories(data.storedRepos || []);
      }
    } catch (error) {
      console.error('Error fetching repositories:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadAllGitHubRepos() {
    try {
      setSearchLoading(true);
      const response = await fetch('/api/repositories/github');
      if (response.ok) {
        const data = await response.json();
        const repos = data.repositories || [];
        setAllGithubRepos(repos);
        setGithubRepos(repos); // Show all initially
      }
    } catch (error) {
      console.error('Error loading GitHub repositories:', error);
    } finally {
      setSearchLoading(false);
    }
  }

  function filterRepositories(query: string) {
    if (!query.trim()) {
      setGithubRepos(allGithubRepos);
    } else {
      const filtered = allGithubRepos.filter(repo =>
        repo.name.toLowerCase().includes(query.toLowerCase()) ||
        repo.fullName.toLowerCase().includes(query.toLowerCase()) ||
        (repo.description && repo.description.toLowerCase().includes(query.toLowerCase()))
      );
      setGithubRepos(filtered);
    }
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    filterRepositories(value);
  }

  async function addRepository(githubRepo: GitHubRepository) {
    try {
      console.log('Adding repository:', githubRepo.fullName);
      setAddingRepoId(githubRepo.id);
      
      const response = await fetch('/api/repositories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: githubRepo.fullName,
          defaultBudgetUsd: 1000, // Default budget
          defaultAsset: 'HBAR'
        }),
      });

      console.log('Response status:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('Repository added successfully:', result);
        
        // Show success message
        alert(`Successfully added repository: ${githubRepo.fullName}`);
        
        // Refresh both lists
        await fetchRepositories();
        await loadAllGitHubRepos();
      } else {
        const error = await response.json();
        console.error('Failed to add repository:', error);
        alert(`Failed to add repository: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error adding repository:', error);
      alert('Failed to add repository. Please try again.');
    } finally {
      setAddingRepoId(null);
    }
  }

  function openAddDialog() {
    setShowAddDialog(true);
    setSearchQuery(''); // Clear search when opening
    loadAllGitHubRepos();
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
          <Button onClick={openAddDialog}>Add Repository</Button>
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
                  <Button onClick={openAddDialog}>Add Repository</Button>
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

        {/* Add Repository Dialog */}
        {showAddDialog && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              {/* Background overlay */}
              <div 
                className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                onClick={() => setShowAddDialog(false)}
              ></div>

              {/* Dialog */}
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="w-full">
                      {/* Dialog Header */}
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          Add GitHub Repository
                        </h3>
                        <button
                          onClick={() => setShowAddDialog(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">
                        Select from your personal and organization repositories where you have admin/maintainer access
                      </p>

                      {/* Search Bar */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Search Repositories
                        </label>
                        <div className="flex gap-3">
                          <input
                            type="text"
                            placeholder="Filter repositories by name or description..."
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          {searchQuery && (
                            <Button 
                              onClick={() => handleSearchChange('')}
                              variant="outline"
                              size="sm"
                            >
                              Clear
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Repository Count */}
                      {!searchLoading && allGithubRepos.length > 0 && (
                        <div className="mb-3 text-sm text-gray-600">
                          {searchQuery 
                            ? `Showing ${githubRepos.length} of ${allGithubRepos.length} repositories`
                            : `${allGithubRepos.length} repositories with admin access`
                          }
                        </div>
                      )}

                      {/* Repository List */}
                      <div className="max-h-96 overflow-y-auto">
                        {searchLoading ? (
                          <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="mt-2 text-sm text-gray-500">Loading your repositories...</p>
                          </div>
                        ) : githubRepos.length > 0 ? (
                          <div className="space-y-3">
                            {githubRepos.map((repo) => (
                              <div key={repo.id} className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                      <h4 className="text-sm font-medium text-gray-900 truncate">
                                        {repo.fullName}
                                      </h4>
                                      {repo.private && (
                                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                          Private
                                        </span>
                                      )}
                                      {repo.fork && (
                                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                          Fork
                                        </span>
                                      )}
                                      {repo.isOrganization && (
                                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                          Organization
                                        </span>
                                      )}
                                    </div>
                                    {repo.description && (
                                      <p className="text-sm text-gray-600 mb-2">{repo.description}</p>
                                    )}
                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                      {repo.language && (
                                        <span className="flex items-center gap-1">
                                          <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                                          {repo.language}
                                        </span>
                                      )}
                                      <span className="flex items-center gap-1">
                                        ⭐ {repo.stargazers_count}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        🍴 {repo.forks_count}
                                      </span>
                                      <span>
                                        Updated {new Date(repo.updated_at).toLocaleDateString()}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="ml-4 flex-shrink-0">
                                    {repo.isAlreadyAdded ? (
                                      <span className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-green-100 text-green-800">
                                        ✓ Added
                                      </span>
                                    ) : (
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          console.log('Button clicked for repo:', repo.fullName);
                                          addRepository(repo);
                                        }}
                                        disabled={addingRepoId === repo.id}
                                      >
                                        {addingRepoId === repo.id ? 'Adding...' : 'Add Repository'}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <div className="text-gray-500">
                              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                              <h3 className="mt-2 text-sm font-medium text-gray-900">No repositories found</h3>
                              <p className="mt-1 text-sm text-gray-500">
                                Try searching for a different repository name or check if you have admin access.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

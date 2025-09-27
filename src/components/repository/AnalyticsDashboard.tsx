/**
 * Repository Analytics Dashboard Component
 * Displays comprehensive analytics, corporate detection, and invoicing data
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface AnalyticsData {
  agent: {
    id: string;
    status: string;
    lastSyncAt: string | null;
    errorCount: number;
    lastError: string | null;
  };
  analytics: {
    current: {
      date: string;
      contributors: number;
      prs: number;
      commits: number;
      stars: number;
      forks: number;
      clones: number;
      views: number;
      corporateActivity: number;
    } | null;
    trends: {
      contributorsChange: number;
      prsChange: number;
      starsChange: number;
      corporateActivityChange: number;
    } | null;
    history: Array<{
      date: string;
      contributors: number;
      prs: number;
      commits: number;
      stars: number;
      forks: number;
      corporateActivity: number;
    }>;
  };
  corporateUsers: Array<{
    id: string;
    organizationName: string | null;
    domain: string | null;
    githubLogin: string | null;
    confidence: number;
    status: string;
    detectionMethod: string;
    firstDetected: string;
    lastActivity: string;
    totalActivity: number;
  }>;
  invoices: {
    recent: Array<{
      id: string;
      invoiceNumber: string;
      organizationName: string;
      amount: number;
      currency: string;
      status: string;
      dueDate: string;
      createdAt: string;
      isPaid: boolean;
    }>;
    stats: {
      total: number;
      pending: number;
      paid: number;
      totalAmount: number;
      paidAmount: number;
    };
  };
}

interface AnalyticsDashboardProps {
  repositoryId: string;
  repositoryName: string;
}

export default function AnalyticsDashboard({ repositoryId, repositoryName }: AnalyticsDashboardProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [repositoryId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/repositories/${repositoryId}/analytics`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const analyticsData = await response.json();
      
      if (analyticsData.status === 'not_initialized') {
        setError('Monitoring not initialized for this repository');
        return;
      }

      setData(analyticsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const triggerSync = async () => {
    try {
      setSyncing(true);
      const response = await fetch(`/api/repositories/${repositoryId}/analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger_sync' })
      });

      if (response.ok) {
        alert('Manual sync triggered! Data will be updated shortly.');
        // Refresh after a delay
        setTimeout(fetchAnalytics, 5000);
      } else {
        throw new Error('Failed to trigger sync');
      }
    } catch (err) {
      alert('Failed to trigger sync: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSyncing(false);
    }
  };

  const initializeAgent = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/repositories/${repositoryId}/analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initialize_agent' })
      });

      if (response.ok) {
        alert('Monitoring agent initialized! Fetching initial data...');
        setTimeout(fetchAnalytics, 2000);
      } else {
        throw new Error('Failed to initialize agent');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize monitoring');
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'text-green-600 bg-green-100';
      case 'INITIALIZING': return 'text-yellow-600 bg-yellow-100';
      case 'ERROR': return 'text-red-600 bg-red-100';
      case 'PAUSED': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return '↗️';
    if (change < 0) return '↘️';
    return '➡️';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md mx-auto">
          <h3 className="text-lg font-medium text-yellow-800 mb-2">Analytics Not Available</h3>
          <p className="text-yellow-700 mb-4">{error}</p>
          <Button onClick={initializeAgent}>
            Initialize Monitoring
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Repository Analytics</h2>
          <p className="text-gray-600">{repositoryName}</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(data.agent.status)}`}>
            {data.agent.status}
          </div>
          <Button
            onClick={triggerSync}
            disabled={syncing}
            size="sm"
          >
            {syncing ? 'Syncing...' : 'Refresh Data'}
          </Button>
        </div>
      </div>

      {/* Agent Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Monitoring Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Last Sync</p>
            <p className="text-lg font-medium">
              {data.agent.lastSyncAt 
                ? formatDate(data.agent.lastSyncAt) 
                : 'Never'
              }
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Error Count</p>
            <p className="text-lg font-medium">{data.agent.errorCount}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Agent ID</p>
            <p className="text-lg font-mono text-sm">{data.agent.id.slice(0, 8)}...</p>
          </div>
        </div>
        {data.agent.lastError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-red-800 text-sm">{data.agent.lastError}</p>
          </div>
        )}
      </div>

      {/* Current Analytics */}
      {data.analytics.current && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{data.analytics.current.contributors}</p>
              <p className="text-sm text-gray-600">Contributors</p>
              {data.analytics.trends && (
                <p className="text-xs text-gray-500">
                  {getTrendIcon(data.analytics.trends.contributorsChange)} {data.analytics.trends.contributorsChange}
                </p>
              )}
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{data.analytics.current.prs}</p>
              <p className="text-sm text-gray-600">Pull Requests</p>
              {data.analytics.trends && (
                <p className="text-xs text-gray-500">
                  {getTrendIcon(data.analytics.trends.prsChange)} {data.analytics.trends.prsChange}
                </p>
              )}
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{data.analytics.current.stars}</p>
              <p className="text-sm text-gray-600">Stars</p>
              {data.analytics.trends && (
                <p className="text-xs text-gray-500">
                  {getTrendIcon(data.analytics.trends.starsChange)} {data.analytics.trends.starsChange}
                </p>
              )}
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{data.analytics.current.corporateActivity}</p>
              <p className="text-sm text-gray-600">Corporate Activity</p>
              {data.analytics.trends && (
                <p className="text-xs text-gray-500">
                  {getTrendIcon(data.analytics.trends.corporateActivityChange)} {data.analytics.trends.corporateActivityChange}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Corporate Users */}
      {data.corporateUsers.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Detected Corporate Users</h3>
          <div className="space-y-3">
            {data.corporateUsers.slice(0, 5).map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium">
                    {user.organizationName || user.githubLogin || 'Unknown Organization'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {user.detectionMethod} • Confidence: {(user.confidence * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{user.status}</p>
                  <p className="text-xs text-gray-500">{user.totalActivity} activities</p>
                </div>
              </div>
            ))}
            {data.corporateUsers.length > 5 && (
              <p className="text-center text-sm text-gray-500">
                And {data.corporateUsers.length - 5} more...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Invoice Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{data.invoices.stats.total}</p>
            <p className="text-sm text-gray-600">Total Invoices</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-600">{data.invoices.stats.pending}</p>
            <p className="text-sm text-gray-600">Pending</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{data.invoices.stats.paid}</p>
            <p className="text-sm text-gray-600">Paid</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">
              ${data.invoices.stats.paidAmount.toFixed(0)}
            </p>
            <p className="text-sm text-gray-600">Revenue</p>
          </div>
        </div>

        {data.invoices.recent.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Recent Invoices</h4>
            <div className="space-y-2">
              {data.invoices.recent.slice(0, 3).map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                  <div>
                    <span className="font-medium">{invoice.invoiceNumber}</span>
                    <span className="text-gray-600 ml-2">{invoice.organizationName}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">${invoice.amount} {invoice.currency}</div>
                    <div className={`text-xs ${invoice.isPaid ? 'text-green-600' : 'text-yellow-600'}`}>
                      {invoice.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

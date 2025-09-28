'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  RefreshCw, 
  TrendingUp, 
  Users, 
  GitPullRequest, 
  Building2, 
  DollarSign,
  Activity,
  Database,
  Bot
} from 'lucide-react';

interface AnalyticsData {
  agent: {
    id: string;
    status: string;
    lastSyncAt: string;
    errorCount: number;
    lastError?: string;
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
    organizationName: string;
    domain?: string;
    githubLogin: string;
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

interface EnhancedAnalyticsProps {
  repositoryId: string;
  repositoryName: string;
}

export default function EnhancedAnalytics({ repositoryId, repositoryName }: EnhancedAnalyticsProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setError(null);
      const response = await fetch(`/api/repositories/${repositoryId}/analytics`);
      const result = await response.json();
      
      if (response.ok) {
        setAnalytics(result);
      } else {
        setError(result.error || 'Failed to fetch analytics');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const triggerSync = async () => {
    try {
      setRefreshing(true);
      const response = await fetch(`/api/repositories/${repositoryId}/analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger_sync' })
      });
      
      const result = await response.json();
      if (response.ok) {
        // Wait a moment then refresh
        setTimeout(fetchAnalytics, 2000);
      } else {
        setError(result.error || 'Failed to trigger sync');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    }
  };

  const initializeAgent = async () => {
    try {
      setRefreshing(true);
      const response = await fetch(`/api/repositories/${repositoryId}/analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initialize_agent' })
      });
      
      const result = await response.json();
      if (response.ok) {
        setTimeout(fetchAnalytics, 2000);
      } else {
        setError(result.error || 'Failed to initialize agent');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Initialization failed');
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [repositoryId]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      ACTIVE: 'default',
      INITIALIZING: 'secondary',
      ERROR: 'destructive',
      STOPPED: 'outline'
    };
    
    return (
      <Badge variant={variants[status] || 'outline'}>
        {status}
      </Badge>
    );
  };

  const formatTrend = (value: number) => {
    if (value === 0) return '→';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value}`;
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Loading Repository Analytics...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Analytics Error</CardTitle>
          <CardDescription className="text-red-500">{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button onClick={fetchAnalytics} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
            <Button onClick={initializeAgent} variant="default" size="sm">
              <Bot className="h-4 w-4 mr-2" />
              Initialize Agent
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Repository Analytics</CardTitle>
          <CardDescription>No analytics data available</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={initializeAgent} variant="default">
            <Bot className="h-4 w-4 mr-2" />
            Initialize Agent
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Agent Status */}
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Agent Status - {repositoryName}
              </CardTitle>
              <CardDescription>
                ID: {analytics.agent.id}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {getStatusBadge(analytics.agent.status)}
              <Button
                onClick={triggerSync}
                disabled={refreshing}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Sync Now
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium">Last Sync</span>
              <span className="text-sm">
                {analytics.agent.lastSyncAt ? 
                  new Date(analytics.agent.lastSyncAt).toLocaleString() : 
                  'Never'
                }
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium">Error Count</span>
              <span className="text-sm font-mono">
                {analytics.agent.errorCount}
              </span>
            </div>
            {analytics.agent.lastError && (
              <div className="col-span-full p-3 bg-red-50 border border-red-200 rounded-lg">
                <span className="font-medium text-red-700">Last Error:</span>
                <div className="text-sm text-red-600 mt-1">{analytics.agent.lastError}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Current Analytics */}
      {analytics.analytics.current && (
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Current Repository Metrics
            </CardTitle>
            <CardDescription>
              As of {new Date(analytics.analytics.current.date).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <div className="flex items-center gap-2 text-blue-600">
                    <Users className="h-4 w-4" />
                    <span className="text-sm font-medium">Contributors</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-700">
                    {analytics.analytics.current.contributors}
                  </div>
                  {analytics.analytics.trends && (
                    <div className="text-xs text-blue-600">
                      {formatTrend(analytics.analytics.trends.contributorsChange)}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <div className="flex items-center gap-2 text-green-600">
                    <GitPullRequest className="h-4 w-4" />
                    <span className="text-sm font-medium">Pull Requests</span>
                  </div>
                  <div className="text-2xl font-bold text-green-700">
                    {analytics.analytics.current.prs}
                  </div>
                  {analytics.analytics.trends && (
                    <div className="text-xs text-green-600">
                      {formatTrend(analytics.analytics.trends.prsChange)}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div>
                  <div className="flex items-center gap-2 text-yellow-600">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm font-medium">Stars</span>
                  </div>
                  <div className="text-2xl font-bold text-yellow-700">
                    {analytics.analytics.current.stars}
                  </div>
                  {analytics.analytics.trends && (
                    <div className="text-xs text-yellow-600">
                      {formatTrend(analytics.analytics.trends.starsChange)}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div>
                  <div className="flex items-center gap-2 text-purple-600">
                    <Building2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Corporate Activity</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-700">
                    {analytics.analytics.current.corporateActivity}
                  </div>
                  {analytics.analytics.trends && (
                    <div className="text-xs text-purple-600">
                      {formatTrend(analytics.analytics.trends.corporateActivityChange)}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-sm font-medium text-gray-600">Commits</div>
                  <div className="text-xl font-bold">{analytics.analytics.current.commits}</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-sm font-medium text-gray-600">Forks</div>
                  <div className="text-xl font-bold">{analytics.analytics.current.forks}</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-sm font-medium text-gray-600">Clones</div>
                  <div className="text-xl font-bold">{analytics.analytics.current.clones}</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-sm font-medium text-gray-600">Views</div>
                  <div className="text-xl font-bold">{analytics.analytics.current.views}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Corporate Users */}
      {analytics.corporateUsers.length > 0 && (
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Detected Corporate Users ({analytics.corporateUsers.length})
            </CardTitle>
            <CardDescription>
              Organizations identified using this repository
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.corporateUsers.slice(0, 5).map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{user.organizationName}</div>
                    <div className="text-sm text-gray-600">
                      @{user.githubLogin} • {user.detectionMethod} • 
                      Confidence: {Math.round(user.confidence * 100)}%
                    </div>
                    <div className="text-xs text-gray-500">
                      First detected: {new Date(user.firstDetected).toLocaleDateString()} •
                      Total activity: {user.totalActivity}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(user.status)}
                  </div>
                </div>
              ))}
              {analytics.corporateUsers.length > 5 && (
                <div className="text-sm text-gray-500 text-center">
                  +{analytics.corporateUsers.length - 5} more corporate users detected
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice Summary */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Invoice Summary
          </CardTitle>
          <CardDescription>
            Revenue from corporate usage detection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div>
                <div className="text-sm font-medium text-blue-600">Total Invoices</div>
                <div className="text-xl font-bold text-blue-700">{analytics.invoices.stats.total}</div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div>
                <div className="text-sm font-medium text-yellow-600">Pending</div>
                <div className="text-xl font-bold text-yellow-700">{analytics.invoices.stats.pending}</div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div>
                <div className="text-sm font-medium text-green-600">Paid</div>
                <div className="text-xl font-bold text-green-700">{analytics.invoices.stats.paid}</div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="text-sm font-medium text-gray-600">Revenue</div>
                <div className="text-lg font-bold">
                  {formatCurrency(analytics.invoices.stats.paidAmount)}
                </div>
              </div>
            </div>
          </div>

          {analytics.invoices.recent.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">Recent Invoices</h4>
              {analytics.invoices.recent.slice(0, 3).map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{invoice.invoiceNumber}</div>
                    <div className="text-sm text-gray-600">{invoice.organizationName}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatCurrency(invoice.amount, invoice.currency)}</div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(invoice.status)}
                      {invoice.isPaid && <Badge variant="default">Paid</Badge>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

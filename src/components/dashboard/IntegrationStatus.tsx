'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Settings } from 'lucide-react';

interface IntegrationStatus {
  service: string;
  status: 'healthy' | 'unhealthy' | 'not_configured';
  lastCheck: string;
  error?: string;
  metadata?: Record<string, any>;
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  integrations: IntegrationStatus[];
  lastUpdated: string;
  uptime: number;
}

interface SystemStatus {
  health: SystemHealth;
  scheduler: {
    initialized: boolean;
    activeJobs: number;
    lastJobRun?: string;
  };
  integrations: Record<string, boolean>;
}

export default function IntegrationStatus() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setError(null);
      const response = await fetch('/api/integrations/status');
      const result = await response.json();
      
      if (result.success) {
        setStatus(result.data);
      } else {
        setError(result.error || 'Failed to fetch status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const initializeSystem = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/integrations/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initialize' })
      });
      
      const result = await response.json();
      if (result.success) {
        await fetchStatus(); // Refresh status after initialization
      } else {
        setError(result.error || 'Failed to initialize');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Initialization failed');
    } finally {
      setRefreshing(false);
    }
  };

  const triggerHealthCheck = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/integrations/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'health_check' })
      });
      
      const result = await response.json();
      if (result.success) {
        setStatus(prevStatus => prevStatus ? {
          ...prevStatus,
          health: result.data
        } : null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Health check failed');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'unhealthy':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'degraded':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'not_configured':
        return <Settings className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      healthy: 'default',
      unhealthy: 'destructive',
      degraded: 'secondary',
      not_configured: 'outline'
    };
    
    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const formatUptime = (uptime: number) => {
    const hours = Math.floor(uptime / (1000 * 60 * 60));
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Loading Integration Status...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            Integration Status Error
          </CardTitle>
          <CardDescription className="text-red-500">
            {error}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button onClick={fetchStatus} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
            <Button onClick={initializeSystem} variant="default" size="sm">
              Initialize System
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Integration Status</CardTitle>
          <CardDescription>No status data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* System Overview */}
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {getStatusIcon(status.health.overall)}
                System Health Overview
              </CardTitle>
              <CardDescription>
                Last updated: {new Date(status.health.lastUpdated).toLocaleString()}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={triggerHealthCheck}
                disabled={refreshing}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                onClick={initializeSystem}
                disabled={refreshing}
                size="sm"
              >
                <Settings className="h-4 w-4 mr-2" />
                Initialize
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium">Overall Status</span>
              {getStatusBadge(status.health.overall)}
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium">System Uptime</span>
              <span className="text-sm text-gray-600">
                {formatUptime(status.health.uptime)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium">Active Jobs</span>
              <span className="text-sm font-mono">
                {status.scheduler.activeJobs}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integration Status */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Integration Services</CardTitle>
          <CardDescription>
            Status of external service integrations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {status.health.integrations.map((integration, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{integration.service}</h4>
                  {getStatusBadge(integration.status)}
                </div>
                
                <div className="text-sm text-gray-600 space-y-1">
                  <div>
                    Last Check: {new Date(integration.lastCheck).toLocaleString()}
                  </div>
                  
                  {integration.error && (
                    <div className="text-red-500 bg-red-50 p-2 rounded text-xs">
                      {integration.error}
                    </div>
                  )}
                  
                  {integration.metadata && (
                    <div className="text-xs bg-gray-100 p-2 rounded">
                      <pre className="font-mono">
                        {JSON.stringify(integration.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scheduler Status */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Background Task Scheduler</CardTitle>
          <CardDescription>
            Automated job processing status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium">Scheduler Status</span>
              {getStatusBadge(status.scheduler.initialized ? 'healthy' : 'unhealthy')}
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium">Active Jobs</span>
              <span className="text-sm font-mono">
                {status.scheduler.activeJobs}
              </span>
            </div>
            {status.scheduler.lastJobRun && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium">Last Job Run</span>
                <span className="text-sm">
                  {new Date(status.scheduler.lastJobRun).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

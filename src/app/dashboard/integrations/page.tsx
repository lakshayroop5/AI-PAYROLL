'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';

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

export default function IntegrationsPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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
    }
  };

  const initializeSystem = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/integrations/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initialize' })
      });
      
      const result = await response.json();
      if (result.success) {
        alert('System initialized successfully!');
        await fetchStatus();
      } else {
        setError(result.error || 'Failed to initialize');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Initialization failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800';
      case 'unhealthy': return 'bg-red-100 text-red-800';
      case 'degraded': return 'bg-yellow-100 text-yellow-800';
      case 'not_configured': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatUptime = (uptime: number) => {
    const hours = Math.floor(uptime / (1000 * 60 * 60));
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Integrations</h1>
            <p className="text-gray-600 mt-1">
              Monitor and manage AI Payroll system integrations
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchStatus} variant="outline">
              Refresh Status
            </Button>
            <Button onClick={initializeSystem}>
              Initialize System
            </Button>
          </div>
        </div>

        {loading && (
          <div className="bg-white rounded-lg border p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Loading integration status...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-red-800 font-medium">Error</h3>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <Button onClick={fetchStatus} size="sm" className="mt-2">
              Try Again
            </Button>
          </div>
        )}

        {status && (
          <>
            {/* System Overview */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">System Health Overview</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Overall Status</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(status.health?.overall || 'unknown')}`}>
                      {status.health?.overall || 'Unknown'}
                    </span>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">System Uptime</span>
                    <span className="text-sm text-gray-900">
                      {status.health?.uptime ? formatUptime(status.health.uptime) : 'Unknown'}
                    </span>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Active Jobs</span>
                    <span className="text-sm font-mono text-gray-900">
                      {status.scheduler?.activeJobs || 0}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-500">
                Last updated: {status.health?.lastUpdated ? new Date(status.health.lastUpdated).toLocaleString() : 'Never'}
              </p>
            </div>

            {/* Integration Services */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Integration Services</h2>
              
              {status.health?.integrations?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {status.health.integrations.map((integration: IntegrationStatus, index: number) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-gray-900">{integration.service}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(integration.status)}`}>
                          {integration.status.replace('_', ' ')}
                        </span>
                      </div>
                      
                      <div className="space-y-1 text-sm text-gray-600">
                        <div>Last Check: {new Date(integration.lastCheck).toLocaleString()}</div>
                        
                        {integration.error && (
                          <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                            {integration.error}
                          </div>
                        )}
                        
                        {integration.metadata && Object.keys(integration.metadata).length > 0 && (
                          <div className="p-2 bg-gray-50 rounded text-xs">
                            {Object.entries(integration.metadata).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="font-medium">{key}:</span>
                                <span>{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No integration data available</p>
                  <Button onClick={initializeSystem} className="mt-4">
                    Initialize Integrations
                  </Button>
                </div>
              )}
            </div>

            {/* Background Scheduler */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Background Task Scheduler</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Scheduler Status</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      status.scheduler?.initialized ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {status.scheduler?.initialized ? 'Running' : 'Stopped'}
                    </span>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Active Jobs</span>
                    <span className="text-sm font-mono text-gray-900">
                      {status.scheduler?.activeJobs || 0}
                    </span>
                  </div>
                </div>
                
                {status.scheduler?.lastJobRun && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Last Job Run</span>
                      <span className="text-sm text-gray-900">
                        {new Date(status.scheduler.lastJobRun).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-blue-800 font-medium mb-2">Quick Actions</h3>
              <div className="space-y-2 text-sm text-blue-700">
                <p>🔄 <strong>Refresh Status:</strong> Click "Refresh Status" to update integration health</p>
                <p>⚡ <strong>Initialize System:</strong> Click "Initialize System" to start all integrations</p>
                <p>📊 <strong>View Scheduler:</strong> Visit <code>/api/integrations/scheduler</code> for detailed job status</p>
                <p>🔍 <strong>Check Logs:</strong> Monitor browser console for detailed integration logs</p>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

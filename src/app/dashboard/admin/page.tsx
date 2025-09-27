/**
 * Admin Dashboard Page
 * System management and monitoring interface
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import IntegrationStatus from '@/components/dashboard/IntegrationStatus';
import { Settings, Activity, Database, Bot, Mail, Calendar } from 'lucide-react';

export default function AdminDashboard() {
  return (
    <div className="container mx-auto py-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">System Administration</h1>
            <p className="text-gray-600">
              Monitor and manage AI Payroll system integrations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <span className="text-sm text-gray-600">Admin Panel</span>
          </div>
        </div>

        {/* Main Dashboard */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Active Repositories
                  </CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">12</div>
                  <p className="text-xs text-muted-foreground">
                    +2 from last week
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Running Agents
                  </CardTitle>
                  <Bot className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">8</div>
                  <p className="text-xs text-muted-foreground">
                    4 syncing, 4 monitoring
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Monthly Revenue
                  </CardTitle>
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$2,845</div>
                  <p className="text-xs text-muted-foreground">
                    +18.2% from last month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Scheduled Jobs
                  </CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">7</div>
                  <p className="text-xs text-muted-foreground">
                    All running normally
                  </p>
                </CardContent>
              </Card>
            </div>

            <IntegrationStatus />
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            <IntegrationStatus />
          </TabsContent>

          <TabsContent value="scheduler" className="space-y-6">
            <SchedulerManagement />
          </TabsContent>

          <TabsContent value="agents" className="space-y-6">
            <AgentManagement />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <SystemAnalytics />
          </TabsContent>

          <TabsContent value="logs" className="space-y-6">
            <SystemLogs />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Placeholder components - these would be full implementations
function SchedulerManagement() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Background Job Scheduler</CardTitle>
        <CardDescription>Manage automated tasks and job execution</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600">Scheduler management interface coming soon...</p>
        <p className="text-sm text-gray-500 mt-2">
          This will show job status, execution history, and manual controls.
        </p>
      </CardContent>
    </Card>
  );
}

function AgentManagement() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Repository Agents</CardTitle>
        <CardDescription>Monitor and manage repository monitoring agents</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600">Agent management interface coming soon...</p>
        <p className="text-sm text-gray-500 mt-2">
          This will show agent status, error logs, and restart controls.
        </p>
      </CardContent>
    </Card>
  );
}

function SystemAnalytics() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>System Analytics</CardTitle>
        <CardDescription>Performance metrics and usage statistics</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600">System analytics coming soon...</p>
        <p className="text-sm text-gray-500 mt-2">
          This will show system performance, usage trends, and health metrics.
        </p>
      </CardContent>
    </Card>
  );
}

function SystemLogs() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>System Logs</CardTitle>
        <CardDescription>View system logs and error reports</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600">Log viewer coming soon...</p>
        <p className="text-sm text-gray-500 mt-2">
          This will show real-time logs, error tracking, and audit trails.
        </p>
      </CardContent>
    </Card>
  );
}

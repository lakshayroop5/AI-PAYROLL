'use client';

/**
 * Activity log page
 */

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { formatDate, getStatusColor, cn } from '@/lib/utils';

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  status?: string;
}

export default function ActivityPage() {
  const { data: session } = useSession();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, []);

  async function fetchActivities() {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard/activity?limit=50');
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
          <p className="text-gray-600 mt-1">
            Track all your actions and system events.
          </p>
        </div>

        {/* Activity List */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
          </div>
          
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading activity...</p>
            </div>
          ) : activities.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {activities.map((activity) => (
                <div key={activity.id} className="p-6">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm">
                          {activity.type === 'run_created' && '🚀'}
                          {activity.type === 'run_executed' && '✅'}
                          {activity.type === 'contributor_added' && '👤'}
                          {activity.type === 'verification_completed' && '🔒'}
                          {activity.type === 'repository_added' && '📁'}
                          {!['run_created', 'run_executed', 'contributor_added', 'verification_completed', 'repository_added'].includes(activity.type) && '📋'}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                      <p className="text-sm text-gray-500">{activity.description}</p>
                      <div className="flex items-center mt-2 space-x-2">
                        <p className="text-xs text-gray-400">{formatDate(activity.timestamp)}</p>
                        {activity.status && (
                          <span className={cn(
                            "inline-flex items-center px-2 py-1 rounded text-xs font-medium",
                            getStatusColor(activity.status)
                          )}>
                            {activity.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center">
              <div className="text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No activity</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Your activity will appear here as you use the platform.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

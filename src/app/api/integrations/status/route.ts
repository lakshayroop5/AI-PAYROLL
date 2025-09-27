/**
 * Integration Status API
 * Provides system health and integration status information
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
// import { integrationManager } from '@/lib/integrations/manager';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Temporary mock status while integrations are being set up
    const status = {
      health: {
        overall: 'healthy' as const,
        integrations: [
          { service: 'Database', status: 'healthy' as const, lastCheck: new Date().toISOString() },
          { service: 'The Graph', status: 'not_configured' as const, lastCheck: new Date().toISOString() },
          { service: 'Fetch.ai', status: 'not_configured' as const, lastCheck: new Date().toISOString() },
          { 
            service: 'Hedera', 
            status: (process.env.HEDERA_ACCOUNT_ID && process.env.HEDERA_PRIVATE_KEY) ? 'healthy' as const : 'not_configured' as const, 
            lastCheck: new Date().toISOString(),
            metadata: (process.env.HEDERA_ACCOUNT_ID && process.env.HEDERA_PRIVATE_KEY) ? { 
              configured: true, 
              network: process.env.HEDERA_NETWORK || 'testnet',
              accountId: process.env.HEDERA_ACCOUNT_ID 
            } : undefined
          },
          { 
            service: 'Email (SendGrid)', 
            status: process.env.SENDGRID_API_KEY ? 'healthy' as const : 'not_configured' as const, 
            lastCheck: new Date().toISOString(),
            metadata: process.env.SENDGRID_API_KEY ? { configured: true, fromEmail: process.env.SENDGRID_FROM_EMAIL } : undefined
          },
        ],
        lastUpdated: new Date().toISOString(),
        uptime: Date.now() - (new Date().getTime() - 60000) // 1 minute uptime
      },
      scheduler: {
        initialized: false,
        activeJobs: 0
      },
      integrations: {
        graph: false,
        fetchAI: false,
        hedera: false,
        storage: false,
        email: false
      }
    };

    return NextResponse.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching integration status:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch integration status',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await request.json();

    switch (action) {
      case 'health_check':
        // Temporary mock health check
        const health = {
          overall: 'healthy' as const,
          integrations: [
            { service: 'Database', status: 'healthy' as const, lastCheck: new Date().toISOString() },
            { service: 'The Graph', status: 'not_configured' as const, lastCheck: new Date().toISOString() },
            { service: 'Fetch.ai', status: 'not_configured' as const, lastCheck: new Date().toISOString() },
            { 
              service: 'Hedera', 
              status: (process.env.HEDERA_ACCOUNT_ID && process.env.HEDERA_PRIVATE_KEY) ? 'healthy' as const : 'not_configured' as const, 
              lastCheck: new Date().toISOString(),
              metadata: (process.env.HEDERA_ACCOUNT_ID && process.env.HEDERA_PRIVATE_KEY) ? { 
                configured: true, 
                network: process.env.HEDERA_NETWORK || 'testnet',
                accountId: process.env.HEDERA_ACCOUNT_ID 
              } : undefined
            },
            { 
              service: 'Email (SendGrid)', 
              status: process.env.SENDGRID_API_KEY ? 'healthy' as const : 'not_configured' as const, 
              lastCheck: new Date().toISOString(),
              metadata: process.env.SENDGRID_API_KEY ? { configured: true, fromEmail: process.env.SENDGRID_FROM_EMAIL } : undefined
            },
          ],
          lastUpdated: new Date().toISOString(),
          uptime: Date.now()
        };
        return NextResponse.json({
          success: true,
          data: health,
          timestamp: new Date().toISOString()
        });

      case 'initialize':
        // Temporary mock initialization
        console.log('Mock initialization completed');
        return NextResponse.json({
          success: true,
          message: 'Integration manager initialized (mock)',
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error processing integration action:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to process integration action',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

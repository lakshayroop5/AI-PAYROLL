/**
 * System Initialization
 * Initializes all integrations and services when the application starts
 */

import { integrationManager } from './integrations/manager';
import { prisma } from './db';

export async function initializeSystem(): Promise<void> {
  console.log('🚀 Initializing AI Payroll System...');
  
  try {
    // Check database connection
    console.log('📊 Checking database connection...');
    await prisma.$connect();
    console.log('✅ Database connected');

    // Initialize integration manager
    console.log('🔗 Initializing integrations...');
    await integrationManager.initialize();
    console.log('✅ Integrations initialized');

    // Create default system configuration if needed
    await initializeSystemConfig();
    
    console.log('🎉 AI Payroll System initialization complete!');
    
  } catch (error) {
    console.error('❌ System initialization failed:', error);
    throw error;
  }
}

/**
 * Initialize default system configuration
 */
async function initializeSystemConfig(): Promise<void> {
  try {
    // Check if system config exists
    const existingConfig = await prisma.systemConfig.findUnique({
      where: { key: 'system_initialized' }
    });

    if (!existingConfig) {
      console.log('📝 Creating default system configuration...');
      
      // Create initialization marker
      await prisma.systemConfig.create({
        data: {
          key: 'system_initialized',
          value: JSON.stringify({
            initializedAt: new Date().toISOString(),
            version: '2.0.0',
            features: {
              graphIntegration: true,
              fetchAIAgents: true,
              hederaPayments: true,
              lighthouseStorage: true,
              emailNotifications: true,
              taskScheduler: true
            }
          }),
          description: 'System initialization marker and configuration'
        }
      });

      // Create default system settings
      const defaultConfigs = [
        {
          key: 'payroll_default_settings',
          value: JSON.stringify({
            distributionMode: 'PR_COUNT_PROPORTIONAL',
            defaultAsset: 'HBAR',
            minimumPayout: 10,
            pythFeedId: 'Crypto.HBAR/USD'
          }),
          description: 'Default payroll processing settings'
        },
        {
          key: 'corporate_detection_settings',
          value: JSON.stringify({
            confidenceThreshold: 0.8,
            autoInvoiceGeneration: true,
            invoicingFrequency: 'monthly',
            baseInvoiceAmount: 100
          }),
          description: 'Corporate user detection and invoicing settings'
        },
        {
          key: 'notification_settings',
          value: JSON.stringify({
            enableEmailNotifications: true,
            adminEmails: [process.env.ADMIN_EMAIL || 'admin@ai-payroll.com'],
            payoutConfirmations: true,
            systemAlerts: true
          }),
          description: 'System notification settings'
        }
      ];

      for (const config of defaultConfigs) {
        await prisma.systemConfig.upsert({
          where: { key: config.key },
          update: {
            value: config.value,
            description: config.description
          },
          create: config
        });
      }

      console.log('✅ Default system configuration created');
    }
  } catch (error) {
    console.error('Failed to initialize system config:', error);
    throw error;
  }
}

/**
 * Shutdown system gracefully
 */
export async function shutdownSystem(): Promise<void> {
  console.log('🛑 Shutting down AI Payroll System...');
  
  try {
    // Shutdown integration manager
    await integrationManager.shutdown();
    
    // Disconnect from database
    await prisma.$disconnect();
    
    console.log('✅ AI Payroll System shutdown complete');
  } catch (error) {
    console.error('❌ System shutdown failed:', error);
    throw error;
  }
}

// Handle process termination
if (typeof process !== 'undefined') {
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await shutdownSystem();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await shutdownSystem();
    process.exit(0);
  });
}

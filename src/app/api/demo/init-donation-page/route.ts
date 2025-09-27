/**
 * Demo API to initialize a donation page for testing
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Find or create a demo user
    let demoUser = await prisma.user.findFirst({
      where: { email: 'demo@ai-payroll.com' }
    });

    if (!demoUser) {
      demoUser = await prisma.user.create({
        data: {
          email: 'demo@ai-payroll.com',
          githubLogin: 'ai-payroll-demo',
          managerWalletAddress: 'demo-wallet-0x1234567890abcdef', // Demo wallet address
          roles: JSON.stringify(['manager'])
        }
      });
    }

    // Update wallet if not set
    if (!demoUser.managerWalletAddress) {
      demoUser = await prisma.user.update({
        where: { id: demoUser.id },
        data: {
          managerWalletAddress: 'demo-wallet-0x1234567890abcdef'
        }
      });
    }

    // Check if demo donation page exists
    let donationPage = await prisma.donationPage.findUnique({
      where: { slug: 'ai-payroll-demo' }
    });

    if (!donationPage) {
      // Create demo donation page
      donationPage = await prisma.donationPage.create({
        data: {
          managerId: demoUser.id,
          slug: 'ai-payroll-demo',
          pageTitle: 'Support AI-Payroll Open Source Development',
          description: 'Help us build the future of decentralized payroll systems! Your PYUSD donations support our open source contributors and help maintain this project.',
          customMessage: 'Thank you for supporting AI-Payroll! Every donation helps us maintain our infrastructure, pay our contributors, and build amazing features for the open source community. 🚀',
          minimumAmount: 1,
          maximumAmount: 500,
          isActive: true,
          acceptedCurrencies: JSON.stringify(['PYUSD', 'PayPal']),
          themeColor: '#0052CC'
        }
      });
    }

    // Create some demo donation history
    const existingDonations = await prisma.donation.count({
      where: { managerId: demoUser.id }
    });

    if (existingDonations === 0) {
      // Create demo donations
      const demoDonations = [
        {
          companyName: 'TechCorp Inc.',
          amount: 100,
          status: 'CONFIRMED',
          transactionHash: 'demo-tx-001',
          confirmedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
        },
        {
          companyName: 'DevSolutions LLC',
          amount: 250,
          status: 'CONFIRMED',
          transactionHash: 'demo-tx-002',
          confirmedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
        },
        {
          companyName: 'StartupX',
          amount: 50,
          status: 'PENDING',
          confirmedAt: null
        }
      ];

      for (const demoDonation of demoDonations) {
        await prisma.donation.create({
          data: {
            managerId: demoUser.id,
            repositoryId: null,
            amount: demoDonation.amount,
            currency: 'PYUSD',
            paymentMethod: 'PYUSD',
            companyName: demoDonation.companyName,
            status: demoDonation.status,
            transactionHash: demoDonation.transactionHash,
            paymentAddress: demoUser.managerWalletAddress,
            network: 'testnet',
            qrCodeGenerated: true,
            confirmedAt: demoDonation.confirmedAt,
            message: 'Thank you for the amazing work on AI-Payroll!',
            metadata: JSON.stringify({
              demo: true,
              timestamp: new Date().toISOString()
            })
          }
        });
      }

      // Update donation page statistics
      const totalAmount = demoDonations
        .filter(d => d.status === 'CONFIRMED')
        .reduce((sum, d) => sum + d.amount, 0);
      
      const confirmedCount = demoDonations.filter(d => d.status === 'CONFIRMED').length;

      await prisma.donationPage.update({
        where: { id: donationPage.id },
        data: {
          totalDonations: totalAmount,
          donationCount: confirmedCount,
          lastDonationAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Demo donation page initialized successfully',
      donationPageUrl: `/donate/${donationPage.slug}`,
      donationPage: {
        id: donationPage.id,
        slug: donationPage.slug,
        pageTitle: donationPage.pageTitle,
        totalDonations: donationPage.totalDonations,
        donationCount: donationPage.donationCount
      },
      demoUser: {
        id: demoUser.id,
        email: demoUser.email,
        walletAddress: demoUser.managerWalletAddress
      }
    });

  } catch (error) {
    console.error('❌ Error initializing demo donation page:', error);
    return NextResponse.json(
      { 
        error: 'Failed to initialize demo donation page',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

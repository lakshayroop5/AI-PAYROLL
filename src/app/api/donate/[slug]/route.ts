/**
 * Donation Page API
 * Retrieves donation page data by slug
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;

    // Find donation page by slug
    const donationPage = await prisma.donationPage.findUnique({
      where: { slug },
      include: {
        manager: {
          select: {
            id: true,
            email: true,
            githubLogin: true,
            managerWalletAddress: true
          }
        }
      }
    });

    if (!donationPage || !donationPage.isActive) {
      return NextResponse.json(
        { error: 'Donation page not found or inactive' },
        { status: 404 }
      );
    }

    if (!donationPage.manager.managerWalletAddress) {
      return NextResponse.json(
        { error: 'Donation page not configured - no wallet address' },
        { status: 400 }
      );
    }

    // Parse accepted currencies
    let acceptedCurrencies: string[] = [];
    try {
      acceptedCurrencies = JSON.parse(donationPage.acceptedCurrencies);
    } catch {
      acceptedCurrencies = ['PYUSD', 'PayPal'];
    }

    const response = {
      id: donationPage.id,
      slug: donationPage.slug,
      pageTitle: donationPage.pageTitle,
      description: donationPage.description,
      managerName: donationPage.manager.githubLogin || donationPage.manager.email,
      managerWallet: donationPage.manager.managerWalletAddress,
      acceptedCurrencies,
      minimumAmount: donationPage.minimumAmount,
      maximumAmount: donationPage.maximumAmount,
      customMessage: donationPage.customMessage,
      logoUrl: donationPage.logoUrl,
      themeColor: donationPage.themeColor,
      totalDonations: donationPage.totalDonations,
      donationCount: donationPage.donationCount,
      lastDonationAt: donationPage.lastDonationAt?.toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Error fetching donation page:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch donation page',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

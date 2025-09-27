/**
 * Donation History API
 * Retrieves donation history for a donation page
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;

    // Find donation page
    const donationPage = await prisma.donationPage.findUnique({
      where: { slug },
      select: { managerId: true }
    });

    if (!donationPage) {
      return NextResponse.json(
        { error: 'Donation page not found' },
        { status: 404 }
      );
    }

    // Get donation history for this manager
    const donations = await prisma.donation.findMany({
      where: {
        managerId: donationPage.managerId,
        // Only show confirmed donations for privacy
        status: {
          in: ['CONFIRMED', 'PENDING']
        }
      },
      select: {
        id: true,
        companyName: true,
        amount: true,
        currency: true,
        status: true,
        transactionHash: true,
        createdAt: true,
        confirmedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20 // Limit to recent 20 donations
    });

    // Format the response
    const formattedDonations = donations.map(donation => ({
      id: donation.id,
      companyName: donation.companyName,
      amount: donation.amount,
      currency: donation.currency,
      status: donation.status,
      transactionHash: donation.transactionHash,
      createdAt: donation.createdAt.toISOString(),
      confirmedAt: donation.confirmedAt?.toISOString()
    }));

    return NextResponse.json({
      success: true,
      donations: formattedDonations,
      total: donations.length
    });

  } catch (error) {
    console.error('❌ Error fetching donation history:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch donation history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

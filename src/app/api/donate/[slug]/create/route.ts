/**
 * Create Donation API
 * Creates a new donation record for payment processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateId } from '@/lib/utils';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const { amount, currency, companyName, donorEmail, message } = await request.json();

    // Validate input
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid donation amount' },
        { status: 400 }
      );
    }

    // Find donation page
    const donationPage = await prisma.donationPage.findUnique({
      where: { slug },
      select: {
        id: true,
        managerId: true,
        minimumAmount: true,
        maximumAmount: true,
        isActive: true,
        manager: {
          select: {
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
        { error: 'Donation page not configured properly' },
        { status: 400 }
      );
    }

    // Check amount limits
    if (donationPage.minimumAmount && amount < donationPage.minimumAmount) {
      return NextResponse.json(
        { error: `Minimum donation amount is $${donationPage.minimumAmount}` },
        { status: 400 }
      );
    }

    if (donationPage.maximumAmount && amount > donationPage.maximumAmount) {
      return NextResponse.json(
        { error: `Maximum donation amount is $${donationPage.maximumAmount}` },
        { status: 400 }
      );
    }

    // Create donation record
    const donation = await prisma.donation.create({
      data: {
        managerId: donationPage.managerId,
        amount: parseFloat(amount.toString()),
        currency: currency || 'PYUSD',
        paymentMethod: 'PYUSD',
        companyName: companyName || null,
        donorEmail: donorEmail || null,
        message: message || null,
        status: 'PENDING',
        paymentAddress: donationPage.manager.managerWalletAddress,
        network: 'testnet',
        qrCodeGenerated: true,
        metadata: JSON.stringify({
          slug,
          donationPageId: donationPage.id,
          userAgent: request.headers.get('user-agent'),
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          timestamp: new Date().toISOString()
        })
      }
    });

    // Log the donation creation
    await prisma.auditLog.create({
      data: {
        action: 'DONATION_CREATED',
        resource: donation.id,
        details: JSON.stringify({
          donationId: donation.id,
          amount: donation.amount,
          currency: donation.currency,
          companyName: donation.companyName,
          slug,
          timestamp: new Date().toISOString()
        }),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    });

    return NextResponse.json({
      success: true,
      donationId: donation.id,
      amount: donation.amount,
      currency: donation.currency,
      paymentAddress: donation.paymentAddress,
      status: donation.status,
      qrData: `pyusd:${donation.paymentAddress}?amount=${donation.amount}&message=${encodeURIComponent(donation.message || 'Donation')}`,
      message: 'Donation created successfully. Please complete the payment.'
    });

  } catch (error) {
    console.error('❌ Error creating donation:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create donation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

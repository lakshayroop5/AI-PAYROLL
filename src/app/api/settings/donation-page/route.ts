/**
 * Donation Page Settings API
 * Handles creating and retrieving donation pages for managers
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's donation page
    const donationPage = await prisma.donationPage.findUnique({
      where: { managerId: session.user.id }
    });

    return NextResponse.json({
      success: true,
      donationPage
    });

  } catch (error) {
    console.error('❌ Error fetching donation page:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch donation page',
        details: error instanceof Error ? error.message : 'Unknown error'
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

    const { slug, pageTitle, description, customMessage, minimumAmount, maximumAmount } = await request.json();

    console.log('💳 Creating donation page for:', session.user.email, '→', slug);

    // Validate input
    if (!slug || slug.trim().length < 3) {
      return NextResponse.json({ 
        error: 'Slug must be at least 3 characters long' 
      }, { status: 400 });
    }

    // Check if user has a wallet configured
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { managerWalletAddress: true }
    });

    if (!user?.managerWalletAddress) {
      return NextResponse.json({ 
        error: 'Please configure your payment wallet before creating a donation page' 
      }, { status: 400 });
    }

    // Check if slug is already taken
    const existingPage = await prisma.donationPage.findUnique({
      where: { slug: slug.toLowerCase().trim() }
    });

    if (existingPage) {
      return NextResponse.json({ 
        error: 'This URL slug is already taken. Please choose a different one.' 
      }, { status: 400 });
    }

    // Check if user already has a donation page
    const userPage = await prisma.donationPage.findUnique({
      where: { managerId: session.user.id }
    });

    if (userPage) {
      return NextResponse.json({ 
        error: 'You already have a donation page. Each user can only have one donation page.' 
      }, { status: 400 });
    }

    // Create donation page
    const donationPage = await prisma.donationPage.create({
      data: {
        managerId: session.user.id,
        slug: slug.toLowerCase().trim(),
        pageTitle: pageTitle || 'Support Our Open Source Work',
        description: description || null,
        customMessage: customMessage || null,
        minimumAmount: minimumAmount && minimumAmount > 0 ? minimumAmount : null,
        maximumAmount: maximumAmount && maximumAmount > 0 ? maximumAmount : null,
        isActive: true,
        acceptedCurrencies: JSON.stringify(['PYUSD', 'PayPal']),
        themeColor: '#0052CC'
      }
    });

    // Log the creation
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DONATION_PAGE_CREATED',
        resource: donationPage.id,
        details: JSON.stringify({
          donationPageId: donationPage.id,
          slug: donationPage.slug,
          pageTitle: donationPage.pageTitle,
          managerEmail: session.user.email,
          timestamp: new Date().toISOString()
        }),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Donation page created successfully',
      donationPage: {
        id: donationPage.id,
        slug: donationPage.slug,
        pageTitle: donationPage.pageTitle,
        description: donationPage.description,
        totalDonations: donationPage.totalDonations,
        donationCount: donationPage.donationCount,
        isActive: donationPage.isActive,
        createdAt: donationPage.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Error creating donation page:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create donation page',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

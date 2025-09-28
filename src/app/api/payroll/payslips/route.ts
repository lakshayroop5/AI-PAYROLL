/**
 * Payslip Generation API
 * Generates professional HTML payslips and stores them on IPFS via Lighthouse
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { payslipGenerator, PayslipData } from '@/lib/payslip-generator';

export async function POST(request: NextRequest) {
  try {
    console.log('🧾 Payslip generation request received');
    
    // Get session
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { runId, contributorId, companyInfo } = body;

    if (!runId) {
      return NextResponse.json({ error: 'Run ID is required' }, { status: 400 });
    }

    // Get payroll run data
    const run = await prisma.payrollRun.findUnique({
      where: { id: runId },
      include: {
        createdBy: true,
        payouts: {
          include: {
            contributor: {
              include: { user: true }
            }
          }
        },
        runItems: true,
        repositories: true
      }
    });

    if (!run) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }

    // Verify user has access to this run
    if (run.createdBy.email !== session.user.email) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Default company information
    const defaultCompanyInfo = {
      name: 'Foss It System',
      address: 'Decentralized Organization',
      website: 'https://ai-payroll.vercel.app',
      logo: undefined
    };

    const finalCompanyInfo = { ...defaultCompanyInfo, ...companyInfo };

    if (contributorId) {
      // Generate payslip for specific contributor
      const payout = run.payouts.find(p => p.contributorId === contributorId);
      if (!payout) {
        return NextResponse.json({ error: 'Contributor not found in this run' }, { status: 404 });
      }

      const result = await generateSinglePayslip(run, payout, finalCompanyInfo);
      return NextResponse.json({ success: true, payslip: result });
    } else {
      // Generate payslips for all contributors
      const results = await payslipGenerator.generateBulkPayslips(runId, finalCompanyInfo);
      
      const successful = results.filter(r => r.result.success);
      const failed = results.filter(r => !r.result.success);

      return NextResponse.json({
        success: true,
        summary: {
          total: results.length,
          successful: successful.length,
          failed: failed.length
        },
        payslips: results.map(r => ({
          contributorId: r.contributorId,
          contributorName: r.contributorName,
          success: r.result.success,
          ipfsCid: r.result.ipfsCid,
          gatewayUrl: r.result.gatewayUrl,
          error: r.result.error,
          metadata: r.result.metadata
        }))
      });
    }

  } catch (error) {
    console.error('Payslip generation error:', error);
    return NextResponse.json(
      { 
        error: 'Payslip generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const runId = searchParams.get('runId');

    if (!runId) {
      return NextResponse.json({ error: 'Run ID is required' }, { status: 400 });
    }

    // Get existing payslip artifacts
    const artifacts = await prisma.artifact.findMany({
      where: {
        runId,
        type: 'payslip'
      },
      orderBy: { createdAt: 'desc' }
    });

    const payslips = artifacts.map(artifact => ({
      id: artifact.id,
      filename: artifact.filename,
      cid: artifact.cid,
      size: artifact.size,
      verified: artifact.verified,
      createdAt: artifact.createdAt,
      gatewayUrl: `https://gateway.lighthouse.storage/ipfs/${artifact.cid}`
    }));

    return NextResponse.json({
      success: true,
      runId,
      payslips,
      count: payslips.length
    });

  } catch (error) {
    console.error('Error fetching payslips:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payslips' },
      { status: 500 }
    );
  }
}

/**
 * Generate payslip for a single contributor
 */
async function generateSinglePayslip(run: any, payout: any, companyInfo: any) {
  // Get contributor's work summary
  const contributorPRs = run.runItems.filter(
    (item: any) => item.authorLogin === payout.contributor.githubHandle
  );

  const workSummary = {
    totalPRs: contributorPRs.length,
    linesAdded: contributorPRs.reduce((sum: number, pr: any) => sum + (pr.linesAdded || 0), 0),
    linesDeleted: contributorPRs.reduce((sum: number, pr: any) => sum + (pr.linesDeleted || 0), 0),
    filesModified: contributorPRs.reduce((sum: number, pr: any) => sum + (pr.filesChanged || 0), 0),
    contributions: contributorPRs.map((pr: any) => ({
      repository: pr.repo,
      prNumber: pr.prNumber,
      title: pr.title,
      mergedAt: pr.mergedAt.toISOString(),
      linesAdded: pr.linesAdded || 0,
      linesDeleted: pr.linesDeleted || 0,
      url: `https://github.com/${pr.repo}/pull/${pr.prNumber}`
    }))
  };

  const payslipData: PayslipData = {
    companyName: companyInfo.name,
    companyLogo: companyInfo.logo,
    companyAddress: companyInfo.address,
    companyWebsite: companyInfo.website,
    
    runId: run.id,
    runNumber: run.runNumber,
    payPeriod: {
      startDate: run.startDate.toISOString().split('T')[0],
      endDate: run.endDate.toISOString().split('T')[0]
    },
    generatedDate: new Date().toISOString(),
    
    contributor: {
      name: payout.contributor.user?.githubLogin || payout.contributor.githubHandle || 'Unknown',
      githubLogin: payout.contributor.githubHandle || 'unknown',
      hederaAccountId: payout.contributor.hederaAccountId,
      email: payout.contributor.user?.email
    },
    
    repositories: run.repositories.map((repo: any) => ({
      name: repo.name,
      fullName: repo.fullName,
      url: `https://github.com/${repo.fullName}`
    })),
    
    workSummary,
    
    payment: {
      baseAmount: payout.usdAmount,
      currency: 'USD',
      cryptoAmount: payout.nativeAmount,
      cryptoCurrency: run.asset,
      sharePercentage: payout.shareRatio * 100,
      transactionId: payout.txId || undefined,
      blockchainNetwork: run.environment,
      status: payout.status,
      paymentDate: payout.confirmedAt?.toISOString()
    },
    
    verification: {
      payslipId: `PS-${run.runNumber}-${payout.contributorId.slice(-8)}`,
      securityHash: '',
      blockchainTxId: payout.txId || undefined
    }
  };

  // Generate and upload payslip
  const result = await payslipGenerator.generateAndUploadPayslip(payslipData);
  
  // Store artifact record
  if (result.success && result.ipfsCid) {
    await prisma.artifact.create({
      data: {
        runId: run.id,
        type: 'payslip',
        filename: `payslip_${payslipData.contributor.githubLogin}_${Date.now()}.html`,
        cid: result.ipfsCid,
        size: result.metadata.fileSize,
        verified: true,
        lastCheckedAt: new Date()
      }
    });
  }

  return {
    contributorId: payout.contributorId,
    contributorName: payslipData.contributor.name,
    success: result.success,
    ipfsCid: result.ipfsCid,
    gatewayUrl: result.gatewayUrl,
    error: result.error,
    metadata: result.metadata
  };
}

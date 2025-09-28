/**
 * Individual Payslip Generation API
 * Generate payslips for a specific payroll run
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { payslipGenerator } from '@/lib/payslip-generator';

interface RouteParams {
  params: Promise<{
    runId: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { runId } = await params;
    console.log(`🧾 Generating payslips for run: ${runId}`);
    
    // Get session
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const { companyInfo, regenerate = false } = body;

    // Verify run exists and user has access
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
        }
      }
    });

    if (!run) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }

    if (run.createdBy.email !== session.user.email) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if payslips already exist
    if (!regenerate) {
      const existingPayslips = await prisma.artifact.findMany({
        where: {
          runId,
          type: 'payslip'
        }
      });

      if (existingPayslips.length > 0) {
        return NextResponse.json({
          success: false,
          error: 'Payslips already exist for this run',
          existingCount: existingPayslips.length,
          suggestion: 'Use regenerate=true to recreate payslips'
        }, { status: 409 });
      }
    }

    // Default company information
    const defaultCompanyInfo = {
      name: run.createdBy.githubLogin ? `${run.createdBy.githubLogin}'s Organization` : 'Foss It System',
      address: 'Decentralized Organization',
      website: 'https://ai-payroll.vercel.app'
    };

    const finalCompanyInfo = { ...defaultCompanyInfo, ...companyInfo };

    // Generate payslips for all contributors
    const results = await payslipGenerator.generateBulkPayslips(runId, finalCompanyInfo);
    
    // Store successful payslips as artifacts
    const artifactPromises = results
      .filter(r => r.result.success && r.result.ipfsCid)
      .map(r => 
        prisma.artifact.create({
          data: {
            runId,
            type: 'payslip',
            filename: `payslip_${r.contributorName.replace(/\s+/g, '_')}_${Date.now()}.html`,
            cid: r.result.ipfsCid!,
            size: r.result.metadata.fileSize,
            verified: true,
            lastCheckedAt: new Date()
          }
        })
      );

    await Promise.all(artifactPromises);

    const successful = results.filter(r => r.result.success);
    const failed = results.filter(r => !r.result.success);

    console.log(`✅ Generated ${successful.length}/${results.length} payslips for run ${runId}`);

    return NextResponse.json({
      success: true,
      runId,
      summary: {
        total: results.length,
        successful: successful.length,
        failed: failed.length,
        generatedAt: new Date().toISOString()
      },
      payslips: results.map(r => ({
        contributorId: r.contributorId,
        contributorName: r.contributorName,
        success: r.result.success,
        ipfsCid: r.result.ipfsCid,
        gatewayUrl: r.result.gatewayUrl,
        error: r.result.error,
        payslipId: r.result.metadata.payslipId,
        securityHash: r.result.metadata.securityHash
      })),
      companyInfo: finalCompanyInfo
    });

  } catch (error) {
    console.error('Bulk payslip generation error:', error);
    return NextResponse.json(
      { 
        error: 'Payslip generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { runId } = await params;
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get payslip artifacts for this run
    const artifacts = await prisma.artifact.findMany({
      where: {
        runId,
        type: 'payslip'
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get run information
    const run = await prisma.payrollRun.findUnique({
      where: { id: runId },
      include: {
        createdBy: true,
        payouts: {
          include: {
            contributor: true
          }
        }
      }
    });

    if (!run) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }

    if (run.createdBy.email !== session.user.email) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const payslips = artifacts.map(artifact => {
      // Extract contributor name from filename (format: payslip_ContributorName_timestamp.html)
      const filenameMatch = artifact.filename.match(/payslip_([^_]+)_\d+\.html/);
      const contributorFromFilename = filenameMatch ? filenameMatch[1].replace(/_/g, ' ') : null;
      
      // Try to match with actual payout contributor
      const matchingPayout = run.payouts.find(payout => 
        payout.contributor.githubHandle === contributorFromFilename ||
        payout.contributor.githubHandle?.replace(/\s+/g, '_') === filenameMatch?.[1]
      );

      return {
        id: artifact.id,
        filename: artifact.filename,
        cid: artifact.cid,
        size: artifact.size,
        verified: artifact.verified,
        createdAt: artifact.createdAt,
        success: artifact.verified, // Use verified status as success indicator
        contributorName: matchingPayout?.contributor.githubHandle || contributorFromFilename || 'Unknown Contributor',
        contributorId: matchingPayout?.contributorId,
        payslipId: `PS-${run.runNumber}-${artifact.id.slice(-8)}`,
        ipfsCid: artifact.cid,
        gatewayUrl: `https://gateway.lighthouse.storage/ipfs/${artifact.cid}`,
        downloadUrl: `https://ipfs.io/ipfs/${artifact.cid}`,
        lighthouseUrl: `https://gateway.lighthouse.storage/ipfs/${artifact.cid}`,
        metadata: {
          payslipId: `PS-${run.runNumber}-${artifact.id.slice(-8)}`,
          generatedAt: artifact.createdAt.toISOString(),
          fileSize: artifact.size
        }
      };
    });

    return NextResponse.json({
      success: true,
      runId,
      runNumber: run.runNumber,
      status: run.status,
      payslips,
      count: payslips.length,
      contributors: run.payouts.length,
      generatedPayslips: payslips.length
    });

  } catch (error) {
    console.error('Error fetching payslips:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payslips' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { runId } = await params;
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to this run
    const run = await prisma.payrollRun.findUnique({
      where: { id: runId },
      include: { createdBy: true }
    });

    if (!run) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }

    if (run.createdBy.email !== session.user.email) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Delete payslip artifacts
    const deletedArtifacts = await prisma.artifact.deleteMany({
      where: {
        runId,
        type: 'payslip'
      }
    });

    console.log(`🗑️ Deleted ${deletedArtifacts.count} payslip artifacts for run ${runId}`);

    return NextResponse.json({
      success: true,
      deletedCount: deletedArtifacts.count,
      message: `Deleted all payslips for run ${runId}`
    });

  } catch (error) {
    console.error('Error deleting payslips:', error);
    return NextResponse.json(
      { error: 'Failed to delete payslips' },
      { status: 500 }
    );
  }
}

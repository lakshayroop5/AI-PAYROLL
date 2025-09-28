/**
 * Delete Payroll Run API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // First check if payroll run exists and user owns it
    const payrollRun = await prisma.payrollRun.findUnique({
      where: { id }
    });

    if (!payrollRun) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }

    if (payrollRun.createdById !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized - not your payroll run' }, { status: 403 });
    }

    // Check if payroll has been executed (don't allow deletion of completed runs)
    if (payrollRun.status === 'COMPLETED') {
      return NextResponse.json({ 
        error: 'Cannot delete completed payroll run',
        message: 'Completed payroll runs cannot be deleted for audit purposes'
      }, { status: 400 });
    }

    // Delete related payouts first (cascade delete)
    await prisma.payout.deleteMany({
      where: { runId: id }
    });

    // Delete the payroll run
    await prisma.payrollRun.delete({
      where: { id }
    });

    console.log(`✅ Deleted payroll run ${id} by user ${session.user.email}`);

    return NextResponse.json({
      success: true,
      message: 'Payroll run deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting payroll run:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to delete payroll run',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

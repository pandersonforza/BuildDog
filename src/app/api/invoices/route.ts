import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status');
    const approverId = searchParams.get('approverId');
    const submittedById = searchParams.get('submittedById');
    const returned = searchParams.get('returned');
    const vendorName = searchParams.get('vendorName');
    const lineItemId = searchParams.get('lineItemId');

    const where: Record<string, unknown> = {};

    if (projectId) {
      where.projectId = projectId;
    }
    if (status) {
      where.status = status;
    }
    if (approverId) {
      where.approverId = approverId;
    }
    if (submittedById) {
      where.submittedById = submittedById;
    }
    if (returned === 'true') {
      where.rejectionReason = { not: null };
    }
    if (vendorName) {
      where.vendorName = { equals: vendorName, mode: 'insensitive' };
    }
    if (lineItemId) {
      where.budgetLineItemId = lineItemId;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, address: true, status: true, projectGroup: true } },
        lineItem: {
          include: {
            category: { select: { id: true, name: true, categoryGroup: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(invoices);
  } catch (error) {
    console.error('Failed to fetch invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { vendorName, amount, date, filePath } = body;

    if (!vendorName || amount === undefined || amount === null || !date) {
      return NextResponse.json(
        { error: 'Missing required fields: vendorName, amount, date' },
        { status: 400 }
      );
    }

    if (typeof amount !== 'number' || isNaN(amount)) {
      return NextResponse.json(
        { error: 'Amount must be a valid number' },
        { status: 400 }
      );
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    // Duplicate check — warn if same vendor + invoice number + amount on same project
    if (!body.skipDuplicateCheck) {
      const dupeWhere: Record<string, unknown> = {
        vendorName: { equals: vendorName, mode: 'insensitive' },
        amount,
      };
      if (body.projectId) dupeWhere.projectId = body.projectId;
      if (body.invoiceNumber) dupeWhere.invoiceNumber = body.invoiceNumber;

      const duplicate = await prisma.invoice.findFirst({ where: dupeWhere });
      if (duplicate) {
        return NextResponse.json(
          {
            error: 'duplicate',
            message: `Potential duplicate: an invoice from "${vendorName}" for $${amount.toFixed(2)}${body.invoiceNumber ? ` (#${body.invoiceNumber})` : ''} already exists.`,
            duplicateId: duplicate.id,
          },
          { status: 409 }
        );
      }
    }

    const invoice = await prisma.invoice.create({
      data: {
        vendorName,
        amount,
        date: parsedDate,
        filePath: filePath ?? null,
        invoiceNumber: body.invoiceNumber ?? null,
        description: body.description ?? null,
        status: body.status ?? 'Pending Review',
        projectId: body.projectId ?? null,
        budgetLineItemId: body.budgetLineItemId ?? null,
        aiConfidence: body.aiConfidence ?? null,
        aiNotes: body.aiNotes ?? null,
        approver: body.approver ?? null,
        approverId: body.approverId ?? null,
        submittedBy: body.submittedBy ?? null,
        submittedById: body.submittedById ?? null,
        submittedDate: body.submittedDate ? new Date(body.submittedDate) : null,
      },
      include: {
        project: true,
        lineItem: {
          include: {
            category: true,
          },
        },
      },
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error('Failed to create invoice:', error);
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    );
  }
}

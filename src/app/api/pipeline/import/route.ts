import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export const maxDuration = 30;

const GROUP_SHEET_URLS: Record<string, string> = {
  F7B:   'https://docs.google.com/spreadsheets/d/14ntOeldcbGSU4_vifWsBLH0mFD1PMTqT3S9Fvpg-96c/export?format=csv',
  H7B:   'https://docs.google.com/spreadsheets/d/1AawR7WBYURTPIApFzLVicUbH8IM-47vQLUZkKuSOegw/export?format=csv',
  Forza: 'https://docs.google.com/spreadsheets/d/1oWagUX8kMYu0fCgzavEW-RRPNKlRZUWsLZeFSTB2KNI/export?format=csv',
};

// Standard CSV parser: handles quoted fields containing commas/newlines
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        // Escaped quote
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field);
        field = '';
      } else if (ch === '\n') {
        current.push(field);
        field = '';
        rows.push(current);
        current = [];
      } else if (ch === '\r') {
        // skip \r (handle \r\n as one newline)
      } else {
        field += ch;
      }
    }
  }
  // flush last field/row
  current.push(field);
  if (current.some((f) => f !== '')) {
    rows.push(current);
  }

  if (rows.length === 0) return [];

  const headers = rows[0];

  return rows.slice(1).map((cols) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = (cols[i] ?? '').trim();
    });
    return obj;
  });
}

const COLUMN_MAP: Record<string, string> = {
  'Project ID #': 'projectNumber',
  'Address': 'address',
  'City': 'city',
  'State': 'state',
  'Site Acceptance': 'siteAcceptance',
  'Milestones': 'milestones',
  'Due Dilligence': 'dueDiligence',
  'Deal Type': 'dealType',
  'Civil/Permitting Team': 'civilPermittingTeam',
  'Architect Team': 'architectTeam',
  'As-Builts': 'asBuilts',
  'ALTA/TOPO': 'altaTopo',
  'Geotech': 'geotech',
  'Phase 1 Testing': 'phase1Testing',
  'Asbestos Testing': 'asbestosTesting',
  'Signage Vendor': 'signageVendor',
  'Sign Resource PM': 'signResourcePm',
  'Sent to 7B?': 'sentTo7B',
  'Signage Approved by 7B': 'signageApprovedBy7B',
  'Test Fit Requested': 'testFitRequested',
  'Test Fit Completed': 'testFitCompleted',
  'Test Fit Approved': 'testFitApproved',
  'LOI Executed': 'loiExecuted',
  'Title Received': 'titleReceived',
  'Title Reviewed': 'titleReviewed',
  'SIR': 'sir',
  'Initial Budget': 'initialBudget',
  'Lease Executed': 'leaseExecuted',
  'Rent Commencement Date': 'rentCommencementDate',
  'Power Application Submitted': 'powerApplicationSubmitted',
  'Design Kickoff Call': 'designKickoffCall',
  'Design Docs Approved': 'designDocsApproved',
  'Planning Submittal': 'planningSubmittal',
  "Planning Approved/COA's Received": 'planningApproved',
  'ROW Premits/Acess Points Approved': 'rowPermitsApproved',
  'CD Kickoff Call': 'cdKickoffCall',
  'ISP Intake Form Sent': 'ispIntakeFormSent',
  'CD Submitted to 7B': 'cdSubmittedTo7B',
  '7B Approved': 'approved7B',
  "CD's Submitted": 'cdsSubmitted',
  'Health Submitted': 'healthSubmitted',
  'Out To Bid': 'outToBid',
  'Prebid Meeting': 'prebidMeeting',
  'Bids Due': 'bidsDue',
  'Final Budget Approved': 'finalBudgetApproved',
  'General Contractor': 'generalContractor',
  'GC Contract Issued': 'gcContractIssued',
  'Permitts Issued': 'permitsIssued',
  'Construction Start': 'constructionStart',
  'Turnover/ COO': 'turnoverCoo',
  'Open Date': 'openDate',
  'Planning Approval Process': 'planningApprovalProcess',
  'Building Approval Process': 'buildingApprovalProcess',
  'Development Notes': 'developmentNotes',
};

type PipelineProjectData = {
  projectNumber?: string;
  address: string;
  city: string;
  state?: string;
  siteAcceptance?: string;
  milestones?: string;
  dueDiligence?: string;
  dealType?: string;
  civilPermittingTeam?: string;
  architectTeam?: string;
  asBuilts?: string;
  altaTopo?: string;
  geotech?: string;
  phase1Testing?: string;
  asbestosTesting?: string;
  signageVendor?: string;
  signResourcePm?: string;
  sentTo7B?: string;
  signageApprovedBy7B?: string;
  testFitRequested?: string;
  testFitCompleted?: string;
  testFitApproved?: string;
  loiExecuted?: string;
  titleReceived?: string;
  titleReviewed?: string;
  sir?: string;
  initialBudget?: string;
  leaseExecuted?: string;
  rentCommencementDate?: string;
  powerApplicationSubmitted?: string;
  designKickoffCall?: string;
  designDocsApproved?: string;
  planningSubmittal?: string;
  planningApproved?: string;
  rowPermitsApproved?: string;
  cdKickoffCall?: string;
  ispIntakeFormSent?: string;
  cdSubmittedTo7B?: string;
  approved7B?: string;
  cdsSubmitted?: string;
  healthSubmitted?: string;
  outToBid?: string;
  prebidMeeting?: string;
  bidsDue?: string;
  finalBudgetApproved?: string;
  generalContractor?: string;
  gcContractIssued?: string;
  permitsIssued?: string;
  constructionStart?: string;
  turnoverCoo?: string;
  openDate?: string;
  planningApprovalProcess?: string;
  buildingApprovalProcess?: string;
  developmentNotes?: string;
};

function mapRow(raw: Record<string, string>): PipelineProjectData | null {
  const mapped: Record<string, string> = {};

  for (const [csvCol, fieldName] of Object.entries(COLUMN_MAP)) {
    const val = raw[csvCol];
    if (val !== undefined && val !== '') {
      mapped[fieldName] = val;
    }
  }

  // Skip rows without an address
  if (!mapped['address']) return null;

  return mapped as unknown as PipelineProjectData;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const group: string = body.group ?? 'F7B';

  const csvUrl = GROUP_SHEET_URLS[group];
  if (!csvUrl) {
    return NextResponse.json({ error: `No sheet configured for group: ${group}` }, { status: 400 });
  }

  const res = await fetch(csvUrl);
  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch CSV' }, { status: 502 });
  }

  const text = await res.text();
  const rawRows = parseCsv(text);
  const projects = rawRows
    .map(mapRow)
    .filter((p): p is PipelineProjectData => p !== null)
    .map((p) => ({ ...p, projectGroup: group }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (prisma.pipelineProject.createMany as any)({
    data: projects,
    skipDuplicates: true,
  });

  return NextResponse.json({ imported: result.count });
}

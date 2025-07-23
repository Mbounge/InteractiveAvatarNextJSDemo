//app/api/reports/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/app/lib/mongodb';
import Report from '@/app/models/Report';

/**
 * @method GET
 * @description Fetches a single, complete report by its ID for editing.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params; // The report's unique ID from the URL
  const scoutIdentifier = request.headers.get('X-Scout-Identifier');

  if (!scoutIdentifier) {
    return NextResponse.json({ error: 'Scout identifier is required' }, { status: 401 });
  }

  try {
    await dbConnect();
    // IMPORTANT: We find the report by its ID AND the scout's identifier.
    // This is a critical security check to ensure a scout can only access their own reports.
    const report = await Report.findOne({ _id: id, scoutIdentifier });

    if (!report) {
      return NextResponse.json({ error: 'Report not found or access denied' }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch report' }, { status: 500 });
  }
}

/**
 * @method PUT
 * @description Updates an existing report.
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const scoutIdentifier = request.headers.get('X-Scout-Identifier');

  if (!scoutIdentifier) {
    return NextResponse.json({ error: 'Scout identifier is required' }, { status: 401 });
  }

  try {
    await dbConnect();
    const body = await request.json();
    
    // Security: Don't allow changing the scout identifier on an update
    delete body.scoutIdentifier;

    // Find the report by ID and scout ID, then update it with the new body.
    const updatedReport = await Report.findOneAndUpdate(
      { _id: id, scoutIdentifier },
      body,
      { new: true } // This option tells Mongoose to return the updated document
    );

    if (!updatedReport) {
      return NextResponse.json({ error: 'Report not found or access denied' }, { status: 404 });
    }

    return NextResponse.json(updatedReport);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update report' }, { status: 500 });
  }
}

/**
 * @method DELETE
 * @description Deletes a report by its ID.
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    const { id } = params;
    const scoutIdentifier = request.headers.get('X-Scout-Identifier');
  
    if (!scoutIdentifier) {
      return NextResponse.json({ error: 'Scout identifier is required' }, { status: 401 });
    }
  
    try {
      await dbConnect();
      // Same security check: only allow deleting if the scout owns the report.
      const deletedReport = await Report.findOneAndDelete({ _id: id, scoutIdentifier });
  
      if (!deletedReport) {
        return NextResponse.json({ error: 'Report not found or access denied' }, { status: 404 });
      }
  
      return NextResponse.json({ message: 'Report deleted successfully' });
    } catch (error) {
      return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 });
    }
  }
//app/api/reports/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/app/lib/mongodb';
import Report from '@/app/models/Report';

/**
 * @method GET
 * @description Fetches a list of all reports belonging to a specific scout.
 * The frontend will call this to populate the dashboard.
 */
export async function GET(request: NextRequest) {
  // We get the scout's unique access code from a custom header.
  // This ensures we only fetch reports for the currently logged-in scout.
  const scoutIdentifier = request.headers.get('X-Scout-Identifier');

  if (!scoutIdentifier) {
    return NextResponse.json({ error: 'Scout identifier is required' }, { status: 401 });
  }

  try {
    await dbConnect(); // Connect to the database

    // Find all reports where the 'scoutIdentifier' matches the one from the header.
    const reports = await Report.find({ scoutIdentifier })
      .sort({ updatedAt: -1 }) // Sort by most recently updated
      // --- MODIFIED: Added 'reportType' to the selection ---
      .select('playerContext.name playerContext.currentTeam.name updatedAt reportType'); // Only send back the data needed for the list view to be efficient.

    return NextResponse.json(reports);
  } catch (error) {
    console.error("Failed to fetch reports:", error);
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}

/**
 * @method POST
 * @description Creates a new scouting report in the database.
 * The frontend will call this the first time a user saves a new report.
 */
export async function POST(request: NextRequest) {
  const scoutIdentifier = request.headers.get('X-Scout-Identifier');

  if (!scoutIdentifier) {
    return NextResponse.json({ error: 'Scout identifier is required' }, { status: 401 });
  }

  try {
    await dbConnect(); // Connect to the database
    const body = await request.json(); // Get the report data from the request
    
    // Create a new report document using our Mongoose model
    // The 'reportType' will be included in the 'body' from the frontend
    const newReport = new Report({
      ...body,
      scoutIdentifier, 
    });

    await newReport.save(); // Save the document to the database
    return NextResponse.json(newReport, { status: 201 }); // Return the newly created report with a "Created" status
  } catch (error) {
    console.error("Failed to create report:", error);
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 });
  }
}
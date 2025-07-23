//app/models/Report.ts

import mongoose, { Schema, Document, models, Model } from 'mongoose';

// This is a TypeScript interface. It helps your code know the "shape" of a report object.
export interface IReport extends Document {
  scoutIdentifier: string; // The access code, used to identify the scout
  playerContext: object;
  teamContext: object;
  traitRatings: object;
  originalReportHtml: string;
  translatedReports: object;
  transcriptionText: string;
  seasonalStatsContext: object;
  leagueStandingsContext: object;
  createdAt: Date;
  updatedAt: Date;
}

// This is the actual Mongoose Schema. It defines the rules for the data stored in MongoDB.
const ReportSchema: Schema<IReport> = new Schema({

  scoutIdentifier: { type: String, required: true, index: true },

  playerContext: { type: Object, required: true },
  teamContext: { type: Object, required: false },
  traitRatings: { type: Object, required: true },
  originalReportHtml: { type: String, default: '' },
  translatedReports: { type: Object, default: {} },
  transcriptionText: { type: String, default: '' },
  seasonalStatsContext: { type: Object, default: {} },
  leagueStandingsContext: { type: Object, default: {} },
}, {

  timestamps: true 
});

const Report: Model<IReport> = models.Report || mongoose.model<IReport>('Report', ReportSchema);

export default Report;
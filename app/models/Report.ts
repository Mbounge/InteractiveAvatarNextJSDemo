//app/models/Report.ts

import mongoose, { Schema, Document, models, Model } from 'mongoose';

export interface IReport extends Document {
  scoutIdentifier: string;
  reportType: 'skater' | 'goalie';
  playerContext: object;
  teamContext: object;
  traitRatings: object;
  originalReportHtml: string;
  translatedReports: object;
  transcriptionText: string;
  seasonalStatsContext: object;
  leagueStandingsContext: object;
  gameContext: object;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema: Schema<IReport> = new Schema({

  scoutIdentifier: { type: String, required: true, index: true },

  reportType: { 
    type: String, 
    required: true, 
    enum: ['skater', 'goalie'], 
    default: 'skater' 
  },

  playerContext: { type: Object, required: true },
  teamContext: { type: Object, required: false },
  traitRatings: { type: Object, required: true },
  originalReportHtml: { type: String, default: '' },
  translatedReports: { type: Object, default: {} },
  transcriptionText: { type: String, default: '' },
  seasonalStatsContext: { type: Object, default: {} },
  leagueStandingsContext: { type: Object, default: {} },
  
  gameContext: { 
    type: {
      league: { type: Object },
      teamA: { type: Object },
      teamB: { type: Object },
      teamAScore: { type: String },
      teamBScore: { type: String },
      gameDate: { type: String, default: null }
    }, 
    required: true, 
    default: {} 
  },

}, {

  timestamps: true 
});

const Report: Model<IReport> = models.Report || mongoose.model<IReport>('Report', ReportSchema);

export default Report;
// src/lib/types.ts
export interface Player {
    player_id: string;
    name: string | null;
    age_orig: number | null;
    final_score: number | null; // Keep scores even if not displayed initially
    archetype_similarity: number | null;
    position_orig: string | null;
    nationality_orig: string | null;
    position_group: string | null;
    gender: string | null;
    // Original Season Stats
    season_gamesPlayed_orig: number | null;
    season_goals_orig: number | null;
    season_assists_orig: number | null;
    season_points_orig: number | null;
    season_pointsPerGame_orig: number | null;
    season_gaa_orig: number | null;
    season_svp_orig: number | null;
    season_shutouts_orig: number | null; // Added SO
    // Add other fields returned by API if needed
    // ...
  }
  export type ShortlistData = Record<'G' | 'D' | 'F', Player[]>;
  export type ShortlistsByYear = Record<number, ShortlistData>;
  
  
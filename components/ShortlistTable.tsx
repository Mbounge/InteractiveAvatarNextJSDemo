import React from "react";
import type { Player } from "@/app/lib/types";

interface ShortlistTableProps {
  players: Player[];
  positionGroup: "G" | "D" | "F";
  title: string;
}

interface ColumnDefinition {
    key: keyof Player; // Use keyof Player for better type safety
    header: string;
    shortHeader: string;
    width: string;
    format?: (value: number | string | null | undefined) => string; // Make optional and accept wider types
    align: `text-${'left' | 'center' | 'right'}`; // Use template literal type
  }

// Helper to format numbers, handling null/undefined/NaN
const formatNumber = (
  value: number | null | undefined,
  digits: number = 3
): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  if (!Number.isFinite(value)) {
    return value > 0 ? "∞" : "-∞";
  }
  return value.toFixed(digits);
};

// Helper for integers
const formatInt = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  if (!Number.isFinite(value)) {
    return value > 0 ? "∞" : "-∞";
  }
  return Math.round(value).toString();
};

// Helper for determining player row highlight
const getPositionHighlight = (posGroup: string): string => {
  switch (posGroup) {
    case "G":
      return "hover:bg-blue-50";
    case "D":
      return "hover:bg-green-50";
    case "F":
      return "hover:bg-purple-50";
    default:
      return "hover:bg-indigo-50";
  }
};

export function ShortlistTable({
  players,
  positionGroup,
  title,
}: ShortlistTableProps) {
  if (!players || players.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-lg text-gray-400 font-medium">
          No players found for this selection.
        </p>
      </div>
    );
  }

  //console.log(players);

  // Define the hover color based on position group
  const rowHighlight = getPositionHighlight(positionGroup);

  // Define Columns with fixed widths
  const baseCols = [
    {
      key: "name",
      header: "Name",
      shortHeader: "Name",
      width: "w-36",
      align: "text-left",
    },
    {
      key: "age_orig",
      header: "Age",
      shortHeader: "Age",
      width: "w-12",
      format: formatInt,
      align: "text-center",
    },
    {
      key: "nationality_orig",
      header: "Nat",
      shortHeader: "Nat",
      width: "w-12",
      align: "text-center",
    },
    {
      key: "position_group",
      header: "Pos",
      shortHeader: "Pos",
      width: "w-12",
      align: "text-center",
    },
    {
      key: "season_gamesPlayed_orig",
      header: "GP",
      shortHeader: "GP",
      width: "w-12",
      format: formatInt,
      align: "text-center",
    },
  ];

  const skaterCols = [
    ...baseCols,
    {
      key: "season_goals_orig",
      header: "G",
      shortHeader: "G",
      width: "w-12",
      format: formatInt,
      align: "text-center",
    },
    {
      key: "season_assists_orig",
      header: "A",
      shortHeader: "A",
      width: "w-12",
      format: formatInt,
      align: "text-center",
    },
    {
      key: "season_points_orig",
      header: "TP",
      shortHeader: "TP",
      width: "w-12",
      format: formatInt,
      align: "text-center",
    },
    {
      key: "season_pointsPerGame_orig",
      header: "PPG",
      shortHeader: "PPG",
      width: "w-16",
      format: (v: number) => formatNumber(v, 2),
      align: "text-center",
    },
  ];

  const goalieCols = [
    ...baseCols,
    {
      key: "season_gaa_orig",
      header: "GAA",
      shortHeader: "GAA",
      width: "w-16",
      format: (v: number) => formatNumber(v, 2),
      align: "text-center",
    },
    {
      key: "season_svp_orig",
      header: "SV%",
      shortHeader: "SV%",
      width: "w-16",
      format: (v: number) => formatNumber(v, 3),
      align: "text-center",
    },
    {
      key: "season_shutouts_orig",
      header: "SO",
      shortHeader: "SO",
      width: "w-12",
      format: formatInt,
      align: "text-center",
    },
  ];

  const columns = positionGroup === "G" ? goalieCols : skaterCols;

  return (
    <div className="w-full">
      <table className="w-full table-fixed divide-y divide-gray-200">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-2 py-3 w-16 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Rank
            </th>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`px-2 py-3 ${col.width} ${col.align} text-xs font-semibold text-gray-500 uppercase tracking-wider`}
              >
                {col.shortHeader}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {players.map((p, i) => (
            <tr
              key={p.player_id}
              className={`${rowHighlight} transition-colors duration-150`}
            >
              {/* Rank */}
              <td className="px-2 py-3 text-center">
                <div className="flex justify-center">
                  <span
                    className={`
                    inline-flex w-8 h-8 rounded-full items-center justify-center text-sm font-semibold
                    ${
                      i < 3
                        ? "bg-[#0e0c66] text-white shadow-sm"
                        : "bg-gray-100 text-gray-600"
                    }
                  `}
                  >
                    {i + 1}
                  </span>
                </div>
              </td>
              {/* Data Columns */}
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-2 py-3 ${col.width} ${
                    col.align
                  } whitespace-nowrap text-sm ${
                    col.key === "name"
                      ? "text-gray-900 font-medium truncate"
                      : "text-gray-600 tabular-nums"
                  }`}
                  title={
                    col.key === "name"
                      ? (p[col.key as keyof Player] as string) || ""
                      : undefined
                  }
                >
                  {col.format
                    ? // @ts-ignore
                      col.format(p[col.key as keyof Player] as number | null)
                    : // Handle non-formatted values (could be string, number, or null)
                      p[col.key as keyof Player] ?? "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Stats Summary Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
        Showing {players.length}{" "}
        {positionGroup === "G"
          ? "goalies"
          : positionGroup === "D"
          ? "defenders"
          : "forwards"}
      </div>
    </div>
  );
}

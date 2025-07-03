// ScoutingPlatform.tsx

"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Editor,
  EditorContent,
  BubbleMenu,
  ChainedCommands,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import Link from "@tiptap/extension-link";
import { marked } from "marked";
import { Toaster, toast } from "react-hot-toast";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { Extension, InputRule } from "@tiptap/core";
import { Heading, Level } from "@tiptap/extension-heading";
import { CellSelection } from "prosemirror-tables";
import {
  Upload,
  Sparkles,
  Bold,
  Italic,
  List,
  ListOrdered,
  Save,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo,
  Redo,
  Code,
  Table as TableIcon,
  Trash2,
  Plus,
  Minus,
  Merge,
  Split,
  ChevronDown,
  Menu,
  X,
  FileDown,
  FileText,
  PanelLeftClose,
  PanelRightClose,
  Languages,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import Image from "next/image";
import logo2 from "../public/Graet_Logo.svg"

// --- HELPER HOOK & FUNCTIONS ---

const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    window.addEventListener("resize", listener);
    return () => window.removeEventListener("resize", listener);
  }, [matches, query]);

  return matches;
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

const getErrorMessage = async (response: Response): Promise<string> => {
  const clonedResponse = response.clone();
  try {
    const errorJson = await clonedResponse.json();
    return errorJson.error?.message || JSON.stringify(errorJson);
  } catch (e) {
    return await response.text() || `HTTP error! Status: ${response.status}`;
  }
};

const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
};

const Spinner: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={`animate-spin h-5 w-5 text-[#0e0c66] ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    ></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    ></path>
  </svg>
);

// --- TYPE DEFINITIONS ---
type Stats = {
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  pointsPerGame: number;
  gaa: number;
  shutouts: number;
  svp: number;
  wins: number;
  losses: number;
  ties: number;
};

type Player = {
  id: string;
  slug: string;
  role: string;
  firstname: string;
  lastname: string;
  name: string;
  country: string;
  dateOfBirth: string;
  possibleYearsOfBirth: number[];
  bio: {
    position: string;
    gender: string;
    playerType: string;
    handedness: string;
    height: { centimeters: number; inches: number };
    weight: { kilograms: number; pounds: number };
  } | null;
  currentTeam: {
    id: string;
    name: string;
    country: string;
    shortName: string;
    hasGames: boolean;
    leagues: { id: string; name: string }[];
  } | null;
  stats: {
    career: Stats;
    season: Stats;
  };
};

type PlayerSearchResult = {
  node: Player;
};

type Team = {
  id: string;
  name: string;
  shortName: string;
  country: string;
  slug: string;
  leagues: {
    id: string;
    name: string;
  }[];
};

type TeamSearchResult = {
  node: Team;
};

type Standing = {
  id: string;
  team: {
    id: string;
    name: string;
  };
};

type LeagueStandingsResponse = {
  league: {
    id: string;
    name: string;
  };
  groups: {
    group: string;
    standings: Standing[];
  }[];
};

type SeasonalStat = {
  node: {
    team: { name: string; shortName: string };
    user: { name: string; id: string };
    position: string;
    season: string;
    seasonType: string;
    gamesPlayed: number;
    goals: number;
    assists: number;
    points: number;
    plusMinus: number;
    pim: number;
    wins: number;
    losses: number;
    ties: number;
    gaa: number;
    svp: number;
    shutouts: number;
    toi: number;
  }
};

type TraitRatings = {
  skating: number;
  puckSkills: number;
  hockeyIq: number;
  shot: number;
  competeLevel: number;
  defensiveGame: number;
};


// --- TIPTAP CONFIGURATION ---
const PREDEFINED_SIZES: { [key: string]: string } = {
  p: "12pt",
  h1: "24pt",
  h2: "18pt",
  h3: "16pt",
};
type FontSizeOptions = { types: string[] };
const editorExtensions = [
  StarterKit.configure({ heading: false, blockquote: false }),
  Heading.configure({ levels: [1, 2, 3] }).extend({
    addInputRules() {
      return this.options.levels.map((level: Level) => {
        return new InputRule({
          find: new RegExp(`^(#{1,${level}})\\s$`),
          handler: ({ state, range }) => {
            const { tr } = state;
            const size = PREDEFINED_SIZES[`h${level}`];
            tr.delete(range.from, range.to).setBlockType(
              range.from,
              range.from,
              this.type,
              { level }
            );
            if (size) {
              tr.addStoredMark(
                state.schema.marks.textStyle.create({ fontSize: size })
              );
            }
          },
        });
      });
    },
  }),
  Underline,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  TextStyle,
  Extension.create<FontSizeOptions>({
    name: "fontSize",
    addOptions() {
      return { types: ["textStyle"] };
    },
    addGlobalAttributes() {
      return [
        {
          types: this.options.types,
          attributes: {
            fontSize: {
              default: null,
              parseHTML: (e) => e.style.fontSize.replace(/['"]+/g, ""),
              renderHTML: (attrs) =>
                attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
            },
          },
        },
      ];
    },
    //@ts-ignore
    addCommands() {
      return {
        setFontSize:
          (size: string) =>
          ({ chain }: { chain: ChainedCommands }) => {
            //@ts-ignore
            return chain().setMark("textStyle", { fontSize: size }).run();
          },
        unsetFontSize:
          () =>
          ({ chain }: { chain: ChainedCommands }) => {
            //@ts-ignore
            return chain()
              .setMark("textStyle", { fontSize: null })
              .removeEmptyTextStyle()
              .run();
          },
      };
    },
  }),
  Link.configure({ openOnClick: false, autolink: true }),
  Extension.create({
    name: "resetMarksOnEnter",
    addKeyboardShortcuts() {
      return {
        Enter: () =>
          this.editor.isActive("heading")
            ? this.editor.commands.splitBlock({ keepMarks: false })
            : false,
      };
    },
  }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
];

// --- HELPER COMPONENTS ---
const formatPosition = (rawPosition: string | null | undefined): string => {
  if (!rawPosition) {
    return 'N/A';
  }
  switch (rawPosition) {
    case 'CENTER':
      return 'Center';
    case 'LEFT_WING':
      return 'LW';
    case 'RIGHT_WING':
      return 'RW';
    case 'LEFT_DEFENSIVE':
      return 'LD';
    case 'RIGHT_DEFENSIVE':
      return 'RD';
    case 'DEFENDER':
      return 'D';
    case 'GOALTENDER':
      return 'Goalie';
    default:
      return rawPosition;
  }
};

type ToolbarButtonProps = {
  onClick: () => void;
  title: string;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
};
const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  onClick,
  title,
  isActive,
  disabled,
  children,
}) => (
  <button
    onClick={onClick}
    title={title}
    disabled={disabled}
    className={`p-2 rounded-md transition-colors ${isActive ? "bg-gray-300" : "hover:bg-gray-200"} disabled:opacity-40 disabled:cursor-not-allowed`}
  >
    {children}
  </button>
);
type DropdownOption = { label: string; value: string };
type CustomDropdownProps = {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  title: string;
};
const CustomDropdown: React.FC<CustomDropdownProps> = React.memo(
  ({ options, value, onChange, title }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const selectedLabel =
      options.find((opt) => opt.value === value)?.label || value;
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
        }
      };
      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
      }
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isOpen]);
    return (
      <div ref={dropdownRef} className="relative" title={title}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between w-32 p-2 border border-gray-300 bg-white rounded-md text-sm hover:bg-gray-50"
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className="w-4 h-4 ml-2 text-gray-500" />
        </button>
        {isOpen && (
          <div className="absolute z-20 top-full mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left p-2 text-sm hover:bg-gray-100 ${value === option.value ? "font-bold bg-gray-100" : ""}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);
CustomDropdown.displayName = "CustomDropdown";
const TableCreationGrid: React.FC<{ editor: Editor; close: () => void }> = ({
  editor,
  close,
}) => {
  const [hovered, setHovered] = useState({ rows: 0, cols: 0 });
  const createTable = (rows: number, cols: number) => {
    editor
      .chain()
      .focus()
      .insertTable({ rows, cols, withHeaderRow: true })
      .run();
    close();
  };
  return (
    <div className="absolute z-10 bg-white shadow-lg border rounded-md p-2 mt-1">
      {Array.from({ length: 5 }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex">
          {Array.from({ length: 5 }).map((_, colIndex) => (
            <div
              key={colIndex}
              onMouseOver={() =>
                setHovered({ rows: rowIndex + 1, cols: colIndex + 1 })
              }
              onClick={() => createTable(rowIndex + 1, colIndex + 1)}
              className={`w-6 h-6 border border-gray-300 cursor-pointer ${rowIndex < hovered.rows && colIndex < hovered.cols ? "bg-blue-300" : "bg-white"}`}
            />
          ))}
        </div>
      ))}
      <div className="text-center text-sm mt-1">
        {hovered.rows} x {hovered.cols}
      </div>
    </div>
  );
};
const TableMenus: React.FC<{ editor: Editor }> = ({ editor }) => {
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  type MenuItemProps = {
    onClick: () => void;
    disabled?: boolean;
    children: React.ReactNode;
  };
  const MenuItem: React.FC<MenuItemProps> = ({
    onClick,
    disabled,
    children,
  }) => (
    <button
      onClick={() => {
        onClick();
        setDropdownOpen(false);
      }}
      disabled={disabled}
      className="flex items-center w-full text-left p-2 text-sm rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);
  return (
    <>
      <BubbleMenu
        pluginKey="tableMain"
        editor={editor}
        shouldShow={({ editor }) =>
          editor.isActive("table") &&
          !(editor.state.selection instanceof CellSelection)
        }
        tippyOptions={{
          getReferenceClientRect: () => {
            const { view } = editor;
            const { $anchor } = editor.state.selection;
            const node = view.domAtPos($anchor.pos).node;

            const element = (node.nodeType === Node.TEXT_NODE ? node.parentElement : node) as HTMLElement | null;

            if (!element) {
              return new DOMRect(0, 0, 0, 0);
            }
            
            const tableElement = element.closest("table");
            if (!tableElement) {
              return new DOMRect(0, 0, 0, 0);
            }
            return tableElement.getBoundingClientRect();
          },
          placement: "top-start",
          offset: [0, 8],
        }}
      >
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setDropdownOpen(!isDropdownOpen)}
            className="bg-white text-gray-700 p-1.5 rounded-md shadow-md border border-gray-300 hover:bg-gray-100"
            title="Table options"
          >
            <TableIcon className="w-4 h-4" />
          </button>
          {isDropdownOpen && (
            <div className="absolute z-10 top-full mt-2 bg-white text-black p-2 rounded-lg shadow-xl border border-gray-200 w-max">
              <div className="flex divide-x divide-gray-200">
                <div className="px-3 py-1">
                  <div className="font-bold text-xs uppercase text-gray-500 pb-2">
                    Row
                  </div>
                  <MenuItem
                    onClick={() => editor.chain().focus().addRowBefore().run()}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Above
                  </MenuItem>
                  <MenuItem
                    onClick={() => editor.chain().focus().addRowAfter().run()}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Below
                  </MenuItem>
                  <MenuItem
                    onClick={() => editor.chain().focus().deleteRow().run()}
                  >
                    <Minus className="w-4 h-4 mr-2" /> Delete Row
                  </MenuItem>
                </div>
                <div className="px-3 py-1">
                  <div className="font-bold text-xs uppercase text-gray-500 pb-2">
                    Column
                  </div>
                  <MenuItem
                    onClick={() =>
                      editor.chain().focus().addColumnBefore().run()
                    }
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Left
                  </MenuItem>
                  <MenuItem
                    onClick={() =>
                      editor.chain().focus().addColumnAfter().run()
                    }
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Right
                  </MenuItem>
                  <MenuItem
                    onClick={() => editor.chain().focus().deleteColumn().run()}
                  >
                    <Minus className="w-4 h-4 mr-2" /> Delete Column
                  </MenuItem>
                </div>
              </div>
              <hr className="my-2" />
              <div className="px-1">
                <MenuItem
                  onClick={() => editor.chain().focus().deleteTable().run()}
                >
                  <Trash2 className="w-4 h-4 mr-2 text-red-500" />
                  <span className="text-red-500">Delete Table</span>
                </MenuItem>
              </div>
            </div>
          )}
        </div>
      </BubbleMenu>
      <BubbleMenu
        pluginKey="tableCellSelection"
        editor={editor}
        shouldShow={({ editor }) =>
          editor.state.selection instanceof CellSelection
        }
        tippyOptions={{ placement: "top" }}
        className="flex items-center space-x-1 bg-black text-white p-2 rounded-lg shadow-xl"
      >
        <button
          onClick={() => editor.chain().focus().mergeCells().run()}
          disabled={!editor.can().mergeCells()}
          className="p-1 rounded hover:bg-gray-700 disabled:opacity-40"
          title="Merge cells"
        >
          <Merge className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().splitCell().run()}
          disabled={!editor.can().splitCell()}
          className="p-1 rounded hover:bg-gray-700 disabled:opacity-40"
          title="Split cell"
        >
          <Split className="w-4 h-4" />
        </button>
      </BubbleMenu>
    </>
  );
};

const PlayerSearch: React.FC<{
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchResults: PlayerSearchResult[];
  isSearching: boolean;
  selectedPlayer: Player | null;
  onSelectPlayer: (player: Player) => void;
  onClearPlayer: () => void;
}> = ({
  searchQuery,
  onSearchChange,
  searchResults,
  isSearching,
  selectedPlayer,
  onSelectPlayer,
  onClearPlayer,
}) => {
  const searchResultsRef = useRef<HTMLDivElement>(null);
  const [isResultsOpen, setIsResultsOpen] = useState(false);

  useEffect(() => {
    if (searchResults.length > 0) {
      setIsResultsOpen(true);
    } else {
      setIsResultsOpen(false);
    }
  }, [searchResults]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchResultsRef.current && !searchResultsRef.current.contains(event.target as Node)) {
        setIsResultsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  if (selectedPlayer) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Selected Player
        </h2>
        <div className="flex items-center justify-between p-3 border rounded-lg bg-green-50 border-green-200">
          <div className="flex flex-col">
            <span className="font-bold text-gray-800">{selectedPlayer.name}</span>
            <span className="text-sm text-gray-600">{formatPosition(selectedPlayer.bio?.position)} - {selectedPlayer.currentTeam?.name || 'No Team'}</span>
          </div>
          <button
            onClick={onClearPlayer}
            className="text-sm font-semibold text-blue-600 hover:text-blue-800"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-3">
        Select Player
      </h2>
      <div className="relative" ref={searchResultsRef}>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search for a player..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0e0c66] ml-1"
          />
          {isSearching && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Spinner /></div>}
        </div>
        {isResultsOpen && searchResults.length > 0 && (
          <div className="absolute top-full mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 z-10 max-h-60 overflow-y-auto">
            {searchResults.map(({ node: player }) => (
              <button
                key={player.id}
                onClick={() => onSelectPlayer(player)}
                className="w-full text-left p-3 hover:bg-gray-100 transition-colors flex justify-between items-center"
              >
                <div>
                  <p className="font-medium text-gray-800">{player.name}</p>
                  <p className="text-sm text-gray-500">{formatPosition(player.bio?.position)} - {player.currentTeam?.name || 'No Team'}</p>
                </div>
                <span className="text-xs text-gray-400">{player.country}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const TeamSearch: React.FC<{
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchResults: TeamSearchResult[];
  isSearching: boolean;
  selectedTeam: Team | null;
  onSelectTeam: (team: Team) => void;
  onClearTeam: () => void;
}> = ({
  searchQuery,
  onSearchChange,
  searchResults,
  isSearching,
  selectedTeam,
  onSelectTeam,
  onClearTeam,
}) => {
  const searchResultsRef = useRef<HTMLDivElement>(null);
  const [isResultsOpen, setIsResultsOpen] = useState(false);

  useEffect(() => {
    if (searchResults.length > 0) {
      setIsResultsOpen(true);
    } else {
      setIsResultsOpen(false);
    }
  }, [searchResults]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchResultsRef.current && !searchResultsRef.current.contains(event.target as Node)) {
        setIsResultsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (selectedTeam) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Selected Team
        </h2>
        <div className="flex items-center justify-between p-3 border rounded-lg bg-green-50 border-green-200">
          <div className="flex flex-col">
            <span className="font-bold text-gray-800">{selectedTeam.name}</span>
            <span className="text-sm text-gray-600">{selectedTeam.leagues?.[0]?.name || 'No League'} - {selectedTeam.country}</span>
          </div>
          <button
            onClick={onClearTeam}
            className="text-sm font-semibold text-blue-600 hover:text-blue-800"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-3">
        Select Team
      </h2>
      <div className="relative" ref={searchResultsRef}>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search for a team..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0e0c66] ml-1"
          />
          {isSearching && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Spinner /></div>}
        </div>
        {isResultsOpen && searchResults.length > 0 && (
          <div className="absolute top-full mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 z-10 max-h-60 overflow-y-auto">
            {searchResults.map(({ node: team }) => (
              <button
                key={team.id}
                onClick={() => onSelectTeam(team)}
                className="w-full text-left p-3 hover:bg-gray-100 transition-colors flex justify-between items-center"
              >
                <div>
                  <p className="font-medium text-gray-800">{team.name}</p>
                  <p className="text-sm text-gray-500">{team.leagues?.[0]?.name || 'No League'}</p>
                </div>
                <span className="text-xs text-gray-400">{team.country}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const LanguageToggle: React.FC<{
  isEnglishReport: boolean;
  setIsEnglishReport: (isEnglish: boolean) => void;
  playerLanguage: string | null;
  isTranslating: boolean;
}> = ({ isEnglishReport, setIsEnglishReport, playerLanguage, isTranslating }) => {
  if (!playerLanguage && !isTranslating) {
    return null;
  }

  const getLanguageAbbreviation = (lang: string | null) => {
    if (!lang) return "";
    const abbreviations: { [key: string]: string } = {
      "Swedish": "SE",
      "Finnish": "FI",
      "Czech": "CZ",
      "Slovak": "SK",
      "Russian": "RU",
      "German": "DE",
      "Georgian": "GE",
      "French": "FR"
    };
    return abbreviations[lang] || lang.substring(0, 2).toUpperCase();
  };

  const otherLangAbbr = getLanguageAbbreviation(playerLanguage);

  return (
    <div className="flex items-center space-x-1 bg-gray-200 rounded-lg p-1">
      <button 
        onClick={() => setIsEnglishReport(true)}
        title="Switch to English"
        className={`w-10 h-7 flex items-center justify-center text-xs font-bold rounded-md transition-colors ${
          isEnglishReport ? 'bg-white text-gray-800 shadow-sm' : 'bg-transparent text-gray-500 hover:text-gray-700'
        }`}
      >
        EN
      </button>
      
      <button 
        onClick={() => setIsEnglishReport(false)}
        title={`Switch to ${playerLanguage || 'Translated'}`}
        className={`w-10 h-7 flex items-center justify-center text-xs font-bold rounded-md transition-colors ${
          !isEnglishReport ? 'bg-white text-gray-800 shadow-sm' : 'bg-transparent text-gray-500 hover:text-gray-700'
        }`}
      >
        {isTranslating ? <Spinner className="w-4 h-4" /> : otherLangAbbr}
      </button>
    </div>
  );
};

const StarIcon: React.FC<{
  fillType: 'full' | 'half' | 'empty';
  className?: string;
}> = ({ fillType, className = 'w-6 h-6' }) => {
  const starPath = "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";
  const uniqueId = `grad-${Math.random().toString(36).substr(2, 9)}`;

  if (fillType === 'full') {
    return (
      <svg className={`${className} text-blue-600`} fill="currentColor" viewBox="0 0 24 24">
        <path d={starPath} />
      </svg>
    );
  }

  if (fillType === 'half') {
    return (
      <svg className={`${className} text-blue-600`} fill={`url(#${uniqueId})`} viewBox="0 0 24 24">
        <defs>
          <linearGradient id={uniqueId}>
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="#d1d5db" stopOpacity="1" />
          </linearGradient>
        </defs>
        <path d={starPath} />
      </svg>
    );
  }

  return (
    <svg className={`${className} text-gray-300`} fill="currentColor" viewBox="0 0 24 24">
      <path d={starPath} />
    </svg>
  );
};

const RatingScaleLegend: React.FC = () => (
  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg mb-4">
    <h3 className="text-sm font-semibold text-gray-800 mb-3">Rating Scale</h3>
    <div className="grid grid-cols-1 gap-3 text-xs text-gray-600">
      <div className="flex items-start space-x-2">
        <div className="flex pt-0.5">
          {[...Array(5)].map((_, i) => <StarIcon key={i} fillType="full" className="w-3 h-3" />)}
        </div>
        <div><span className="font-bold text-gray-700">Elite:</span> Exceptional at this skill, comparable to top-tier players in their age group or level.</div>
      </div>
      <div className="flex items-start space-x-2">
        <div className="flex pt-0.5">
          {[...Array(4)].map((_, i) => <StarIcon key={i} fillType="full" className="w-3 h-3" />)}
          <StarIcon fillType="empty" className="w-3 h-3" />
        </div>
        <div><span className="font-bold text-gray-700">Strong:</span> Above average; consistently effective in high-level play.</div>
      </div>
      <div className="flex items-start space-x-2">
        <div className="flex pt-0.5">
          {[...Array(3)].map((_, i) => <StarIcon key={i} fillType="full" className="w-3 h-3" />)}
          {[...Array(2)].map((_, i) => <StarIcon key={i} fillType="empty" className="w-3 h-3" />)}
        </div>
        <div><span className="font-bold text-gray-700">Solid:</span> Adequate for current level; can still be developed further.</div>
      </div>
      <div className="flex items-start space-x-2">
        <div className="flex pt-0.5">
          {[...Array(2)].map((_, i) => <StarIcon key={i} fillType="full" className="w-3 h-3" />)}
          {[...Array(3)].map((_, i) => <StarIcon key={i} fillType="empty" className="w-3 h-3" />)}
        </div>
        <div><span className="font-bold text-gray-700">Developing:</span> Some signs of potential, but inconsistency or technical flaws are present.</div>
      </div>
      <div className="flex items-start space-x-2">
        <div className="flex pt-0.5">
          <StarIcon fillType="full" className="w-3 h-3" />
          {[...Array(4)].map((_, i) => <StarIcon key={i} fillType="empty" className="w-3 h-3" />)}
        </div>
        <div><span className="font-bold text-gray-700">Needs Improvement:</span> Below standard; requires focused development or training.</div>
      </div>
    </div>
  </div>
);

const TraitRatingSelector: React.FC<{
  title: string;
  rating: number;
  onRatingChange: (newRating: number) => void;
}> = ({ title, rating, onRatingChange }) => {
  const [hoverRating, setHoverRating] = useState(0);

  const calculateRatingFromEvent = (e: React.MouseEvent<HTMLDivElement>, starIndex: number) => {
    const starElement = e.currentTarget;
    const { left, width } = starElement.getBoundingClientRect();
    const x = e.clientX - left;
    const percentageInStar = x / width;
    
    const newRating = starIndex + (percentageInStar < 0.5 ? 0.5 : 1.0);
    return newRating;
  };

  const displayRating = hoverRating > 0 ? hoverRating : rating;

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <p className="text-sm font-medium text-gray-800">{title}</p>
        <p className="text-sm font-bold text-blue-600 w-8 text-right">{displayRating.toFixed(1)}</p>
      </div>
      <div className="flex" onMouseLeave={() => setHoverRating(0)}>
        {[...Array(5)].map((_, i) => {
          const starValue = i + 1;
          let fillType: 'full' | 'half' | 'empty' = 'empty';
          if (displayRating >= starValue) {
            fillType = 'full';
          } else if (displayRating > i && displayRating < starValue) {
            fillType = 'half';
          }
          return (
            <div
              key={i}
              className="cursor-pointer"
              onMouseMove={(e) => setHoverRating(calculateRatingFromEvent(e, i))}
              onClick={(e) => onRatingChange(calculateRatingFromEvent(e, i))}
            >
              <StarIcon fillType={fillType} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const useToolbarState = (editor: Editor | null) => {
  const [state, setState] = useState({
    currentStyle: "p",
    currentFontSize: "12pt",
    isBold: false,
    isItalic: false,
    isUnderline: false,
    textAlign: "left",
    isBulletList: false,
    isOrderedList: false,
    isCodeBlock: false,
    canUndo: false,
    canRedo: false,
  });
  useEffect(() => {
    if (!editor) return;
    const updateState = () => {
      const newStyle = editor.isActive("heading", { level: 1 })
        ? "h1"
        : editor.isActive("heading", { level: 2 })
          ? "h2"
          : editor.isActive("heading", { level: 3 })
            ? "h3"
            : "p";
      setState({
        currentStyle: newStyle,
        currentFontSize:
          editor.getAttributes("textStyle").fontSize ||
          PREDEFINED_SIZES[newStyle],
        isBold: editor.isActive("bold"),
        isItalic: editor.isActive("italic"),
        isUnderline: editor.isActive("underline"),
        textAlign: editor.isActive({ textAlign: "center" })
          ? "center"
          : editor.isActive({ textAlign: "right" })
            ? "right"
            : editor.isActive({ textAlign: "justify" })
              ? "justify"
              : "left",
        isBulletList: editor.isActive("bulletList"),
        isOrderedList: editor.isActive("orderedList"),
        isCodeBlock: editor.isActive("codeBlock"),
        canUndo: editor.can().undo(),
        canRedo: editor.can().redo(),
      });
    };
    editor.on("transaction", updateState);
    editor.on("selectionUpdate", updateState);
    updateState();
    return () => {
      editor.off("transaction", updateState);
      editor.off("selectionUpdate", updateState);
    };
  }, [editor]);
  return state;
};

const EditorToolbar: React.FC<{
  editor: Editor | null;
  isMobileSidebarOpen: boolean;
  isDesktopSidebarCollapsed: boolean;
  onToggleMobileSidebar: () => void;
  onToggleDesktopSidebar: () => void;
  isEnglishReport: boolean;
  setIsEnglishReport: (isEnglish: boolean) => void;
  playerLanguage: string | null;
  isTranslating: boolean;
}> = ({
  editor,
  isMobileSidebarOpen,
  isDesktopSidebarCollapsed,
  onToggleMobileSidebar,
  onToggleDesktopSidebar,
  isEnglishReport,
  setIsEnglishReport,
  playerLanguage,
  isTranslating,
}) => {
  const [isTableDropdownOpen, setTableDropdownOpen] = useState(false);
  const tableMenuRef = useRef<HTMLDivElement>(null);
  const toolbarState = useToolbarState(editor);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tableMenuRef.current &&
        !tableMenuRef.current.contains(event.target as Node)
      ) {
        setTableDropdownOpen(false);
      }
    };
    if (isTableDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isTableDropdownOpen]);

  const handleStyleChange = useCallback(
    (style: string) => {
      if (!editor) return;
      const defaultSize = PREDEFINED_SIZES[style];
      const chain = editor.chain().focus();
      if (style === "p") {
        chain.setParagraph();
      } else {
        chain.setHeading({
          level: parseInt(style.replace("h", ""), 10) as 1 | 2 | 3,
        });
      }
      //@ts-ignore
      chain.setFontSize(defaultSize).run();
    },
    [editor]
  );

  const handleFontSizeChange = useCallback(
    (size: string) => {
      if (!editor) return;
      //@ts-ignore
      editor.chain().focus().setFontSize(size).run();
    },
    [editor]
  );

  if (!editor) return null;

  const styleOptions: DropdownOption[] = [
    { label: "Paragraph", value: "p" },
    { label: "Heading 1", value: "h1" },
    { label: "Heading 2", value: "h2" },
    { label: "Heading 3", value: "h3" },
  ];
  const fontSizeOptions: DropdownOption[] = [
    { label: "10pt", value: "10pt" },
    { label: "12pt", value: "12pt" },
    { label: "14pt", value: "14pt" },
    { label: "16pt", value: "16pt" },
    { label: "18pt", value: "18pt" },
    { label: "24pt", value: "24pt" },
    { label: "30pt", value: "30pt" },
  ];

  const handleToggleClick = () => {
    if (isDesktop) {
      onToggleDesktopSidebar();
    } else {
      onToggleMobileSidebar();
    }
  };

  return (
    <div className="flex-shrink-0 bg-white border-b border-gray-200 p-2 flex items-center justify-between space-x-2">
      <div className="flex items-center space-x-1">
        <ToolbarButton onClick={handleToggleClick} title="Toggle Sidebar">
          {isDesktop ? (
            isDesktopSidebarCollapsed ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )
          ) : isMobileSidebarOpen ? (
            <X className="w-4 h-4" />
          ) : (
            <Menu className="w-4 h-4" />
          )}
        </ToolbarButton>
      </div>
      
      <div className="flex items-center space-x-1 flex-wrap justify-end">
        <div className="flex items-center space-x-1 border-l border-gray-300 pl-2 ml-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!toolbarState.canUndo}
            title="Undo"
          >
            <Undo className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!toolbarState.canRedo}
            title="Redo"
          >
            <Redo className="w-4 h-4" />
          </ToolbarButton>
        </div>
        <div className="flex items-center space-x-2 border-l border-gray-300 pl-2 ml-2">
          <CustomDropdown
            options={styleOptions}
            value={toolbarState.currentStyle}
            onChange={handleStyleChange}
            title="Text Style"
          />
          <CustomDropdown
            options={fontSizeOptions}
            value={toolbarState.currentFontSize}
            onChange={handleFontSizeChange}
            title="Font Size"
          />
        </div>
        <div className="flex items-center space-x-1 border-l border-gray-300 pl-2 ml-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={toolbarState.isBold}
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={toolbarState.isItalic}
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={toolbarState.isUnderline}
            title="Underline"
          >
            <UnderlineIcon className="w-4 h-4" />
          </ToolbarButton>
        </div>
        <div className="flex items-center space-x-1 border-l border-gray-300 pl-2 ml-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            isActive={toolbarState.textAlign === "left"}
            title="Align Left"
          >
            <AlignLeft className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            isActive={toolbarState.textAlign === "center"}
            title="Align Center"
          >
            <AlignCenter className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            isActive={toolbarState.textAlign === "right"}
            title="Align Right"
          >
            <AlignRight className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
            isActive={toolbarState.textAlign === "justify"}
            title="Justify"
          >
            <AlignJustify className="w-4 h-4" />
          </ToolbarButton>
        </div>
        <div className="flex items-center space-x-1 border-l border-gray-300 pl-2 ml-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={toolbarState.isBulletList}
            title="Bulleted List"
          >
            <List className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={toolbarState.isOrderedList}
            title="Numbered List"
          >
            <ListOrdered className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            isActive={toolbarState.isCodeBlock}
            title="Code Block"
          >
            <Code className="w-4 h-4" />
          </ToolbarButton>
          <div ref={tableMenuRef} className="relative">
            <ToolbarButton
              onClick={() => setTableDropdownOpen(!isTableDropdownOpen)}
              title="Insert Table"
            >
              <TableIcon className="w-4 h-4" />
            </ToolbarButton>
            {isTableDropdownOpen && (
              <TableCreationGrid
                editor={editor}
                close={() => setTableDropdownOpen(false)}
              />
            )}
          </div>
        </div>
        <div className="flex items-center space-x-1 border-l border-gray-300 pl-2 ml-2">
          <LanguageToggle 
            isEnglishReport={isEnglishReport}
            setIsEnglishReport={setIsEnglishReport}
            playerLanguage={playerLanguage}
            isTranslating={isTranslating}
          />
        </div>
      </div>
    </div>
  );
};

const EditorPlaceholder = ({ onStart }: { onStart: () => void }) => (
  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center bg-gray-50 bg-opacity-80 backdrop-blur-sm p-4">
    <Upload className="w-16 h-16 text-gray-400 mb-4" />
    <h3 className="text-lg font-semibold text-gray-600">Ready for Scouting</h3>
    <p className="text-gray-500 max-w-sm">
      Select a player and upload an audio file to generate your first report.
    </p>
    <button
      onClick={onStart}
      className="mt-6 lg:hidden flex items-center justify-center space-x-2 py-3 px-6 bg-[#0e0c66] text-white font-semibold rounded-lg hover:bg-[#0e0c66]/85 transition-all duration-200"
    >
      <Sparkles className="w-5 h-5" />
      <span>Start New Report</span>
    </button>
  </div>
);

const ScoutingPlatform: React.FC = () => {
  // Player Search State
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Team Search State
  const [teamSearchQuery, setTeamSearchQuery] = useState("");
  const debouncedTeamSearchQuery = useDebounce(teamSearchQuery, 300);
  const [teamSearchResults, setTeamSearchResults] = useState<TeamSearchResult[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isSearchingTeams, setIsSearchingTeams] = useState(false);

  // League Standings State
  const [leagueStandings, setLeagueStandings] = useState<LeagueStandingsResponse | null>(null);
  const [isFetchingStandings, setIsFetchingStandings] = useState(false);

  // Seasonal Stats State
  const [seasonalStats, setSeasonalStats] = useState<SeasonalStat[]>([]);
  const [isFetchingStats, setIsFetchingStats] = useState(false);

  // Translation State
  const [originalReportHtml, setOriginalReportHtml] = useState<string | null>(null);
  const [translatedReportHtml, setTranslatedReportHtml] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isEnglishReport, setIsEnglishReport] = useState(true);
  const [playerLanguage, setPlayerLanguage] = useState<string | null>(null);

  const [traitRatings, setTraitRatings] = useState<TraitRatings>({
    skating: 0,
    puckSkills: 0,
    hockeyIq: 0,
    shot: 0,
    competeLevel: 0,
    defensiveGame: 0,
  });

  // Existing State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [transcriptionText, setTranscriptionText] = useState<string>("");
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [hasGeneratedReport, setHasGeneratedReport] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reusable function to apply font sizes
  const applyFontSizes = (editorInstance: Editor) => {
    const { tr, doc } = editorInstance.state;
    let modified = false;
    doc.descendants((node, pos) => {
      if (!node.isTextblock) return;
      let size: string | undefined = undefined;
      if (node.type.name === "heading") {
        const level = node.attrs.level;
        size = PREDEFINED_SIZES[`h${level}`];
      } else if (node.type.name === "paragraph") {
        size = PREDEFINED_SIZES.p;
      }
      if (size) {
        const from = pos + 1;
        const to = from + node.content.size;
        tr.addMark(
          from,
          to,
          editorInstance.schema.marks.textStyle.create({ fontSize: size })
        );
        modified = true;
      }
    });
    if (modified) {
      editorInstance.view.dispatch(tr);
    }
  };

  const initEditor = useCallback(
    (content: any) => {
      if (editor) {
        editor.destroy();
      }
      const newEditor = new Editor({
        extensions: editorExtensions,
        content: content,
        editorProps: {
          attributes: { class: "prose max-w-none p-4 md:p-8 focus:outline-none" },
        },
        onCreate: ({ editor: createdEditor }) => {
          applyFontSizes(createdEditor);
        },
        onUpdate: ({ editor: updatedEditor }) => {
          const currentHtml = updatedEditor.getHTML();
          if (isEnglishReportRef.current) {
            setOriginalReportHtml(currentHtml);
          } else {
            setTranslatedReportHtml(currentHtml);
          }
        },
      });
      setEditor(newEditor);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const isEnglishReportRef = useRef(isEnglishReport);
  useEffect(() => {
    isEnglishReportRef.current = isEnglishReport;
  }, [isEnglishReport]);


  useEffect(() => {
    const initialContent = marked.parse(
      ""
    ) as string;
    initEditor(initialContent);
    return () => {
      editor?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initEditor]);

  useEffect(() => {
    const initialContent = marked.parse(
      ""
    ) as string;
    initEditor(initialContent);
    return () => {
      editor?.destroy();
    };
  }, [initEditor]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setIsExportMenuOpen(false);
      }
    };
    if (isExportMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isExportMenuOpen]);

  // Effect to switch editor content when language changes
  useEffect(() => {
    if (!editor) return;

    const newContent = isEnglishReport ? originalReportHtml : translatedReportHtml;
    
    if (newContent && editor.getHTML() !== newContent) {
      editor.commands.setContent(newContent, false, {
        preserveWhitespace: 'full',
      });
      applyFontSizes(editor);
    }
  }, [isEnglishReport, originalReportHtml, translatedReportHtml, editor]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files);
      const validFiles = newFiles.filter(file => {
        if (!file.type.startsWith("audio/")) {
          toast.error(`Invalid file type: ${file.name}. Please select audio files.`);
          return false;
        }
        const MAX_FILE_SIZE_MB = 100;
        const fileSizeMB = file.size / (1024 * 1024);
        if (fileSizeMB > MAX_FILE_SIZE_MB) {
          toast.error(`${file.name} exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
          return false;
        }
        return true;
      });

      setSelectedFiles(prevFiles => [...prevFiles, ...validFiles]);
      toast.success(`${validFiles.length} file(s) selected!`);
    }
  };

  const handleRemoveFile = (fileToRemove: File) => {
    setSelectedFiles(prevFiles => prevFiles.filter(file => file !== fileToRemove));
  };

  // Player Search Handlers
  const handleSelectPlayer = (player: Player) => {
    setSelectedPlayer(player);
    setSearchQuery('');
    setSearchResults([]);

    if (player.currentTeam) {
      const teamForSelection: Team = {
        id: player.currentTeam.id,
        name: player.currentTeam.name,
        shortName: player.currentTeam.shortName,
        country: player.currentTeam.country,
        slug: '',
        leagues: player.currentTeam.leagues,
      };
      setSelectedTeam(teamForSelection);
    }
  };

  const handleClearPlayer = () => {
    setSelectedPlayer(null);
    setSeasonalStats([]);
  };

  // Team Search Handlers
  const handleSelectTeam = (team: Team) => {
    setSelectedTeam(team);
    setTeamSearchQuery('');
    setTeamSearchResults([]);
  };

  const handleClearTeam = () => {
    setSelectedTeam(null);
    setLeagueStandings(null);
  };

  const handleRatingChange = useCallback((trait: keyof TraitRatings, newRating: number) => {
    setTraitRatings(prev => ({ ...prev, [trait]: newRating }));
  }, []);

  // Player Search API Fetching
  useEffect(() => {
    if (debouncedSearchQuery.length < 2 || selectedPlayer) {
      setSearchResults([]);
      return;
    }

    const fetchPlayers = async () => {
      setIsSearching(true);
      const GRAPHQL_ENDPOINT = "https://api.graet.com";
      
      const query = `
        query SearchUsersQuery($usersFilter: UsersFilter!, $first: Int) {
          users: searchUsers(filter: $usersFilter, first: $first) {
            edges {
              node {
                id
                slug
                role
                firstname
                lastname
                name
                country
                dateOfBirth
                possibleYearsOfBirth
                bio {
                  position
                  gender
                  playerType
                  handedness
                  height { centimeters inches }
                  weight { kilograms pounds }
                }
                currentTeam {
                  id
                  name
                  country
                  shortName
                  hasGames
                  leagues { id name }
                }
                stats {
                  career { gamesPlayed goals assists points pointsPerGame gaa shutouts svp wins losses ties }
                  season { gamesPlayed goals assists points pointsPerGame gaa shutouts svp wins losses ties }
                }
              }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      `;
      
      const variables = {
        usersFilter: {
          searchQuery: debouncedSearchQuery,
        },
        first: 10,
      };

      try {
        const response = await fetch(GRAPHQL_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, variables }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API Error: ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        if (result.errors) {
          console.error("GraphQL Errors:", result.errors);
          throw new Error(result.errors.map((e: any) => e.message).join("\n"));
        }
        
        const foundPlayers = result.data?.users?.edges || [];
        console.log("Search Results (Players):", foundPlayers);
        setSearchResults(foundPlayers);

      } catch (error: any) {
        console.error("Failed to fetch players:", error);
        toast.error(`Could not fetch players: ${error.message}`);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    fetchPlayers();
  }, [debouncedSearchQuery, selectedPlayer]);

  // Team Search API Fetching
  useEffect(() => {
    if (debouncedTeamSearchQuery.length < 2 || selectedTeam) {
      setTeamSearchResults([]);
      return;
    }

    const fetchTeams = async () => {
      setIsSearchingTeams(true);
      const GRAPHQL_ENDPOINT = "https://api.graet.com";

      const query = `
        query SearchTeams($filter: TeamsFilter!, $pagination: Pagination) {
          teams(filter: $filter, pagination: $pagination) {
            edges {
              node {
                id
                name
                shortName
                country
                slug
                leagues {
                  id
                  name
                }
              }
            }
          }
        }
      `;

      const variables = {
        filter: {
          searchQuery: debouncedTeamSearchQuery,
          country: null,
          leagues: null,
          shortName: null,
        },
        pagination: {
          first: 10,
          after: null,
        },
      };

      try {
        const response = await fetch(GRAPHQL_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, variables }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API Error: ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        if (result.errors) {
          console.error("GraphQL Errors:", result.errors);
          throw new Error(result.errors.map((e: any) => e.message).join("\n"));
        }

        const foundTeams = result.data?.teams?.edges || [];
        console.log("Search Results (Teams):", foundTeams);
        setTeamSearchResults(foundTeams);

      } catch (error: any) {
        console.error("Failed to fetch teams:", error);
        toast.error(`Could not fetch teams: ${error.message}`);
        setTeamSearchResults([]);
      } finally {
        setIsSearchingTeams(false);
      }
    };

    fetchTeams();
  }, [debouncedTeamSearchQuery, selectedTeam]);

  // League Standings API Fetching
  useEffect(() => {
    const fetchLeagueStandings = async () => {
      if (!selectedTeam || !selectedTeam.leagues?.[0]?.id) {
        setLeagueStandings(null);
        return;
      }

      setIsFetchingStandings(true);
      toast.loading("Fetching league standings...", { id: "standings-toast" });
      const GRAPHQL_ENDPOINT = "https://api.graet.com";

      const query = `
        query SearchLeagueStandings($leagueId: ObjectId!, $season: String, $teamId: ObjectId) {
          leagueStandings(leagueId: $leagueId, season: $season, teamId: $teamId) {
            league {
              id
              name
            }
            groups {
              group
              standings {
                id
                team {
                  id
                  name
                }
              }
            }
          }
        }
      `;

      const variables = {
        leagueId: selectedTeam.leagues[0].id,
        season: "2024-2025",
        teamId: selectedTeam.id,
      };

      try {
        const response = await fetch(GRAPHQL_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, variables }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API Error: ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        if (result.errors) {
          console.error("GraphQL Errors:", result.errors);
          throw new Error(result.errors.map((e: any) => e.message).join("\n"));
        }

        const standingsData = result.data?.leagueStandings;
        console.log("League Standings:", standingsData);
        setLeagueStandings(standingsData);
        toast.success("League standings loaded!", { id: "standings-toast" });

      } catch (error: any) {
        console.error("Failed to fetch league standings:", error);
        toast.error(`Could not fetch standings: ${error.message}`, { id: "standings-toast" });
        setLeagueStandings(null);
      } finally {
        setIsFetchingStandings(false);
      }
    };

    fetchLeagueStandings();
  }, [selectedTeam]);

  // Seasonal Stats API Fetching
  useEffect(() => {
    if (!selectedPlayer) {
      setSeasonalStats([]);
      return;
    }

    const fetchSeasonalStats = async () => {
      setIsFetchingStats(true);
      toast.loading("Fetching player stats...", { id: "player-stats-toast" });
      const GRAPHQL_ENDPOINT = "https://api.graet.com";

      const query = `
        query GetUserStats($statsFilter: UserStatsFilter!, $statsPage: Pagination) {
          seasons: userStats(filter: $statsFilter, pagination: $statsPage) {
            edges {
              node {
                team { name shortName }
                user { name id }
                position season seasonType gamesPlayed goals assists points
                plusMinus pim wins losses ties gaa svp shutouts toi
              }
            }
          }
        }
      `;

      const variables = {
        statsFilter: {
          slug: null,
          user: selectedPlayer.id,
        },
        statsPage: {
          first: 100,
          after: null,
        },
      };

      try {
        const response = await fetch(GRAPHQL_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, variables }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API Error: ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        if (result.errors) {
          console.error("GraphQL Errors:", result.errors);
          throw new Error(result.errors.map((e: any) => e.message).join("\n"));
        }

        const statsData = result.data?.seasons?.edges || [];
        console.log("Seasonal Stats:", statsData);
        setSeasonalStats(statsData);
        toast.success("Player stats loaded!", { id: "player-stats-toast" });

      } catch (error: any) {
        console.error("Failed to fetch seasonal stats:", error);
        toast.error(`Could not fetch player stats: ${error.message}`, { id: "player-stats-toast" });
        setSeasonalStats([]);
      } finally {
        setIsFetchingStats(false);
      }
    };

    fetchSeasonalStats();
  }, [selectedPlayer]);

  const handleTranslateReport = async (reportHtml: string, playerCountry: string) => {
    setIsTranslating(true);
    setPlayerLanguage(null);
    toast.loading("Translating report...", { id: "translate-toast" });
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportText: reportHtml, playerCountry }),
      });

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      const data = await response.json();

      if (data.translationSkipped) {
        console.log("Translation skipped:", data.reason);
        toast.dismiss("translate-toast");
        return;
      }

      const translatedHtml = marked.parse(data.translatedText) as string;
      setTranslatedReportHtml(translatedHtml);
      setPlayerLanguage(data.languageName);
      toast.success("Translation complete!", { id: "translate-toast" });

    } catch (error) {
      console.error("Translation error:", error);
      toast.error("Could not translate report.", { id: "translate-toast" });
    } finally {
      setIsTranslating(false);
    }
  };

  const handleProcessAudio = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Please select at least one audio file.");
      return;
    }
    if (!selectedPlayer) {
      toast.error("Please select a player first.");
      return;
    }
    if (!selectedTeam) {
      toast.error("Please select a team first.");
      return;
    }

    setOriginalReportHtml(null);
    setTranslatedReportHtml(null);
    setPlayerLanguage(null);
    setIsEnglishReport(true);

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
        toast.error("API Key is not configured. Please set NEXT_PUBLIC_GEMINI_API_KEY.");
        return;
    }

    setIsTranscribing(true);
    
    const allTranscriptions: string[] = [];
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        toast.loading(`Transcribing file ${i + 1} of ${selectedFiles.length}...`, { id: "process-toast" });
        
        const fileSizeMB = file.size / (1024 * 1024);
        const UPLOAD_THRESHOLD_MB = 20;
        let singleTranscription = "";

        if (fileSizeMB > UPLOAD_THRESHOLD_MB) {
          singleTranscription = await handleResumableUploadAndTranscribe(file, apiKey, selectedPlayer, selectedTeam, leagueStandings);
        } else {
          singleTranscription = await handleInlineUploadAndTranscribe(file, apiKey, selectedPlayer, selectedTeam, leagueStandings);
        }
        allTranscriptions.push(singleTranscription);
      }
      toast.success("All files transcribed!", { id: "process-toast" });
    } catch (error: any) {
        console.error("Transcription Error:", error);
        toast.error(`Could not transcribe: ${error.message}`, { id: "process-toast" });
        setIsTranscribing(false);
        return;
    }

    const combinedTranscription = allTranscriptions
      .map((text, index) => `--- File ${index + 1} ---\n${text}`)
      .join('\n\n');
    
    setTranscriptionText(combinedTranscription);

    setIsGenerating(true);
    toast.loading("Generating scout report...", { id: "generate-toast" });
    try {
      const generateResponse = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          transcription: combinedTranscription,
          playerContext: selectedPlayer,
          teamContext: selectedTeam,
          standingsContext: leagueStandings,
          seasonalStatsContext: seasonalStats,
        }),
      });

      if (!generateResponse.ok) {
        const errorMsg = await getErrorMessage(generateResponse);
        throw new Error(errorMsg);
      }

      const data = await generateResponse.json();
      const finalHtml = marked.parse(data.report) as string;
      
      setOriginalReportHtml(finalHtml);
      initEditor(finalHtml);
      setHasGeneratedReport(true);
      if (window.innerWidth < 1024) {
        setIsMobileSidebarOpen(false);
      }
      toast.success("Report generated!", { id: "generate-toast" });

      handleTranslateReport(data.report, selectedPlayer.country);

    } catch (error: any) {
      console.error("Report Generation API Error:", error);
      toast.error(`Could not generate report: ${error.message}`, { id: "generate-toast" });
    } finally {
      setIsTranscribing(false);
      setIsGenerating(false);
    }
  };

  const handleInlineUploadAndTranscribe = async (file: File, apiKey: string, player: Player, team: Team, standings: LeagueStandingsResponse | null): Promise<string> => {
    const audioBuffer = await file.arrayBuffer();
    const audioBase64 = arrayBufferToBase64(audioBuffer);

    let standingsContext = "";
    if (standings && standings.groups) {
      const teamNames = standings.groups.flatMap(g => g.standings.map(s => s.team.name));
      standingsContext = `For context, the teams in this league include: ${Array.from(new Set(teamNames)).join(', ')}.`;
    }

    const promptText = `Transcribe the following audio of a sports scout discussing the player ${player.name} of the team ${team.name}. Focus on clarity and accuracy, correctly identifying hockey-specific terms. If you recognize the names of the opponent team and the league they play in correctly spell them out in the transcript (use the right capitalization the letters in words for some nations). ${standingsContext}`;

    const requestBody = {
        contents: [{
            parts: [
                { "inline_data": { "mime_type": file.type, "data": audioBase64 } },
                { "text": promptText }
            ]
        }],
        "generationConfig": {
            "temperature": 0,
        }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) throw new Error(await getErrorMessage(response));

    const responseData = await response.json();
    if (responseData.candidates && responseData.candidates[0].content.parts[0].text) {
        return responseData.candidates[0].content.parts[0].text;
    } else {
        throw new Error("Could not find transcription in API response.");
    }
  };

  const handleResumableUploadAndTranscribe = async (file: File, apiKey: string, player: Player, team: Team, standings: LeagueStandingsResponse | null): Promise<string> => {
    let fileUri = '';
    let fileNameOnServer = '';

    try {
      const startUploadResponse = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': file.size.toString(),
          'X-Goog-Upload-Header-Content-Type': file.type,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 'file': { 'display_name': file.name } }),
      });

      if (!startUploadResponse.ok) throw new Error(await getErrorMessage(startUploadResponse));
      
      const uploadUrl = startUploadResponse.headers.get('x-goog-upload-url');
      if (!uploadUrl) throw new Error("Could not get resumable upload URL.");

      const uploadBytesResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Length': file.size.toString(),
          'X-Goog-Upload-Offset': '0',
          'X-Goog-Upload-Command': 'upload, finalize',
        },
        body: file,
      });

      if (!uploadBytesResponse.ok) throw new Error(await getErrorMessage(uploadBytesResponse));

      const fileInfo = await uploadBytesResponse.json();
      fileUri = fileInfo.file.uri;
      fileNameOnServer = fileInfo.file.name;

      let standingsContext = "";
      if (standings && standings.groups) {
        const teamNames = standings.groups.flatMap(g => g.standings.map(s => s.team.name));
        standingsContext = `For context, the teams in this league include: ${Array.from(new Set(teamNames)).join(', ')}.`;
      }

      const promptText = `Transcribe the following audio of a sports scout discussing the player ${player.name} of the team ${team.name}. Focus on clarity and accuracy, correctly identifying hockey-specific terms. If you recognize the names of the opponent team and the league they play in correctly spell them out in the transcript. ${standingsContext}`;

      const generateContentBody = {
        contents: [{
          parts: [
            { "text": promptText },
            { "file_data": { "mime_type": file.type, "file_uri": fileUri } }
          ]
        }],
        "generationConfig": {
            "temperature": 0,
        }
      };

      const generateContentUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const generateContentResponse = await fetch(generateContentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generateContentBody),
      });

      if (!generateContentResponse.ok) throw new Error(await getErrorMessage(generateContentResponse));

      const responseData = await generateContentResponse.json();
      if (responseData.candidates && responseData.candidates[0].content.parts[0].text) {
        return responseData.candidates[0].content.parts[0].text;
      } else {
        throw new Error("Could not find transcription in API response.");
      }
    } finally {
      if (fileNameOnServer) {
        console.log(`Cleaning up uploaded file: ${fileNameOnServer}`);
        await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileNameOnServer}?key=${apiKey}`, {
          method: 'DELETE',
        });
      }
    }
  };

  const handleExport = async (format: "pdf" | "txt") => {
    if (!editor) return;
    setIsExportMenuOpen(false);

    const reportTitle =
      editor.state.doc.firstChild?.textContent || "Scouting Report";
    const fileName =
      `${reportTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.` + format;

    const downloadFile = (blob: Blob, name: string) => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    };

    if (format === "txt") {
      toast.loading("Exporting as TXT...", { id: "export-toast" });
      const textContent = editor.getText();
      const blob = new Blob([textContent], { type: "text/plain" });
      downloadFile(blob, fileName);
      toast.success("Exported as TXT!", { id: "export-toast" });
      return;
    }

    if (format === "pdf") {
      toast.loading("Generating PDF...", { id: "export-toast" });
      try {
        const response = await fetch('/api/pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerContext: selectedPlayer,
            teamContext: selectedTeam,
            standingsContext: leagueStandings,
            seasonalStatsContext: seasonalStats,
            reportHtml: editor.getHTML(),
            traitRatings: traitRatings,
          }),
        });

        if (!response.ok) {
          throw new Error(`PDF generation failed: ${response.statusText}`);
        }

        const pdfBlob = await response.blob();
        downloadFile(pdfBlob, fileName);
        toast.success("PDF downloaded!", { id: "export-toast" });

      } catch (error: any) {
        console.error(`Could not generate PDF: ${error.message}`, error);
        toast.error(`Could not generate PDF: ${error.message}`, { id: "export-toast" });
      }
    }
  };

  const isLoading = isTranscribing || isGenerating || isFetchingStandings || isFetchingStats;
  const buttonText = isTranscribing
    ? "Transcribing..."
    : isGenerating
      ? "Generating..."
      : isFetchingStandings
        ? "Loading Standings..."
        : isFetchingStats
          ? "Loading Player Stats..."
          : "Generate Report";

  return (
    <div className="h-screen bg-gray-100 flex flex-col font-sans text-black overflow-hidden">
      <Toaster position="top-center" />
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex-shrink-0 flex items-center justify-between">
        <Image src={logo2} alt="GRAET Logo" width={100} height={8} priority className="md:w-[120px]" />
        <div ref={exportMenuRef} className="relative">
          <button
            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
            disabled={!hasGeneratedReport}
            className="flex items-center space-x-2 px-3 sm:px-4 py-2 text-sm font-semibold bg-[#0e0c66] text-white rounded-lg hover:bg-[#0e0c66]/85 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">Export Report</span>
            <ChevronDown className="w-4 h-4" />
          </button>
          {isExportMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
              <button
                onClick={() => handleExport("pdf")}
                className="w-full text-left flex items-center space-x-2 p-2 text-sm hover:bg-gray-100"
              >
                <FileDown className="w-4 h-4 text-red-600" />
                <span>Save as PDF</span>
              </button>
              <button
                onClick={() => handleExport("txt")}
                className="w-full text-left flex items-center space-x-2 p-2 text-sm hover:bg-gray-100"
              >
                <FileText className="w-4 h-4 text-gray-600" />
                <span>Save as Text</span>
              </button>
            </div>
          )}
        </div>
      </header>
      <div className="flex flex-1 min-h-0">
        <div
          className={`
            flex-shrink-0 bg-white border-r border-gray-200 flex flex-col z-40
            transition-all duration-300 ease-in-out
            
            lg:relative
            ${isDesktopSidebarCollapsed ? 'lg:w-0' : 'lg:w-1/3'}

            absolute top-0 left-0 h-full w-full max-w-md sm:w-96 lg:max-w-none
            transform lg:transform-none
            ${isMobileSidebarOpen ? "translate-x-0 shadow-lg" : "-translate-x-full"}
          `}
        >
          {/* --- MODIFICATION START: CORRECTED SIDEBAR LAYOUT FOR SCROLLING --- */}
          <div className={`flex-1 flex flex-col min-h-0 ${isDesktopSidebarCollapsed ? 'lg:hidden' : ''}`}>
            
            <div className="flex-1 space-y-6 min-h-0 overflow-y-auto p-4 md:p-6">
              {hasGeneratedReport && (
                <div className="pb-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900 mb-3">
                    Rate Player Traits
                  </h2>
                  <div className="space-y-4">
                    <RatingScaleLegend />
                    <TraitRatingSelector title="Skating" rating={traitRatings.skating} onRatingChange={(r) => handleRatingChange('skating', r)} />
                    <TraitRatingSelector title="Puck Skills" rating={traitRatings.puckSkills} onRatingChange={(r) => handleRatingChange('puckSkills', r)} />
                    <TraitRatingSelector title="Hockey IQ" rating={traitRatings.hockeyIq} onRatingChange={(r) => handleRatingChange('hockeyIq', r)} />
                    <TraitRatingSelector title="Shot" rating={traitRatings.shot} onRatingChange={(r) => handleRatingChange('shot', r)} />
                    <TraitRatingSelector title="Compete Level" rating={traitRatings.competeLevel} onRatingChange={(r) => handleRatingChange('competeLevel', r)} />
                    <TraitRatingSelector title="Defensive Game" rating={traitRatings.defensiveGame} onRatingChange={(r) => handleRatingChange('defensiveGame', r)} />
                  </div>
                </div>
              )}

              <PlayerSearch
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchResults={searchResults}
                isSearching={isSearching}
                selectedPlayer={selectedPlayer}
                onSelectPlayer={handleSelectPlayer}
                onClearPlayer={handleClearPlayer}
              />

              <TeamSearch
                searchQuery={teamSearchQuery}
                onSearchChange={setTeamSearchQuery}
                searchResults={teamSearchResults}
                isSearching={isSearchingTeams}
                selectedTeam={selectedTeam}
                onSelectTeam={handleSelectTeam}
                onClearTeam={handleClearTeam}
              />

              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  Upload Audio
                </h2>
                <label
                  htmlFor="file-upload"
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#0e0c66] hover:bg-gray-50 cursor-pointer transition-colors block"
                >
                  <div className="flex flex-col items-center justify-center">
                    <Upload className="mx-auto w-10 h-10 text-gray-400 mb-2" />
                    <p className="text-sm font-semibold text-[#0e0c66]">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      MP3, WAV, M4A (100MB limit per file)
                    </p>
                  </div>
                  <input
                    id="file-upload"
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={handleFileChange}
                    ref={fileInputRef}
                    multiple
                  />
                </label>

                {selectedFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-gray-800">Selected files:</p>
                    {selectedFiles.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex items-center justify-between p-2.5 border rounded-lg bg-white shadow-sm"
                      >
                        <div className="flex items-center space-x-3 truncate">
                          <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" />
                          <div className="truncate">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {file.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {(file.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveFile(file)}
                          className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors"
                          title="Remove file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col flex-1 h-[400px]">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  Review Transcription
                </h2>
                <textarea
                  value={transcriptionText}
                  onChange={(e) => setTranscriptionText(e.target.value)}
                  className="flex-1 w-full p-4 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-800 leading-relaxed resize-none focus:outline-none"
                  placeholder="Your audio transcription will appear here..."
                />
              </div>
            </div>
            
            <div className="flex-shrink-0 p-4 md:p-6 pt-4">
              <button
                onClick={handleProcessAudio}
                disabled={isLoading || selectedFiles.length === 0 || !selectedPlayer || !selectedTeam}
                className="w-full flex items-center justify-center space-x-2 py-3 bg-[#0e0c66] text-white font-semibold rounded-lg hover:bg-[#0e0c66]/85 transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-5 h-5" />
                <span>{buttonText}</span>
              </button>
            </div>
          </div>
          {/* --- MODIFICATION END --- */}
        </div>

        {isMobileSidebarOpen && (
          <div
            onClick={() => setIsMobileSidebarOpen(false)}
            className="lg:hidden absolute inset-0 bg-black bg-opacity-50 z-30"
          ></div>
        )}

        <div className="flex-1 bg-gray-50 flex flex-col relative">
          <EditorToolbar
            editor={editor}
            isMobileSidebarOpen={isMobileSidebarOpen}
            isDesktopSidebarCollapsed={isDesktopSidebarCollapsed}
            onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            onToggleDesktopSidebar={() => setIsDesktopSidebarCollapsed(!isDesktopSidebarCollapsed)}
            isEnglishReport={isEnglishReport}
            setIsEnglishReport={setIsEnglishReport}
            playerLanguage={playerLanguage}
            isTranslating={isTranslating}
          />
          {editor && (
            <>
              <BubbleMenu
                editor={editor}
                tippyOptions={{ duration: 100, placement: "top" }}
                shouldShow={({ editor }) => {
                  const { selection } = editor.state;
                  const { $from, empty } = selection;
                  if (empty || $from.depth < 2) {
                    return false;
                  }
                  return !editor.isActive("table");
                }}
                className="flex items-center space-x-1 bg-black text-white p-2 rounded-lg shadow-xl"
              >
                <button
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={`p-1 ${editor.isActive("bold") ? "bg-gray-700" : ""} rounded`}
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={`p-1 ${editor.isActive("italic") ? "bg-gray-700" : ""} rounded`}
                >
                  <Italic className="w-4 h-4" />
                </button>
              </BubbleMenu>
              <TableMenus editor={editor} />
              <div className="flex-1 p-2 sm:p-4 overflow-y-auto">
                <div className="bg-white min-h-full rounded-lg shadow-sm">
                  <EditorContent editor={editor} />
                </div>
              </div>
            </>
          )}
          {!hasGeneratedReport && (
            <EditorPlaceholder onStart={() => setIsMobileSidebarOpen(true)} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ScoutingPlatform;
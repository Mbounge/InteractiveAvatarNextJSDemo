// app/components/ScoutingReport.tsx

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
import { showToast } from "./CustomToast";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { Extension, InputRule } from "@tiptap/core";
import { Heading, Level } from "@tiptap/extension-heading";
import { CellSelection } from "prosemirror-tables";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { format, parse, isValid } from "date-fns";
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
  Check,
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  Search,
  Shield,
  CalendarDays,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import Image from "next/image";
import logo2 from "../public/Graet_Logo.svg";

// --- NOTIFICATION COMPONENT (No Changes) ---
interface ProcessStatusProps {
  status:
    | "idle"
    | "loading"
    | "transcribing"
    | "generating"
    | "success"
    | "error";
  message: string;
}

const ProcessStatus: React.FC<ProcessStatusProps> = ({ status, message }) => {
  if (status === "idle") {
    return null;
  }

  const getIcon = () => {
    switch (status) {
      case "loading":
      case "transcribing":
      case "generating":
        return <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />;
      case "success":
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getTextColor = () => {
    switch (status) {
      case "success":
        return "text-emerald-800";
      case "error":
        return "text-red-800";
      default:
        return "text-indigo-800";
    }
  };

  const getBgColor = () => {
    switch (status) {
      case "success":
        return "bg-emerald-50 border-emerald-200";
      case "error":
        return "bg-red-50 border-red-200";
      default:
        return "bg-indigo-50 border-indigo-200";
    }
  };

  return (
    <div
      className={`w-full ${getBgColor()} backdrop-blur-sm border rounded-xl p-4 flex items-center gap-3 transition-all duration-300`}
    >
      <div className="flex-shrink-0">{getIcon()}</div>
      <p className={`text-sm font-medium ${getTextColor()}`}>{message}</p>
    </div>
  );
};

// --- PROPS INTERFACE (No Changes) ---
interface ScoutingPlatformProps {
  accessCode: string;
  reportId: string | null;
  reportType: "skater" | "goalie";
  onBackToDashboard: () => void;
}

// --- HELPER HOOK & FUNCTIONS (No Changes) ---

const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    window.addEventListener("resize", listener);
    return () => window.removeEventListener("resize", listener);
  }, [matches, query]);
  return matches;
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++)
    binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary);
}

const getErrorMessage = async (response: Response): Promise<string> => {
  try {
    const errorJson = await response.clone().json();
    return errorJson.error?.message || JSON.stringify(errorJson);
  } catch (e) {
    return (await response.text()) || `HTTP error! Status: ${response.status}`;
  }
};

const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

const Spinner: React.FC<{ className?: string }> = ({ className }) => (
  <Loader2 className={`animate-spin h-5 w-5 text-[#0e0c66] ${className}`} />
);

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
  avatar?: string;
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
  stats: { career: Stats; season: Stats };
};
type PlayerSearchResult = { node: Player };
type Team = {
  id: string;
  name: string;
  shortName: string;
  country: string;
  slug: string;
  leagues: { id: string; name: string }[];
};
type TeamSearchResult = { node: Team };

type League = {
  id: string;
  name: string;
  type: string;
  level: string;
  genderCategory: string;
  countries: string[];
};
type LeagueSearchResult = { node: League };

type Standing = { id: string; team: { id: string; name: string } };
type LeagueStandingsResponse = {
  league: { id: string; name: string };
  groups: { group: string; standings: Standing[] }[];
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
  };
};
type TraitRatings = {
  skating: number;
  puckSkills: number;
  hockeyIq: number;
  shot: number;
  competeLevel: number;
  defensiveGame: number;
};
type Language = { code: string; name: string };

const AVAILABLE_LANGUAGES: Language[] = [
  { code: "SE", name: "Swedish" },
  { code: "FI", name: "Finnish" },
  { code: "CZ", name: "Czech" },
  { code: "SK", name: "Slovak" },
  { code: "RU", name: "Russian" },
  { code: "DE", name: "German" },
  { code: "FR", name: "French" },
  { code: "GE", name: "Georgian" },
];

// --- TIPTAP CONFIGURATION (No Changes) ---
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
            if (size)
              tr.addStoredMark(
                state.schema.marks.textStyle.create({ fontSize: size })
              );
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
    }, //@ts-ignore
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

// --- HELPER COMPONENTS (No Changes to these) ---
const formatPosition = (rawPosition: string | null | undefined): string => {
  if (!rawPosition) return "N/A";
  switch (rawPosition) {
    case "CENTER":
      return "Center";
    case "LEFT_WING":
      return "LW";
    case "RIGHT_WING":
      return "RW";
    case "LEFT_DEFENSIVE":
      return "LD";
    case "RIGHT_DEFENSIVE":
      return "RD";
    case "DEFENDER":
      return "D";
    case "GOALTENDER":
      return "Goalie";
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
    className={`p-2 rounded-lg transition-colors ${
      isActive
        ? "bg-indigo-100 text-indigo-700"
        : "hover:bg-gray-100 text-gray-600"
    } disabled:opacity-40 disabled:cursor-not-allowed`}
  >
    {" "}
    {children}{" "}
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
        )
          setIsOpen(false);
      };
      if (isOpen) document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);
    return (
      <div ref={dropdownRef} className="relative" title={title}>
        {" "}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between w-32 p-2 border border-gray-200 bg-white rounded-lg text-sm hover:bg-gray-50 shadow-sm"
        >
          {" "}
          <span className="truncate">{selectedLabel}</span>{" "}
          <ChevronDown className="w-4 h-4 ml-2 text-gray-500" />{" "}
        </button>{" "}
        {isOpen && (
          <div className="absolute z-20 top-full mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200">
            {" "}
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left p-2 text-sm hover:bg-gray-100 ${
                  value === option.value ? "font-bold bg-gray-100" : ""
                }`}
              >
                {" "}
                {option.label}{" "}
              </button>
            ))}{" "}
          </div>
        )}{" "}
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
    <div className="absolute z-10 bg-white shadow-lg border rounded-md p-2 mt-1 right-0">
      {Array.from({ length: 5 }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex">
          {Array.from({ length: 5 }).map((_, colIndex) => (
            <div
              key={colIndex}
              onMouseOver={() =>
                setHovered({ rows: rowIndex + 1, cols: colIndex + 1 })
              }
              onClick={() => createTable(rowIndex + 1, colIndex + 1)}
              className={`w-6 h-6 border border-gray-300 cursor-pointer ${
                rowIndex < hovered.rows && colIndex < hovered.cols
                  ? "bg-blue-300"
                  : "bg-white"
              }`}
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
      {" "}
      {children}{" "}
    </button>
  );
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node))
        setDropdownOpen(false);
    };
    if (isDropdownOpen)
      document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);
  return (
    <>
      {" "}
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
            const element = (
              node.nodeType === Node.TEXT_NODE ? node.parentElement : node
            ) as HTMLElement | null;
            if (!element) return new DOMRect(0, 0, 0, 0);
            const tableElement = element.closest("table");
            if (!tableElement) return new DOMRect(0, 0, 0, 0);
            return tableElement.getBoundingClientRect();
          },
          placement: "top-start",
          offset: [0, 8],
        }}
      >
        {" "}
        <div ref={menuRef} className="relative">
          {" "}
          <button
            onClick={() => setDropdownOpen(!isDropdownOpen)}
            className="bg-white text-gray-700 p-1.5 rounded-md shadow-md border border-gray-300 hover:bg-gray-100"
            title="Table options"
          >
            {" "}
            <TableIcon className="w-4 h-4" />{" "}
          </button>{" "}
          {isDropdownOpen && (
            <div className="absolute z-10 top-full mt-2 bg-white text-black p-2 rounded-lg shadow-xl border border-gray-200 w-max">
              {" "}
              <div className="flex divide-x divide-gray-200">
                {" "}
                <div className="px-3 py-1">
                  {" "}
                  <div className="font-bold text-xs uppercase text-gray-500 pb-2">
                    {" "}
                    Row{" "}
                  </div>{" "}
                  <MenuItem
                    onClick={() => editor.chain().focus().addRowBefore().run()}
                  >
                    {" "}
                    <Plus className="w-4 h-4 mr-2" /> Add Above{" "}
                  </MenuItem>{" "}
                  <MenuItem
                    onClick={() => editor.chain().focus().addRowAfter().run()}
                  >
                    {" "}
                    <Plus className="w-4 h-4 mr-2" /> Add Below{" "}
                  </MenuItem>{" "}
                  <MenuItem
                    onClick={() => editor.chain().focus().deleteRow().run()}
                  >
                    {" "}
                    <Minus className="w-4 h-4 mr-2" /> Delete Row{" "}
                  </MenuItem>{" "}
                </div>{" "}
                <div className="px-3 py-1">
                  {" "}
                  <div className="font-bold text-xs uppercase text-gray-500 pb-2">
                    {" "}
                    Column{" "}
                  </div>{" "}
                  <MenuItem
                    onClick={() =>
                      editor.chain().focus().addColumnBefore().run()
                    }
                  >
                    {" "}
                    <Plus className="w-4 h-4 mr-2" /> Add Left{" "}
                  </MenuItem>{" "}
                  <MenuItem
                    onClick={() =>
                      editor.chain().focus().addColumnAfter().run()
                    }
                  >
                    {" "}
                    <Plus className="w-4 h-4 mr-2" /> Add Right{" "}
                  </MenuItem>{" "}
                  <MenuItem
                    onClick={() => editor.chain().focus().deleteColumn().run()}
                  >
                    {" "}
                    <Minus className="w-4 h-4 mr-2" /> Delete Column{" "}
                  </MenuItem>{" "}
                </div>{" "}
              </div>{" "}
              <hr className="my-2" />{" "}
              <div className="px-1">
                {" "}
                <MenuItem
                  onClick={() => editor.chain().focus().deleteTable().run()}
                >
                  {" "}
                  <Trash2 className="w-4 h-4 mr-2 text-red-500" />{" "}
                  <span className="text-red-500">Delete Table</span>{" "}
                </MenuItem>{" "}
              </div>{" "}
            </div>
          )}{" "}
        </div>{" "}
      </BubbleMenu>{" "}
      <BubbleMenu
        pluginKey="tableCellSelection"
        editor={editor}
        shouldShow={({ editor }) =>
          editor.state.selection instanceof CellSelection
        }
        tippyOptions={{ placement: "top" }}
        className="flex items-center space-x-1 bg-black text-white p-2 rounded-lg shadow-xl"
      >
        {" "}
        <button
          onClick={() => editor.chain().focus().mergeCells().run()}
          disabled={!editor.can().mergeCells()}
          className="p-1 rounded hover:bg-gray-700 disabled:opacity-40"
          title="Merge cells"
        >
          {" "}
          <Merge className="w-4 h-4" />{" "}
        </button>{" "}
        <button
          onClick={() => editor.chain().focus().splitCell().run()}
          disabled={!editor.can().splitCell()}
          className="p-1 rounded hover:bg-gray-700 disabled:opacity-40"
          title="Split cell"
        >
          {" "}
          <Split className="w-4 h-4" />{" "}
        </button>{" "}
      </BubbleMenu>{" "}
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
    setIsResultsOpen(searchResults.length > 0);
  }, [searchResults]);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchResultsRef.current &&
        !searchResultsRef.current.contains(event.target as Node)
      )
        setIsResultsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  if (selectedPlayer) {
    return (
      <div>
        {" "}
        <h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent mb-4">
          {" "}
          Selected Player{" "}
        </h2>{" "}
        <div className="flex items-center justify-between p-3 border rounded-xl bg-green-50 border-green-200/80">
          {" "}
          <div className="flex flex-col">
            {" "}
            <span className="font-bold text-gray-800">
              {selectedPlayer.name}
            </span>{" "}
            <span className="text-sm text-gray-600">
              {formatPosition(selectedPlayer.bio?.position)} -{" "}
              {selectedPlayer.currentTeam?.name || "No Team"}
            </span>{" "}
          </div>{" "}
          <button
            onClick={onClearPlayer}
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
          >
            {" "}
            Change{" "}
          </button>{" "}
        </div>{" "}
      </div>
    );
  }
  return (
    <div>
      {" "}
      <h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent mb-4">
        {" "}
        Select Player{" "}
      </h2>{" "}
      <div className="relative" ref={searchResultsRef}>
        {" "}
        <div className="relative">
          {" "}
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            {" "}
            <Search className="h-5 w-5 text-gray-800" />{" "}
          </div>{" "}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search for a player..."
            className="block w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl bg-white/70 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 shadow-sm placeholder-gray-500"
          />{" "}
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Spinner />
            </div>
          )}{" "}
        </div>{" "}
        {isResultsOpen && searchResults.length > 0 && (
          <div className="absolute top-full mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 z-10 max-h-60 overflow-y-auto">
            {" "}
            {searchResults.map(({ node: player }) => (
              <button
                key={player.id}
                onClick={() => onSelectPlayer(player)}
                className="w-full text-left p-3 hover:bg-gray-100 transition-colors flex justify-between items-center"
              >
                {" "}
                <div>
                  {" "}
                  <p className="font-medium text-gray-800">
                    {player.name}
                  </p>{" "}
                  <p className="text-sm text-gray-500">
                    {formatPosition(player.bio?.position)} -{" "}
                    {player.currentTeam?.name || "No Team"}
                  </p>{" "}
                </div>{" "}
                <span className="text-xs text-gray-400">{player.country}</span>{" "}
              </button>
            ))}{" "}
          </div>
        )}{" "}
      </div>{" "}
    </div>
  );
};

const TeamSearch: React.FC<{
  title?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchResults: TeamSearchResult[];
  isSearching: boolean;
  selectedTeam: Team | null;
  onSelectTeam: (team: Team) => void;
  onClearTeam: () => void;
}> = ({
  title = "Select Team",
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
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualTeamName, setManualTeamName] = useState("");

  useEffect(() => {
    setIsResultsOpen(searchResults.length > 0);
  }, [searchResults]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchResultsRef.current &&
        !searchResultsRef.current.contains(event.target as Node)
      )
        setIsResultsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSaveManualTeam = () => {
    if (manualTeamName.trim()) {
      const manualTeam: Team = {
        id: `manual-${Date.now()}`,
        name: manualTeamName.trim(),
        shortName: manualTeamName.trim(),
        country: "N/A",
        slug: "",
        leagues: [],
      };
      onSelectTeam(manualTeam);
      setIsManualMode(false);
      setManualTeamName("");
    }
  };

  if (selectedTeam) {
    return (
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
        <div className="flex items-center justify-between p-3 border rounded-xl bg-green-50 border-green-200/80">
          <div className="flex flex-col">
            <span className="font-bold text-gray-800">{selectedTeam.name}</span>
            {/* --- FIX: Use a more reliable check for manual entry --- */}
            <span className="text-sm text-gray-600">
              {selectedTeam.id.startsWith("manual-")
                ? "Manually Entered"
                : selectedTeam.leagues?.[0]?.name || "N/A"}
            </span>
          </div>
          <button
            onClick={() => {
              onClearTeam();
              setIsManualMode(false);
            }}
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
      <div className="relative" ref={searchResultsRef}>
        {isManualMode ? (
          <div>
            <div className="relative">
              <input
                type="text"
                value={manualTeamName}
                onChange={(e) => setManualTeamName(e.target.value)}
                placeholder="Enter team name..."
                className="block w-full pr-24 py-3 pl-4 border border-gray-200 rounded-xl bg-white/70 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 shadow-sm placeholder-gray-500"
              />
              <button
                onClick={handleSaveManualTeam}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
              >
                Save
              </button>
            </div>
            <button
              onClick={() => setIsManualMode(false)}
              className="text-xs text-indigo-600 hover:underline mt-2"
            >
              Back to search
            </button>
          </div>
        ) : (
          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-800" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search for a team..."
                className="block w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl bg-white/70 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 shadow-sm placeholder-gray-500"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Spinner />
                </div>
              )}
            </div>
            <button
              onClick={() => setIsManualMode(true)}
              className="text-xs text-indigo-600 hover:underline mt-2"
            >
              Can't find the team? Enter manually.
            </button>
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
                      <p className="text-sm text-gray-500">
                        {team.leagues?.[0]?.name || "No League"}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {team.country}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const LeagueSearch: React.FC<{
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchResults: LeagueSearchResult[];
  isSearching: boolean;
  selectedLeague: League | null;
  onSelectLeague: (league: League) => void;
  onClearLeague: () => void;
}> = ({
  searchQuery,
  onSearchChange,
  searchResults,
  isSearching,
  selectedLeague,
  onSelectLeague,
  onClearLeague,
}) => {
  const searchResultsRef = useRef<HTMLDivElement>(null);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualLeagueName, setManualLeagueName] = useState("");

  useEffect(() => {
    setIsResultsOpen(searchResults.length > 0);
  }, [searchResults]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchResultsRef.current &&
        !searchResultsRef.current.contains(event.target as Node)
      )
        setIsResultsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSaveManualLeague = () => {
    if (manualLeagueName.trim()) {
      const manualLeague: League = {
        id: `manual-${Date.now()}`,
        name: manualLeagueName.trim(),
        type: "N/A",
        level: "N/A",
        genderCategory: "N/A",
        countries: [],
      };
      onSelectLeague(manualLeague);
      setIsManualMode(false);
      setManualLeagueName("");
    }
  };

  if (selectedLeague) {
    return (
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          Selected League
        </h3>
        <div className="flex items-center justify-between p-3 border rounded-xl bg-green-50 border-green-200/80">
          <div className="flex flex-col">
            <span className="font-bold text-gray-800">
              {selectedLeague.name}
            </span>
            <span className="text-sm text-gray-600">
              {selectedLeague.id.startsWith("manual-")
                ? "Manually Entered"
                : `${selectedLeague.countries.join(", ")} - ${
                    selectedLeague.level
                  }`}
            </span>
          </div>
          <button
            onClick={() => {
              onClearLeague();
              setIsManualMode(false);
            }}
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">
        Select League
      </h3>
      <div className="relative" ref={searchResultsRef}>
        {isManualMode ? (
          <div>
            <div className="relative">
              <input
                type="text"
                value={manualLeagueName}
                onChange={(e) => setManualLeagueName(e.target.value)}
                placeholder="Enter league name..."
                className="block w-full pr-24 py-3 pl-4 border border-gray-200 rounded-xl bg-white/70 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 shadow-sm placeholder-gray-500"
              />
              <button
                onClick={handleSaveManualLeague}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
              >
                Save
              </button>
            </div>
            <button
              onClick={() => setIsManualMode(false)}
              className="text-xs text-indigo-600 hover:underline mt-2"
            >
              Back to search
            </button>
          </div>
        ) : (
          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Shield className="h-5 w-5 text-gray-800" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search for a league..."
                className="block w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl bg-white/70 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 shadow-sm placeholder-gray-500"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Spinner />
                </div>
              )}
            </div>
            <button
              onClick={() => setIsManualMode(true)}
              className="text-xs text-indigo-600 hover:underline mt-2"
            >
              Can't find the league? Enter manually.
            </button>
            {isResultsOpen && searchResults.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 z-10 max-h-60 overflow-y-auto">
                {searchResults.map(({ node: league }) => (
                  <button
                    key={league.id}
                    onClick={() => onSelectLeague(league)}
                    className="w-full text-left p-3 hover:bg-gray-100 transition-colors flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium text-gray-800">{league.name}</p>
                      <p className="text-sm text-gray-500">{league.level}</p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {league.countries.join(", ")}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// --- MODIFIED: MaskedDatePicker Component with Editing Bug Fix ---
const MaskedDatePicker: React.FC<{
  selectedDate: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
}> = ({ selectedDate, onDateChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dateChars, setDateChars] = useState<string[]>([]);
  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const placeholder = "YYYY/MM/DD";

  const prevSelectedDateRef = useRef<Date | undefined>(undefined);
  useEffect(() => {
    if (selectedDate?.getTime() !== prevSelectedDateRef.current?.getTime()) {
      if (selectedDate) {
        setDateChars(format(selectedDate, "yyyyMMdd").split(""));
      } else {
        setDateChars([]);
      }
    }
    prevSelectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    let display = placeholder.split("");
    let cursorPosition = 0;

    const year = dateChars.slice(0, 4);
    const month = dateChars.slice(4, 6);
    const day = dateChars.slice(6, 8);

    year.forEach((char, i) => (display[i] = char));
    month.forEach((char, i) => (display[i + 5] = char));
    day.forEach((char, i) => (display[i + 8] = char));

    if (dateChars.length < 4) {
      cursorPosition = dateChars.length;
    } else if (dateChars.length === 4) {
      cursorPosition = 5;
    } else if (dateChars.length < 6) {
      cursorPosition = dateChars.length + 1;
    } else if (dateChars.length === 6) {
      cursorPosition = 8;
    } else {
      cursorPosition = dateChars.length + 2;
    }

    if (inputRef.current) {
      inputRef.current.value = display.join("");
      inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
    }

    if (dateChars.length === 8) {
      const dateStr = `${year.join("")}/${month.join("")}/${day.join("")}`;
      const parsed = parse(dateStr, "yyyy/MM/dd", new Date());
      if (isValid(parsed)) {
        onDateChange(parsed);
      }
    } else {
      onDateChange(undefined);
    }
  }, [dateChars, onDateChange]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDayClick = (date: Date | undefined) => {
    if (date) {
      // This will trigger the first useEffect to update the dateChars
      onDateChange(date);
    }
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.key >= "0" && e.key <= "9") {
      if (dateChars.length < 8) {
        setDateChars([...dateChars, e.key]);
      }
    } else if (e.key === "Backspace") {
      if (dateChars.length > 0) {
        setDateChars(dateChars.slice(0, -1));
      }
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    const firstPlaceholderIndex = inputRef.current?.value.indexOf("Y") ?? -1;
    if (firstPlaceholderIndex !== -1) {
      e.currentTarget.setSelectionRange(
        firstPlaceholderIndex,
        firstPlaceholderIndex
      );
      return;
    }
    const secondPlaceholderIndex = inputRef.current?.value.indexOf("M") ?? -1;
    if (secondPlaceholderIndex !== -1) {
      e.currentTarget.setSelectionRange(
        secondPlaceholderIndex,
        secondPlaceholderIndex
      );
      return;
    }
    const thirdPlaceholderIndex = inputRef.current?.value.indexOf("D") ?? -1;
    if (thirdPlaceholderIndex !== -1) {
      e.currentTarget.setSelectionRange(
        thirdPlaceholderIndex,
        thirdPlaceholderIndex
      );
    }
  };

  return (
    <div className="relative" ref={pickerRef}>
      <style>{`
        .rdp {
          --rdp-cell-size: 40px;
          --rdp-accent-color: #4f46e5; 
          --rdp-background-color: #e0e7ff;
          --rdp-accent-color-dark: #3730a3;
          --rdp-background-color-dark: #c7d2fe;
          --rdp-outline: 2px solid var(--rdp-accent-color);
          --rdp-outline-selected: 3px solid var(--rdp-accent-color);
          margin: 0;
        }
        .rdp-caption_label { font-weight: 600; }
        .rdp-nav_button { border-radius: 99px; }
        .rdp-day_selected {
          font-weight: 600;
          background-color: var(--rdp-accent-color);
          border-radius: 99px;
        }
      `}</style>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          onKeyDown={handleKeyDown}
          onClick={handleClick}
          onFocus={() => setIsOpen(true)}
          // We remove the onChange and onBlur handlers as they are not needed with this logic
          className="block w-full pl-4 pr-10 py-3 border border-gray-200 rounded-xl bg-white/70 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 shadow-sm placeholder-gray-500"
        />
        <CalendarDays
          className="h-5 w-5 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
          onClick={() => {
            setIsOpen(!isOpen);
            inputRef.current?.focus();
          }}
        />
      </div>
      {isOpen && (
        <div className="absolute top-full mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 z-20 p-2">
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleDayClick}
            initialFocus={isOpen}
            defaultMonth={selectedDate}
          />
        </div>
      )}
    </div>
  );
};

const LanguageSelector: React.FC<{
  selectedLanguages: string[];
  onSelectionChange: (langCode: string) => void;
}> = ({ selectedLanguages, onSelectionChange }) => {
  return (
    <div>
      {" "}
      <h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent mb-4">
        {" "}
        Translate Report To{" "}
      </h2>{" "}
      <div className="grid grid-cols-2 gap-3">
        {" "}
        {AVAILABLE_LANGUAGES.map((lang) => {
          const isSelected = selectedLanguages.includes(lang.code);
          return (
            <button
              key={lang.code}
              onClick={() => onSelectionChange(lang.code)}
              className={`flex items-center justify-center space-x-2 p-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                isSelected
                  ? "bg-indigo-600 text-white shadow-md transform scale-105"
                  : "bg-white border border-gray-300 text-gray-800 hover:bg-gray-50 shadow-sm"
              }`}
            >
              {" "}
              {isSelected && <Check className="w-4 h-4" />}{" "}
              <span>{lang.name}</span>{" "}
            </button>
          );
        })}{" "}
      </div>{" "}
    </div>
  );
};

const ReportLanguageSwitcher: React.FC<{
  activeLanguage: string;
  onLanguageChange: (langCode: string) => void;
  translatedReports: Record<string, string>;
  translatingLanguages: Record<string, boolean>;
}> = ({
  activeLanguage,
  onLanguageChange,
  translatedReports,
  translatingLanguages,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const allLanguages = ["EN", ...Object.keys(translatedReports)];
  const stillTranslating = Object.keys(translatingLanguages).filter(
    (lang) => translatingLanguages[lang]
  );
  const totalLanguagesToShow =
    allLanguages.length +
    stillTranslating.filter((l) => !allLanguages.includes(l)).length;
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      )
        setIsOpen(false);
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);
  if (totalLanguagesToShow <= 1) return null;
  if (totalLanguagesToShow >= 4) {
    const activeLangName =
      AVAILABLE_LANGUAGES.find((l) => l.code === activeLanguage)?.name ||
      "English";
    return (
      <div className="relative" ref={dropdownRef}>
        {" "}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between w-32 p-2 border border-gray-200 bg-white rounded-lg text-sm hover:bg-gray-50 shadow-sm"
        >
          {" "}
          <span className="truncate">{activeLangName}</span>{" "}
          <ChevronDown className="w-4 h-4 ml-2 text-gray-500" />{" "}
        </button>{" "}
        {isOpen && (
          <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-md shadow-lg border border-gray-200 z-30">
            {" "}
            {allLanguages.map((langCode) => (
              <button
                key={langCode}
                onClick={() => {
                  onLanguageChange(langCode);
                  setIsOpen(false);
                }}
                className={`w-full text-left p-2 text-sm hover:bg-gray-100 ${
                  activeLanguage === langCode ? "font-bold bg-gray-100" : ""
                }`}
              >
                {" "}
                {AVAILABLE_LANGUAGES.find((l) => l.code === langCode)?.name ||
                  "English"}{" "}
              </button>
            ))}{" "}
            {stillTranslating.map(
              (langCode) =>
                !allLanguages.includes(langCode) && (
                  <div
                    key={langCode}
                    className="flex items-center justify-between p-2 text-sm text-gray-400 cursor-not-allowed"
                  >
                    {" "}
                    <span>
                      {
                        AVAILABLE_LANGUAGES.find((l) => l.code === langCode)
                          ?.name
                      }
                    </span>{" "}
                    <Spinner className="w-4 h-4 text-gray-400" />{" "}
                  </div>
                )
            )}{" "}
          </div>
        )}{" "}
      </div>
    );
  }
  return (
    <div className="flex items-center space-x-1 bg-gray-200/70 rounded-lg p-1">
      {" "}
      {allLanguages.map((langCode) => (
        <button
          key={langCode}
          onClick={() => onLanguageChange(langCode)}
          title={`Switch to ${
            AVAILABLE_LANGUAGES.find((l) => l.code === langCode)?.name ||
            "English"
          }`}
          className={`px-3 h-7 flex items-center justify-center text-xs font-bold rounded-md transition-colors ${
            activeLanguage === langCode
              ? "bg-white text-gray-800 shadow-sm"
              : "bg-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          {" "}
          {langCode}{" "}
        </button>
      ))}{" "}
      {stillTranslating.map(
        (langCode) =>
          !allLanguages.includes(langCode) && (
            <button
              key={langCode}
              disabled
              title={`Translating to ${
                AVAILABLE_LANGUAGES.find((l) => l.code === langCode)?.name
              }...`}
              className="w-10 h-7 flex items-center justify-center text-xs font-bold rounded-md bg-transparent text-gray-500"
            >
              {" "}
              <Spinner className="w-4 h-4" />{" "}
            </button>
          )
      )}{" "}
    </div>
  );
};

const StarIcon: React.FC<{
  fillType: "full" | "half" | "empty";
  className?: string;
}> = ({ fillType, className = "w-6 h-6" }) => {
  const starPath =
    "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";
  const uniqueId = `grad-${Math.random().toString(36).substr(2, 9)}`;
  if (fillType === "full")
    return (
      <svg
        className={`${className} text-blue-600`}
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d={starPath} />
      </svg>
    );
  if (fillType === "half")
    return (
      <svg
        className={`${className} text-blue-600`}
        fill={`url(#${uniqueId})`}
        viewBox="0 0 24 24"
      >
        <defs>
          <linearGradient id={uniqueId}>
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="#d1d5db" stopOpacity="1" />
          </linearGradient>
        </defs>
        <path d={starPath} />
      </svg>
    );
  return (
    <svg
      className={`${className} text-gray-300`}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d={starPath} />
    </svg>
  );
};

const RatingScaleLegend: React.FC = () => (
  <div className="p-4 bg-gray-50/50 border border-gray-200/80 rounded-xl mb-4">
    {" "}
    <h3 className="text-sm font-semibold text-gray-800 mb-3">
      Rating Scale
    </h3>{" "}
    <div className="grid grid-cols-1 gap-3 text-xs text-gray-600">
      {" "}
      <div className="flex items-start space-x-2">
        <div className="flex pt-0.5">
          {[...Array(5)].map((_, i) => (
            <StarIcon key={i} fillType="full" className="w-3 h-3" />
          ))}
        </div>
        <div>
          <span className="font-bold text-gray-700">Elite:</span> Exceptional,
          top-tier skill.
        </div>
      </div>{" "}
      <div className="flex items-start space-x-2">
        <div className="flex pt-0.5">
          {[...Array(4)].map((_, i) => (
            <StarIcon key={i} fillType="full" className="w-3 h-3" />
          ))}
          <StarIcon fillType="empty" className="w-3 h-3" />
        </div>
        <div>
          <span className="font-bold text-gray-700">Strong:</span> Above
          average, highly effective.
        </div>
      </div>{" "}
      <div className="flex items-start space-x-2">
        <div className="flex pt-0.5">
          {[...Array(3)].map((_, i) => (
            <StarIcon key={i} fillType="full" className="w-3 h-3" />
          ))}
          {[...Array(2)].map((_, i) => (
            <StarIcon key={i} fillType="empty" className="w-3 h-3" />
          ))}
        </div>
        <div>
          <span className="font-bold text-gray-700">Solid:</span> Adequate for
          the level.
        </div>
      </div>{" "}
      <div className="flex items-start space-x-2">
        <div className="flex pt-0.5">
          {[...Array(2)].map((_, i) => (
            <StarIcon key={i} fillType="full" className="w-3 h-3" />
          ))}
          {[...Array(3)].map((_, i) => (
            <StarIcon key={i} fillType="empty" className="w-3 h-3" />
          ))}
        </div>
        <div>
          <span className="font-bold text-gray-700">Developing:</span> Shows
          potential, inconsistent.
        </div>
      </div>{" "}
      <div className="flex items-start space-x-2">
        <div className="flex pt-0.5">
          <StarIcon fillType="full" className="w-3 h-3" />
          {[...Array(4)].map((_, i) => (
            <StarIcon key={i} fillType="empty" className="w-3 h-3" />
          ))}
        </div>
        <div>
          <span className="font-bold text-gray-700">Needs Improvement:</span>{" "}
          Below standard.
        </div>
      </div>{" "}
    </div>{" "}
  </div>
);

const TraitRatingSelector: React.FC<{
  title: string;
  rating: number;
  onRatingChange: (newRating: number) => void;
}> = ({ title, rating, onRatingChange }) => {
  const [hoverRating, setHoverRating] = useState(0);
  const calculateRatingFromEvent = (
    e: React.MouseEvent<HTMLDivElement>,
    starIndex: number
  ) => {
    const { left, width } = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - left;
    return starIndex + (x / width < 0.5 ? 0.5 : 1.0);
  };
  const displayRating = hoverRating > 0 ? hoverRating : rating;
  return (
    <div>
      {" "}
      <div className="flex justify-between items-center mb-1">
        {" "}
        <p className="text-sm font-medium text-gray-800">{title}</p>{" "}
        <p className="text-sm font-bold text-blue-600 w-8 text-right">
          {displayRating.toFixed(1)}
        </p>{" "}
      </div>{" "}
      <div className="flex" onMouseLeave={() => setHoverRating(0)}>
        {" "}
        {[...Array(5)].map((_, i) => {
          let fillType: "full" | "half" | "empty" = "empty";
          if (displayRating >= i + 1) fillType = "full";
          else if (displayRating > i) fillType = "half";
          return (
            <div
              key={i}
              className="cursor-pointer"
              onMouseMove={(e) =>
                setHoverRating(calculateRatingFromEvent(e, i))
              }
              onClick={(e) => onRatingChange(calculateRatingFromEvent(e, i))}
            >
              {" "}
              <StarIcon fillType={fillType} />{" "}
            </div>
          );
        })}{" "}
      </div>{" "}
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
  activeLanguage: string;
  onLanguageChange: (langCode: string) => void;
  translatedReports: Record<string, string>;
  translatingLanguages: Record<string, boolean>;
}> = ({
  editor,
  isMobileSidebarOpen,
  isDesktopSidebarCollapsed,
  onToggleMobileSidebar,
  onToggleDesktopSidebar,
  activeLanguage,
  onLanguageChange,
  translatedReports,
  translatingLanguages,
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
      )
        setTableDropdownOpen(false);
    };
    if (isTableDropdownOpen)
      document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isTableDropdownOpen]);
  const handleStyleChange = useCallback(
    (style: string) => {
      if (!editor) return;
      const defaultSize = PREDEFINED_SIZES[style];
      const chain = editor.chain().focus();
      if (style === "p") chain.setParagraph();
      else
        chain.setHeading({
          level: parseInt(style.replace("h", ""), 10) as 1 | 2 | 3,
        }); //@ts-ignore
      chain.setFontSize(defaultSize).run();
    },
    [editor]
  );
  const handleFontSizeChange = useCallback(
    (size: string) => {
      if (!editor) return; //@ts-ignore
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
    if (isDesktop) onToggleDesktopSidebar();
    else onToggleMobileSidebar();
  };
  return (
    <div className="flex-shrink-0 bg-white/80 backdrop-blur-md border-b border-white/20 shadow-sm p-2 flex items-center justify-between space-x-2 sticky top-0 z-20">
      {" "}
      <div className="flex items-center space-x-1">
        {" "}
        <ToolbarButton onClick={handleToggleClick} title="Toggle Sidebar">
          {" "}
          {isDesktop ? (
            isDesktopSidebarCollapsed ? (
              <PanelRightClose className="w-5 h-5" />
            ) : (
              <PanelLeftClose className="w-5 h-5" />
            )
          ) : isMobileSidebarOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}{" "}
        </ToolbarButton>{" "}
      </div>{" "}
      <div className="flex items-center space-x-1 flex-wrap justify-end">
        {" "}
        <div className="hidden sm:flex items-center space-x-1 border-l border-gray-300/50 pl-2 ml-2">
          {" "}
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!toolbarState.canUndo}
            title="Undo"
          >
            {" "}
            <Undo className="w-5 h-5" />{" "}
          </ToolbarButton>{" "}
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!toolbarState.canRedo}
            title="Redo"
          >
            {" "}
            <Redo className="w-5 h-5" />{" "}
          </ToolbarButton>{" "}
        </div>{" "}
        <div className="hidden md:flex items-center space-x-2 border-l border-gray-300/50 pl-2 ml-2">
          {" "}
          <CustomDropdown
            options={styleOptions}
            value={toolbarState.currentStyle}
            onChange={handleStyleChange}
            title="Text Style"
          />{" "}
          <CustomDropdown
            options={fontSizeOptions}
            value={toolbarState.currentFontSize}
            onChange={handleFontSizeChange}
            title="Font Size"
          />{" "}
        </div>{" "}
        <div className="flex items-center space-x-1 border-l border-gray-300/50 pl-2 ml-2">
          {" "}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={toolbarState.isBold}
            title="Bold"
          >
            {" "}
            <Bold className="w-5 h-5" />{" "}
          </ToolbarButton>{" "}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={toolbarState.isItalic}
            title="Italic"
          >
            {" "}
            <Italic className="w-5 h-5" />{" "}
          </ToolbarButton>{" "}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={toolbarState.isUnderline}
            title="Underline"
          >
            {" "}
            <UnderlineIcon className="w-5 h-5" />{" "}
          </ToolbarButton>{" "}
        </div>{" "}
        <div className="hidden lg:flex items-center space-x-1 border-l border-gray-300/50 pl-2 ml-2">
          {" "}
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            isActive={toolbarState.textAlign === "left"}
            title="Align Left"
          >
            {" "}
            <AlignLeft className="w-5 h-5" />{" "}
          </ToolbarButton>{" "}
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            isActive={toolbarState.textAlign === "center"}
            title="Align Center"
          >
            {" "}
            <AlignCenter className="w-5 h-5" />{" "}
          </ToolbarButton>{" "}
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            isActive={toolbarState.textAlign === "right"}
            title="Align Right"
          >
            {" "}
            <AlignRight className="w-5 h-5" />{" "}
          </ToolbarButton>{" "}
        </div>{" "}
        <div className="hidden sm:flex items-center space-x-1 border-l border-gray-300/50 pl-2 ml-2">
          {" "}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={toolbarState.isBulletList}
            title="Bulleted List"
          >
            {" "}
            <List className="w-5 h-5" />{" "}
          </ToolbarButton>{" "}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={toolbarState.isOrderedList}
            title="Numbered List"
          >
            {" "}
            <ListOrdered className="w-5 h-5" />{" "}
          </ToolbarButton>{" "}
          <div ref={tableMenuRef} className="relative">
            {" "}
            <ToolbarButton
              onClick={() => setTableDropdownOpen(!isTableDropdownOpen)}
              title="Insert Table"
            >
              {" "}
              <TableIcon className="w-5 h-5" />{" "}
            </ToolbarButton>{" "}
            {isTableDropdownOpen && (
              <TableCreationGrid
                editor={editor}
                close={() => setTableDropdownOpen(false)}
              />
            )}{" "}
          </div>{" "}
        </div>{" "}
        <div className="flex items-center space-x-1 border-l border-gray-300/50 pl-2 ml-2">
          {" "}
          <ReportLanguageSwitcher
            activeLanguage={activeLanguage}
            onLanguageChange={onLanguageChange}
            translatedReports={translatedReports}
            translatingLanguages={translatingLanguages}
          />{" "}
        </div>{" "}
      </div>{" "}
    </div>
  );
};

const EditorPlaceholder = ({ onStart }: { onStart: () => void }) => (
  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center bg-slate-50/50 backdrop-blur-sm p-4">
    {" "}
    <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
      {" "}
      <Upload className="w-12 h-12 text-indigo-600" />{" "}
    </div>{" "}
    <h3 className="text-2xl font-bold text-gray-900 mb-3">
      Ready for Scouting
    </h3>{" "}
    <p className="text-gray-600 mb-8 max-w-md mx-auto">
      {" "}
      Select a player and upload an audio file to generate a scouting report.{" "}
    </p>{" "}
    <button
      onClick={onStart}
      className="lg:hidden inline-flex items-center gap-2 px-6 py-3 bg-[#0e0c66] text-white font-semibold rounded-xl shadow-lg hover:bg-[#0e0c66]/90 transform hover:scale-105 transition-all duration-200"
    >
      {" "}
      <Sparkles className="w-5 h-5" /> <span>Start New Report</span>{" "}
    </button>{" "}
  </div>
);

const ScoutingPlatform: React.FC<ScoutingPlatformProps> = ({
  accessCode,
  reportId,
  reportType,
  onBackToDashboard,
}) => {
  // --- STATE (No Changes) ---
  const [currentReportId, setCurrentReportId] = useState<string | null>(
    reportId
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(!!reportId);
  const [processState, setProcessState] = useState<ProcessStatusProps>({
    status: "idle",
    message: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const [leagueStandings, setLeagueStandings] =
    useState<LeagueStandingsResponse | null>(null);
  const [seasonalStats, setSeasonalStats] = useState<SeasonalStat[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [originalReportHtml, setOriginalReportHtml] = useState<string | null>(
    null
  );
  const [translatedReports, setTranslatedReports] = useState<
    Record<string, string>
  >({});
  const [translatingLanguages, setTranslatingLanguages] = useState<
    Record<string, boolean>
  >({});
  const [activeLanguage, setActiveLanguage] = useState("EN");
  const [traitRatings, setTraitRatings] = useState<TraitRatings>({
    skating: 0,
    puckSkills: 0,
    hockeyIq: 0,
    shot: 0,
    competeLevel: 0,
    defensiveGame: 0,
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [transcriptionText, setTranscriptionText] = useState<string>("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [hasGeneratedReport, setHasGeneratedReport] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] =
    useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const [leagueSearchQuery, setLeagueSearchQuery] = useState("");
  const debouncedLeagueSearchQuery = useDebounce(leagueSearchQuery, 300);
  const [leagueSearchResults, setLeagueSearchResults] = useState<
    LeagueSearchResult[]
  >([]);
  const [isSearchingLeagues, setIsSearchingLeagues] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);

  const [teamASearchQuery, setTeamASearchQuery] = useState("");
  const debouncedTeamASearchQuery = useDebounce(teamASearchQuery, 300);
  const [teamASearchResults, setTeamASearchResults] = useState<
    TeamSearchResult[]
  >([]);
  const [isSearchingTeamA, setIsSearchingTeamA] = useState(false);
  const [teamA, setTeamA] = useState<Team | null>(null);

  const [teamBSearchQuery, setTeamBSearchQuery] = useState("");
  const debouncedTeamBSearchQuery = useDebounce(teamBSearchQuery, 300);
  const [teamBSearchResults, setTeamBSearchResults] = useState<
    TeamSearchResult[]
  >([]);
  const [isSearchingTeamB, setIsSearchingTeamB] = useState(false);
  const [teamB, setTeamB] = useState<Team | null>(null);

  const [teamAScore, setTeamAScore] = useState("");
  const [teamBScore, setTeamBScore] = useState("");

  const [gameDate, setGameDate] = useState<Date | undefined>(undefined);

  const [currentReportType, setCurrentReportType] = useState(reportType);

  // --- REFS (No Changes) ---
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);

  const activeLanguageRef = useRef(activeLanguage);

  // --- FUNCTIONS (No Changes until loadReportData) ---
  const applyFontSizes = (editorInstance: Editor) => {
    const { tr, doc } = editorInstance.state;
    let modified = false;
    doc.descendants((node, pos) => {
      if (!node.isTextblock) return;
      let size: string | undefined = undefined;
      if (node.type.name === "heading")
        size = PREDEFINED_SIZES[`h${node.attrs.level}`];
      else if (node.type.name === "paragraph") size = PREDEFINED_SIZES.p;
      if (size) {
        tr.addMark(
          pos + 1,
          pos + 1 + node.content.size,
          editorInstance.schema.marks.textStyle.create({ fontSize: size })
        );
        modified = true;
      }
    });
    if (modified) editorInstance.view.dispatch(tr);
  };

  const initEditor = useCallback(
    (content: any) => {
      if (editor) editor.destroy();
      const newEditor = new Editor({
        extensions: editorExtensions,
        content: content,
        editorProps: {
          attributes: {
            class: "prose max-w-none p-6 sm:p-8 focus:outline-none",
          },
        },
        onCreate: ({ editor: createdEditor }) => applyFontSizes(createdEditor),
        onUpdate: ({ editor: updatedEditor }) => {
          const currentHtml = updatedEditor.getHTML();

          if (activeLanguageRef.current === "EN") {
            setOriginalReportHtml(currentHtml);
          } else {
            setTranslatedReports((prev) => ({
              ...prev,
              [activeLanguageRef.current]: currentHtml,
            }));
          }
        },
      });
      setEditor(newEditor);
    },

    []
  );

  useEffect(() => {
    if (!reportId) {
      initEditor(marked.parse("") as string);
    }
    return () => editor?.destroy();
  }, [reportId, initEditor]);

  useEffect(() => {
    activeLanguageRef.current = activeLanguage;
  }, [activeLanguage]);

  useEffect(() => {
    const loadReportData = async (id: string) => {
      setIsLoadingReport(true);
      setProcessState({ status: "loading", message: "Loading report..." });
      try {
        const response = await fetch(`/api/reports/${id}`, {
          headers: { "X-Scout-Identifier": accessCode },
        });
        if (!response.ok)
          throw new Error("Could not load the specified report.");
        const data = await response.json();

        setSelectedPlayer(data.playerContext);
        setTraitRatings(data.traitRatings);
        setOriginalReportHtml(data.originalReportHtml);
        setTranslatedReports(data.translatedReports || {});
        setTranscriptionText(data.transcriptionText);
        setSeasonalStats(data.seasonalStatsContext || []);
        setLeagueStandings(data.leagueStandingsContext || null);
        setCurrentReportType(data.reportType || "skater");

        if (data.gameContext) {
          setSelectedLeague(data.gameContext.league || null);
          setTeamA(data.gameContext.teamA || null);
          setTeamB(data.gameContext.teamB || null);
          setTeamAScore(data.gameContext.teamAScore || "");
          setTeamBScore(data.gameContext.teamBScore || "");
          if (data.gameContext.gameDate) {
            setGameDate(new Date(data.gameContext.gameDate));
          }
        }

        initEditor(data.originalReportHtml);
        setHasGeneratedReport(true);
        setProcessState({
          status: "success",
          message: "Report loaded successfully!",
        });
      } catch (error: any) {
        showToast(error.message || "Failed to load report.", "error");
        setProcessState({ status: "error", message: "Failed to load report." });
        onBackToDashboard();
      } finally {
        setIsLoadingReport(false);
        setTimeout(
          () =>
            setProcessState((prev) =>
              prev.status === "success" || prev.status === "error"
                ? { ...prev, status: "idle" }
                : prev
            ),
          3000
        );
      }
    };
    if (reportId) loadReportData(reportId);
  }, [reportId, accessCode, onBackToDashboard, initEditor]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      )
        setIsExportMenuOpen(false);
    };
    if (isExportMenuOpen)
      document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isExportMenuOpen]);

  useEffect(() => {
    if (!editor) return;
    const newContent =
      activeLanguage === "EN"
        ? originalReportHtml
        : translatedReports[activeLanguage];
    if (newContent && editor.getHTML() !== newContent) {
      editor.commands.setContent(newContent, false, {
        preserveWhitespace: "full",
      });
      applyFontSizes(editor);
    }
  }, [activeLanguage, originalReportHtml, translatedReports, editor]);

  useEffect(() => {
    if (hasGeneratedReport)
      sidebarScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [hasGeneratedReport]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const validFiles = Array.from(files).filter((file) => {
        if (!file.type.startsWith("audio/")) {
          showToast(`Invalid file type: ${file.name}.`, "error");
          return false;
        }
        if (file.size / (1024 * 1024) > 100) {
          showToast(`${file.name} exceeds 100MB limit.`, "error");
          return false;
        }
        return true;
      });
      setSelectedFiles((prev) => [...prev, ...validFiles]);
      showToast(`${validFiles.length} file(s) selected!`, "success");
    }
  };

  const handleRemoveFile = (fileToRemove: File) =>
    setSelectedFiles((prev) => prev.filter((file) => file !== fileToRemove));

  const handleSelectPlayer = (player: Player) => {
    setSelectedPlayer(player);
    setSearchQuery("");
    setSearchResults([]);
    if (player.currentTeam) {
      setTeamA({
        id: player.currentTeam.id,
        name: player.currentTeam.name,
        shortName: player.currentTeam.shortName,
        country: player.currentTeam.country,
        slug: "",
        leagues: player.currentTeam.leagues,
      });
    }
  };
  const handleClearPlayer = () => {
    setSelectedPlayer(null);
    setSeasonalStats([]);
    setTeamA(null);
  };

  const handleRatingChange = useCallback(
    (trait: keyof TraitRatings, newRating: number) =>
      setTraitRatings((prev) => ({ ...prev, [trait]: newRating })),
    []
  );
  const handleLanguageSelectionChange = (langCode: string) =>
    setSelectedLanguages((prev) =>
      prev.includes(langCode)
        ? prev.filter((code) => code !== langCode)
        : [...prev, langCode]
    );

  useEffect(() => {
    if (debouncedSearchQuery.length < 2 || selectedPlayer) {
      setSearchResults([]);
      return;
    }
    const fetchPlayers = async () => {
      setIsSearching(true);
      try {
        const response = await fetch("https://api.graet.com", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `query SearchUsersQuery($usersFilter: UsersFilter!, $first: Int) { users: searchUsers(filter: $usersFilter, first: $first) { edges { node { id slug role firstname lastname name country dateOfBirth possibleYearsOfBirth avatar bio { position gender playerType handedness height { centimeters inches } weight { kilograms pounds } } currentTeam { id name country shortName hasGames leagues { id name } } stats { career { gamesPlayed goals assists points pointsPerGame gaa shutouts svp wins losses ties } season { gamesPlayed goals assists points pointsPerGame gaa shutouts svp wins losses ties } } } } pageInfo { hasNextPage endCursor } } }`,
            variables: {
              usersFilter: { searchQuery: debouncedSearchQuery },
              first: 10,
            },
          }),
        });
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const result = await response.json();
        if (result.errors)
          throw new Error(result.errors.map((e: any) => e.message).join("\n"));
        setSearchResults(result.data?.users?.edges || []);
      } catch (error: any) {
        showToast(`Could not fetch players: ${error.message}`, "error");
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };
    fetchPlayers();
  }, [debouncedSearchQuery, selectedPlayer]);

  useEffect(() => {
    if (debouncedTeamASearchQuery.length < 2 || teamA) {
      setTeamASearchResults([]);
      return;
    }
    const fetchTeams = async () => {
      setIsSearchingTeamA(true);
      try {
        const response = await fetch("https://api.graet.com", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `query SearchTeams($filter: TeamsFilter!, $pagination: Pagination) { teams(filter: $filter, pagination: $pagination) { edges { node { id name shortName country slug leagues { id name } } } } }`,
            variables: {
              filter: { searchQuery: debouncedTeamASearchQuery },
              pagination: { first: 10 },
            },
          }),
        });
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const result = await response.json();
        if (result.errors)
          throw new Error(result.errors.map((e: any) => e.message).join("\n"));
        setTeamASearchResults(result.data?.teams?.edges || []);
      } catch (error: any) {
        toast.error(`Could not fetch teams for Team A: ${error.message}`);
        setTeamASearchResults([]);
      } finally {
        setIsSearchingTeamA(false);
      }
    };
    fetchTeams();
  }, [debouncedTeamASearchQuery, teamA]);

  useEffect(() => {
    if (debouncedTeamBSearchQuery.length < 2 || teamB) {
      setTeamBSearchResults([]);
      return;
    }
    const fetchTeams = async () => {
      setIsSearchingTeamB(true);
      try {
        const response = await fetch("https://api.graet.com", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `query SearchTeams($filter: TeamsFilter!, $pagination: Pagination) { teams(filter: $filter, pagination: $pagination) { edges { node { id name shortName country slug leagues { id name } } } } }`,
            variables: {
              filter: { searchQuery: debouncedTeamBSearchQuery },
              pagination: { first: 10 },
            },
          }),
        });
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const result = await response.json();
        if (result.errors)
          throw new Error(result.errors.map((e: any) => e.message).join("\n"));
        setTeamBSearchResults(result.data?.teams?.edges || []);
      } catch (error: any) {
        toast.error(`Could not fetch teams for Team B: ${error.message}`);
        setTeamBSearchResults([]);
      } finally {
        setIsSearchingTeamB(false);
      }
    };
    fetchTeams();
  }, [debouncedTeamBSearchQuery, teamB]);

  useEffect(() => {
    if (debouncedLeagueSearchQuery.length < 2 || selectedLeague) {
      setLeagueSearchResults([]);
      return;
    }
    const fetchLeagues = async () => {
      setIsSearchingLeagues(true);
      try {
        const response = await fetch("https://api.graet.com", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `query SearchLeagues($filter: LeaguesFilter!, $pagination: Pagination) { leagues(filter: $filter, pagination: $pagination) { edges { node { id name type level genderCategory countries } } } }`,
            variables: {
              filter: {
                searchQuery: debouncedLeagueSearchQuery,
                countries: null,
              },
              pagination: { first: 10 },
            },
          }),
        });
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const result = await response.json();
        if (result.errors)
          throw new Error(result.errors.map((e: any) => e.message).join("\n"));
        setLeagueSearchResults(result.data?.leagues?.edges || []);
      } catch (error: any) {
        toast.error(`Could not fetch leagues: ${error.message}`);
        setLeagueSearchResults([]);
      } finally {
        setIsSearchingLeagues(false);
      }
    };
    fetchLeagues();
  }, [debouncedLeagueSearchQuery, selectedLeague]);

  useEffect(() => {
    const fetchLeagueStandings = async () => {
      if (!teamA || !teamA.leagues?.[0]?.id) {
        setLeagueStandings(null);
        return;
      }
      setProcessState({
        status: "loading",
        message: "Fetching league standings...",
      });
      try {
        const response = await fetch("https://api.graet.com", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `query SearchLeagueStandings($leagueId: ObjectId!, $season: String, $teamId: ObjectId) { leagueStandings(leagueId: $leagueId, season: $season, teamId: $teamId) { league { id name } groups { group standings { id team { id name } } } } }`,
            variables: {
              leagueId: teamA.leagues[0].id,
              season: "2024-2025",
              teamId: teamA.id,
            },
          }),
        });
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const result = await response.json();
        if (result.errors)
          throw new Error(result.errors.map((e: any) => e.message).join("\n"));
        setLeagueStandings(result.data?.leagueStandings);
        setProcessState({
          status: "success",
          message: "League standings loaded!",
        });
      } catch (error: any) {
        setProcessState({
          status: "error",
          message: `Could not fetch standings: ${error.message}`,
        });
        setLeagueStandings(null);
      } finally {
        setTimeout(
          () =>
            setProcessState((prev) =>
              prev.status === "success" || prev.status === "error"
                ? { ...prev, status: "idle" }
                : prev
            ),
          3000
        );
      }
    };
    fetchLeagueStandings();
  }, [teamA]);

  useEffect(() => {
    if (!selectedPlayer) {
      setSeasonalStats([]);
      return;
    }
    const fetchSeasonalStats = async () => {
      setProcessState({
        status: "loading",
        message: "Fetching player stats...",
      });
      try {
        const response = await fetch("https://api.graet.com", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `query GetUserStats($statsFilter: UserStatsFilter!, $statsPage: Pagination) { seasons: userStats(filter: $statsFilter, pagination: $statsPage) { edges { node { team { name shortName } user { name id } externalInfo { externalLeagueName externalPlayerName externalTeamName } position season seasonType gamesPlayed goals assists points plusMinus pim wins losses ties gaa svp shutouts toi } } } }`,
            variables: {
              statsFilter: { user: selectedPlayer.id },
              statsPage: { first: 100 },
            },
          }),
        });
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const result = await response.json();
        if (result.errors)
          throw new Error(result.errors.map((e: any) => e.message).join("\n"));
        setSeasonalStats(result.data?.seasons?.edges || []);
        setProcessState({ status: "success", message: "Player stats loaded!" });
      } catch (error: any) {
        setProcessState({
          status: "error",
          message: `Could not fetch player stats: ${error.message}`,
        });
        setSeasonalStats([]);
      } finally {
        setTimeout(
          () =>
            setProcessState((prev) =>
              prev.status === "success" || prev.status === "error"
                ? { ...prev, status: "idle" }
                : prev
            ),
          3000
        );
      }
    };
    fetchSeasonalStats();
  }, [selectedPlayer]);

  const handleTranslateReport = async (
    reportHtml: string,
    targetLangCode: string
  ) => {
    const targetLanguage = AVAILABLE_LANGUAGES.find(
      (l) => l.code === targetLangCode
    );
    if (!targetLanguage) return;
    setTranslatingLanguages((prev) => ({ ...prev, [targetLangCode]: true }));
    const toastId = showToast(
      `Translating to ${targetLanguage.name}...`,
      "loading"
    );
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportText: reportHtml,
          targetLang: targetLanguage.name,
        }),
      });
      if (!response.ok)
        throw new Error(`Translation to ${targetLanguage.name} failed`);
      const data = await response.json();
      setTranslatedReports((prev) => ({
        ...prev,
        [targetLangCode]: marked.parse(data.translatedText) as string,
      }));
      showToast(`Translated to ${targetLanguage.name}!`, "success", {
        id: toastId,
      });
    } catch (error: any) {
      showToast(`Could not translate to ${targetLanguage.name}.`, "error", {
        id: toastId,
      });
    } finally {
      setTranslatingLanguages((prev) => ({ ...prev, [targetLangCode]: false }));
    }
  };

  const triggerAllTranslations = (reportHtml: string) =>
    selectedLanguages.forEach((langCode) =>
      handleTranslateReport(reportHtml, langCode)
    );

  const handleProcessAudio = async () => {
    if (
      selectedFiles.length === 0 ||
      !selectedPlayer ||
      !teamA ||
      !teamB ||
      !selectedLeague
    ) {
      toast.error(
        "Please select a player, league, both game teams, and an audio file."
      );
      return;
    }
    setOriginalReportHtml(null);
    setTranslatedReports({});
    setTranslatingLanguages({});
    setActiveLanguage("EN");
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      showToast("API Key is not configured.", "error");
      return;
    }

    const allTranscriptions: string[] = [];
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setProcessState({
          status: "transcribing",
          message: `Transcribing file ${i + 1} of ${selectedFiles.length}...`,
        });
        const singleTranscription =
          file.size / (1024 * 1024) > 20
            ? await handleResumableUploadAndTranscribe(
                file,
                apiKey,
                selectedPlayer,
                teamA,
                leagueStandings
              )
            : await handleInlineUploadAndTranscribe(
                file,
                apiKey,
                selectedPlayer,
                teamA,
                leagueStandings
              );
        allTranscriptions.push(singleTranscription);
      }
    } catch (error: any) {
      setProcessState({
        status: "error",
        message: `Transcription failed: ${error.message}`,
      });
      return;
    }

    const combinedTranscription = allTranscriptions
      .map((text, index) => `--- File ${index + 1} ---\n${text}`)
      .join("\n\n");
    setTranscriptionText(combinedTranscription);

    setProcessState({
      status: "generating",
      message: "Generating scout report...",
    });
    try {
      const generateResponse = await fetch("/api/report-openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcription: combinedTranscription,
          playerContext: selectedPlayer,
          teamContext: teamA,
          standingsContext: leagueStandings,
          seasonalStatsContext: seasonalStats,
          gameContext: {
            league: selectedLeague,
            teamA: teamA,
            teamB: teamB,
            teamAScore: teamAScore,
            teamBScore: teamBScore,
            gameDate: gameDate ? format(gameDate, "yyyy-MM-dd") : null,
          },
        }),
      });
      if (!generateResponse.ok)
        throw new Error(await getErrorMessage(generateResponse));
      const data = await generateResponse.json();
      const finalHtml = marked.parse(data.report) as string;
      setOriginalReportHtml(finalHtml);
      initEditor(finalHtml);
      setHasGeneratedReport(true);
      if (window.innerWidth < 1024) setIsMobileSidebarOpen(false);
      setProcessState({
        status: "success",
        message: "Report generated successfully!",
      });
      triggerAllTranslations(data.report);
    } catch (error: any) {
      setProcessState({
        status: "error",
        message: `Report generation failed: ${error.message}`,
      });
    } finally {
      setTimeout(
        () =>
          setProcessState((prev) =>
            prev.status === "success" || prev.status === "error"
              ? { ...prev, status: "idle" }
              : prev
          ),
        5000
      );
    }
  };

  const handleInlineUploadAndTranscribe = async (
    file: File,
    apiKey: string,
    player: Player,
    team: Team,
    standings: LeagueStandingsResponse | null
  ): Promise<string> => {
    const audioBase64 = arrayBufferToBase64(await file.arrayBuffer());
    const standingsContext = standings?.groups
      ? `For context, the teams in this league include: ${Array.from(
          new Set(
            standings.groups.flatMap((g) => g.standings.map((s) => s.team.name))
          )
        ).join(", ")}.`
      : "";
    const promptText = `You are a highly specialized hockey transcription assistant. Your primary goal is to produce a clean, accurate transcript of a scout's audio notes. **Transcription Rules:** 1. **Accuracy First:** Focus on clarity and accuracy. 2. **Team & League Names:** Correctly identify and spell the full names of teams and leagues. Use proper capitalization for these proper nouns (e.g., "Leksands IF", "SHL"). ${standingsContext} 3. **Hockey Terminology (Crucial):** Do NOT capitalize common hockey-specific technical terms, even if they are also proper nouns in other contexts. Treat them as common nouns. - **Correct Examples:** mohawk turn, texas hockey, michigan goal, slapshot, crossover, backcheck. - **Incorrect Examples:** Mohawk Turn, Texas Hockey, Michigan Goal. **Audio for Player:** ${player.name} of ${team.name}.`;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: file.type, data: audioBase64 } },
                { text: promptText },
              ],
            },
          ],
          generationConfig: { temperature: 0 },
        }),
      }
    );
    if (!response.ok) throw new Error(await getErrorMessage(response));
    const data = await response.json();
    if (data.candidates?.[0].content.parts[0].text)
      return data.candidates[0].content.parts[0].text;
    throw new Error("Could not find transcription in API response.");
  };

  const handleResumableUploadAndTranscribe = async (
    file: File,
    apiKey: string,
    player: Player,
    team: Team,
    standings: LeagueStandingsResponse | null
  ): Promise<string> => {
    let fileNameOnServer = "";
    try {
      const startRes = await fetch(
        `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "X-Goog-Upload-Protocol": "resumable",
            "X-Goog-Upload-Command": "start",
            "X-Goog-Upload-Header-Content-Length": file.size.toString(),
            "X-Goog-Upload-Header-Content-Type": file.type,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ file: { display_name: file.name } }),
        }
      );
      if (!startRes.ok) throw new Error(await getErrorMessage(startRes));
      const uploadUrl = startRes.headers.get("x-goog-upload-url");
      if (!uploadUrl) throw new Error("Could not get resumable upload URL.");
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Length": file.size.toString(),
          "X-Goog-Upload-Offset": "0",
          "X-Goog-Upload-Command": "upload, finalize",
        },
        body: file,
      });
      if (!uploadRes.ok) throw new Error(await getErrorMessage(uploadRes));
      const fileInfo = await uploadRes.json();
      const fileUri = fileInfo.file.uri;
      fileNameOnServer = fileInfo.file.name;
      const standingsContext = standings?.groups
        ? `For context, the teams in this league include: ${Array.from(
            new Set(
              standings.groups.flatMap((g) =>
                g.standings.map((s) => s.team.name)
              )
            )
          ).join(", ")}.`
        : "";
      const promptText = `You are a highly specialized hockey transcription assistant. Your primary goal is to produce a clean, accurate transcript of a scout's audio notes. **Transcription Rules:** 1. **Accuracy First:** Focus on clarity and accuracy. 2. **Team & League Names:** Correctly identify and spell the full names of teams and leagues. Use proper capitalization for these proper nouns (e.g., "Leksands IF", "SHL"). ${standingsContext} 3. **Hockey Terminology (Crucial):** Do NOT capitalize common hockey-specific technical terms, even if they are also proper nouns in other contexts. Treat them as common nouns. - **Correct Examples:** mohawk turn, texas hockey, michigan goal, slapshot, crossover, backcheck. - **Incorrect Examples:** Mohawk Turn, Texas Hockey, Michigan Goal. **Audio for Player:** ${player.name} of ${team.name}.`;
      const genRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: promptText },
                  { file_data: { mime_type: file.type, file_uri: fileUri } },
                ],
              },
            ],
            generationConfig: { temperature: 0 },
          }),
        }
      );
      if (!genRes.ok) throw new Error(await getErrorMessage(genRes));
      const data = await genRes.json();
      if (data.candidates?.[0].content.parts[0].text)
        return data.candidates[0].content.parts[0].text;
      throw new Error("Could not find transcription in API response.");
    } finally {
      if (fileNameOnServer)
        await fetch(
          `https://generativelanguage.googleapis.com/v1beta/${fileNameOnServer}?key=${apiKey}`,
          { method: "DELETE" }
        );
    }
  };

  const handleSaveReport = async () => {
    if (!selectedPlayer) {
      showToast("Cannot save without a selected player.", "error");
      return;
    }
    setIsSaving(true);
    const toastId = showToast("Saving report...", "loading");

    const reportData = {
      reportType: currentReportType,
      playerContext: selectedPlayer,
      teamContext: teamA,
      traitRatings,
      originalReportHtml,
      translatedReports,
      transcriptionText,
      seasonalStatsContext: seasonalStats,
      leagueStandingsContext: leagueStandings,
      gameContext: {
        league: selectedLeague,
        teamA: teamA,
        teamB: teamB,
        teamAScore: teamAScore,
        teamBScore: teamBScore,
        gameDate: gameDate ? format(gameDate, "yyyy-MM-dd") : null,
      },
    };

    try {
      const url = currentReportId
        ? `/api/reports/${currentReportId}`
        : "/api/reports";
      const method = currentReportId ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Scout-Identifier": accessCode,
        },
        body: JSON.stringify(reportData),
      });
      if (!response.ok)
        throw new Error(
          (await response.json()).error || "Failed to save the report."
        );
      const savedReport = await response.json();
      if (!currentReportId) setCurrentReportId(savedReport._id);
      showToast("Report saved successfully!", "success", { id: toastId });
    } catch (error: any) {
      showToast(error.message || "Could not save report.", "error", {
        id: toastId,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async (format: "pdf" | "txt") => {
    if (!editor) return;
    if (
      hasGeneratedReport &&
      Object.values(traitRatings).some((r) => r === 0)
    ) {
      showToast("Please rate all player traits before exporting.", "error");
      setIsExportMenuOpen(false);
      return;
    }
    setIsExportMenuOpen(false);
    const fileName = `${(
      editor.state.doc.firstChild?.textContent || "Scouting Report"
    )
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase()}.${format}`;
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
      downloadFile(
        new Blob([editor.getText()], { type: "text/plain" }),
        fileName
      );
      showToast("Exported as TXT!", "success");
      return;
    }
    if (format === "pdf") {
      const toastId = showToast("Generating PDF...", "loading");
      try {
        const response = await fetch("/api/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerContext: selectedPlayer,
            teamContext: teamA,
            standingsContext: leagueStandings,
            seasonalStatsContext: seasonalStats,
            reportHtml: editor.getHTML(),
            reportHtmlBlueprint: originalReportHtml,
            traitRatings,
            targetLang: activeLanguage,
            gameContext: {
              league: selectedLeague,
              teamA: teamA,
              teamB: teamB,
              teamAScore: teamAScore,
              teamBScore: teamBScore,
              gameDate: gameDate ? gameDate.toISOString() : null,
            },
          }),
        });
        if (!response.ok)
          throw new Error(`PDF generation failed: ${response.statusText}`);
        downloadFile(await response.blob(), fileName);
        showToast("PDF downloaded!", "success", { id: toastId });
      } catch (error: any) {
        showToast(`Could not generate PDF: ${error.message}`, "error", {
          id: toastId,
        });
      }
    }
  };

  const isLoading =
    processState.status === "transcribing" ||
    processState.status === "generating" ||
    processState.status === "loading";
  const buttonText =
    processState.status === "transcribing"
      ? "Transcribing..."
      : processState.status === "generating"
      ? "Generating..."
      : processState.status === "loading"
      ? "Loading Context..."
      : "Generate Report";

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col font-sans text-black overflow-hidden">
      <Toaster position="top-center" />
      <header className="bg-white/80 backdrop-blur-md border-b border-white/20 shadow-sm sticky top-0 z-30 flex-shrink-0">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBackToDashboard}
                title="Back to Dashboard"
                className="p-2 rounded-full hover:bg-gray-200/70 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <Image src={logo2} alt="GRAET Logo" width={100} priority />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveReport}
                disabled={isSaving || isLoadingReport || !hasGeneratedReport}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#0e0c66] text-white font-semibold rounded-lg shadow-md hover:bg-[#0e0c66]/90 transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:scale-100"
              >
                {isSaving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                <span className="hidden sm:inline">Save</span>
              </button>
              <div ref={exportMenuRef} className="relative">
                <button
                  onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                  disabled={!hasGeneratedReport || isLoadingReport}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#0e0c66] text-white font-semibold rounded-lg shadow-md hover:bg-[#0e0c66]/90 transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:scale-100"
                >
                  <FileDown className="w-5 h-5" />
                  <span className="hidden sm:inline">Export</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                {isExportMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    <button
                      onClick={() => handleExport("pdf")}
                      className="w-full text-left flex items-center space-x-2 p-2 text-sm hover:bg-gray-100"
                    >
                      {" "}
                      <FileDown className="w-4 h-4 text-red-600" />{" "}
                      <span>Save as PDF</span>{" "}
                    </button>
                    <button
                      onClick={() => handleExport("txt")}
                      className="w-full text-left flex items-center space-x-2 p-2 text-sm hover:bg-gray-100"
                    >
                      {" "}
                      <FileText className="w-4 h-4 text-gray-600" />{" "}
                      <span>Save as Text</span>{" "}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 relative">
        {isLoadingReport && !reportId && (
          <div className="absolute inset-0 bg-white/80 z-50 flex items-center justify-center">
            <Loader2 className="w-12 h-12 animate-spin text-[#0e0c66]" />
          </div>
        )}

        <aside
          className={`flex-shrink-0 bg-white/60 backdrop-blur-md border-r border-white/30 flex flex-col z-40 transition-all duration-300 ease-in-out lg:relative ${
            isDesktopSidebarCollapsed ? "lg:w-0" : "lg:w-[420px]"
          } absolute top-0 left-0 h-full max-w-md sm:w-96 lg:max-w-none transform ${
            isMobileSidebarOpen
              ? "translate-x-0 shadow-lg"
              : "-translate-x-full"
          } lg:translate-x-0 lg:shadow-none`}
        >
          <div
            className={`flex-1 flex flex-col min-h-0 ${
              isDesktopSidebarCollapsed ? "lg:hidden" : ""
            }`}
          >
            <div
              ref={sidebarScrollRef}
              className="flex-1 space-y-8 min-h-0 overflow-y-auto p-6"
            >
              {hasGeneratedReport && (
                <div className="pb-4">
                  <h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent mb-4">
                    {" "}
                    Rate Player Traits{" "}
                  </h2>
                  <div className="space-y-4">
                    <RatingScaleLegend />
                    <TraitRatingSelector
                      title="Skating"
                      rating={traitRatings.skating}
                      onRatingChange={(r) => handleRatingChange("skating", r)}
                    />
                    <TraitRatingSelector
                      title="Puck Skills"
                      rating={traitRatings.puckSkills}
                      onRatingChange={(r) =>
                        handleRatingChange("puckSkills", r)
                      }
                    />
                    <TraitRatingSelector
                      title="Hockey IQ"
                      rating={traitRatings.hockeyIq}
                      onRatingChange={(r) => handleRatingChange("hockeyIq", r)}
                    />
                    <TraitRatingSelector
                      title="Shot"
                      rating={traitRatings.shot}
                      onRatingChange={(r) => handleRatingChange("shot", r)}
                    />
                    <TraitRatingSelector
                      title="Compete Level"
                      rating={traitRatings.competeLevel}
                      onRatingChange={(r) =>
                        handleRatingChange("competeLevel", r)
                      }
                    />
                    <TraitRatingSelector
                      title="Defensive Game"
                      rating={traitRatings.defensiveGame}
                      onRatingChange={(r) =>
                        handleRatingChange("defensiveGame", r)
                      }
                    />
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

              <div className="space-y-6">
                <h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Scouted Game Details
                </h2>
                <LeagueSearch
                  searchQuery={leagueSearchQuery}
                  onSearchChange={setLeagueSearchQuery}
                  searchResults={leagueSearchResults}
                  isSearching={isSearchingLeagues}
                  selectedLeague={selectedLeague}
                  onSelectLeague={(league) => {
                    setSelectedLeague(league);
                    setLeagueSearchQuery("");
                    setLeagueSearchResults([]);
                  }}
                  onClearLeague={() => setSelectedLeague(null)}
                />
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    Game Date
                  </h3>
                  <MaskedDatePicker
                    selectedDate={gameDate}
                    onDateChange={setGameDate}
                  />
                </div>
                <TeamSearch
                  title="Team A"
                  searchQuery={teamASearchQuery}
                  onSearchChange={setTeamASearchQuery}
                  searchResults={teamASearchResults}
                  isSearching={isSearchingTeamA}
                  selectedTeam={teamA}
                  onSelectTeam={(team) => {
                    setTeamA(team);
                    setTeamASearchQuery("");
                    setTeamASearchResults([]);
                  }}
                  onClearTeam={() => setTeamA(null)}
                />
                <TeamSearch
                  title="Team B"
                  searchQuery={teamBSearchQuery}
                  onSearchChange={setTeamBSearchQuery}
                  searchResults={teamBSearchResults}
                  isSearching={isSearchingTeamB}
                  selectedTeam={teamB}
                  onSelectTeam={(team) => {
                    setTeamB(team);
                    setTeamBSearchQuery("");
                    setTeamBSearchResults([]);
                  }}
                  onClearTeam={() => setTeamB(null)}
                />
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    Final Score
                  </h3>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      placeholder="Team A"
                      value={teamAScore}
                      onChange={(e) => setTeamAScore(e.target.value)}
                      className="block w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/70 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 shadow-sm placeholder-gray-500 text-center"
                    />
                    <span className="font-bold text-gray-500">:</span>
                    <input
                      type="number"
                      placeholder="Team B"
                      value={teamBScore}
                      onChange={(e) => setTeamBScore(e.target.value)}
                      className="block w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/70 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 shadow-sm placeholder-gray-500 text-center"
                    />
                  </div>
                </div>
              </div>

              <LanguageSelector
                selectedLanguages={selectedLanguages}
                onSelectionChange={handleLanguageSelectionChange}
              />

              <div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent mb-4">
                  {" "}
                  Upload Audio{" "}
                </h2>
                <label
                  htmlFor="file-upload"
                  className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-indigo-500 hover:bg-indigo-50/50 cursor-pointer transition-colors block"
                >
                  <div className="flex flex-col items-center justify-center">
                    <Upload className="mx-auto w-10 h-10 text-gray-400 mb-2" />
                    <p className="text-sm font-semibold text-indigo-700">
                      {" "}
                      Click to upload or drag and drop{" "}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {" "}
                      MP3, WAV, M4A (100MB limit){" "}
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
                    <p className="text-sm font-medium text-gray-800">
                      Selected files:
                    </p>
                    {selectedFiles.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex items-center justify-between p-3 border border-gray-200/80 rounded-xl bg-white/70 backdrop-blur-sm shadow-sm hover:bg-white/90 transition-colors"
                      >
                        <div className="flex items-center space-x-3 truncate">
                          <FileText className="w-5 h-5 text-indigo-500 flex-shrink-0" />
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
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors flex-shrink-0"
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
                <h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent mb-4">
                  {" "}
                  Review Transcription{" "}
                </h2>
                <textarea
                  value={transcriptionText}
                  onChange={(e) => setTranscriptionText(e.target.value)}
                  className="flex-1 w-full p-4 border border-gray-200 rounded-xl bg-white/70 text-sm text-gray-800 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Your audio transcription will appear here..."
                />
              </div>
            </div>

            <div className="flex-shrink-0 p-6 pt-4 space-y-4 border-t border-white/30">
              <ProcessStatus
                status={processState.status}
                message={processState.message}
              />
              <button
                onClick={handleProcessAudio}
                disabled={
                  isLoading ||
                  selectedFiles.length === 0 ||
                  !selectedPlayer ||
                  !selectedLeague ||
                  !teamA ||
                  !teamB
                }
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#0e0c66] text-white font-semibold rounded-xl shadow-lg hover:bg-[#0e0c66]/90 transform hover:scale-105 transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:scale-100"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
                <span>{buttonText}</span>
              </button>
            </div>
          </div>
        </aside>

        {isMobileSidebarOpen && (
          <div
            onClick={() => setIsMobileSidebarOpen(false)}
            className="lg:hidden absolute inset-0 bg-white/20 backdrop-blur-sm z-30"
          ></div>
        )}

        <main className="flex-1 bg-transparent flex flex-col relative">
          <EditorToolbar
            editor={editor}
            isMobileSidebarOpen={isMobileSidebarOpen}
            isDesktopSidebarCollapsed={isDesktopSidebarCollapsed}
            onToggleMobileSidebar={() =>
              setIsMobileSidebarOpen(!isMobileSidebarOpen)
            }
            onToggleDesktopSidebar={() =>
              setIsDesktopSidebarCollapsed(!isDesktopSidebarCollapsed)
            }
            activeLanguage={activeLanguage}
            onLanguageChange={setActiveLanguage}
            translatedReports={translatedReports}
            translatingLanguages={translatingLanguages}
          />
          {editor && (
            <>
              <BubbleMenu
                editor={editor}
                tippyOptions={{ duration: 100, placement: "top" }}
                shouldShow={({ editor }) => {
                  const { selection } = editor.state;
                  const { $from, empty } = selection;
                  if (empty || $from.depth < 2) return false;
                  return !editor.isActive("table");
                }}
                className="flex items-center space-x-1 bg-black text-white p-2 rounded-lg shadow-xl"
              >
                <button
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={`p-1 ${
                    editor.isActive("bold") ? "bg-gray-700" : ""
                  } rounded`}
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={`p-1 ${
                    editor.isActive("italic") ? "bg-gray-700" : ""
                  } rounded`}
                >
                  <Italic className="w-4 h-4" />
                </button>
              </BubbleMenu>
              <TableMenus editor={editor} />
              <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
                <div className="bg-white min-h-full rounded-2xl shadow-lg border border-gray-200/50">
                  <EditorContent editor={editor} />
                </div>
              </div>
            </>
          )}
          {!hasGeneratedReport && (
            <EditorPlaceholder onStart={() => setIsMobileSidebarOpen(true)} />
          )}
        </main>
      </div>
    </div>
  );
};

export default ScoutingPlatform;

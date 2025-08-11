import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import React from "react";
import {
  pdf,
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Svg,
  Defs,
  LinearGradient,
  ClipPath,
  Stop,
  Rect,
  Path,
  Image,
} from "@react-pdf/renderer";
import { parse, HTMLElement, Node } from "node-html-parser";
import QRCode from "qrcode";
import { type Style } from "@react-pdf/types";

// --- 1. TRANSLATION & LOCALE HELPERS ---

async function getTranslations(lang: string) {
  const langCode = lang.toLowerCase();
  const defaultLang = "en";

  const loadFile = async (code: string) => {
    try {
      const filePath = path.join(
        process.cwd(),
        "app",
        "lib",
        "pdf-translations",
        `${code}.json`
      );
      const fileContent = await fs.readFile(filePath, "utf-8");
      return JSON.parse(fileContent);
    } catch (error) {
      console.warn(
        `Translations for '${code}' not found. Attempting to fall back to English.`
      );
      return null;
    }
  };

  let translations = await loadFile(langCode);
  if (!translations) {
    translations = await loadFile(defaultLang);
    if (!translations) {
      throw new Error("Default English translation file (en.json) is missing.");
    }
  }

  return translations;
}

const formatPosition = (rawPosition: string | null | undefined): string => {
  if (!rawPosition) return 'N/A';
  switch (rawPosition) {
    case 'CENTER': return 'CENTER';
    case 'LEFT_WING': return 'LEFT WING';
    case 'RIGHT_WING': return 'RIGHT WING';
    case 'LEFT_DEFENSIVE': return 'LEFT DEFENSEMAN';
    case 'RIGHT_DEFENSIVE': return 'RIGHT DEFENSEMAN';
    case 'DEFENDER': return 'DEFENDER';
    case 'GOALTENDER': return 'GOALIE';
    default: return rawPosition;
  }
};

const getLocaleForLang = (lang: string) => {
  const map: { [key: string]: string } = {
    se: "sv-SE",
    fi: "fi-FI",
    cz: "cs-CZ",
    sk: "sk-SK",
    ru: "ru-RU",
    de: "de-DE",
    fr: "fr-FR",
    ge: "ka-GE",
    en: "en-US",
  };
  return map[lang.toLowerCase()] || "en-US";
};


type GameDetails = {
  teamA: { name: string; score: number | null };
  teamB: { name: string; score: number | null };
  gameDate: string | null;
  league: string | null;
};

type TraitRatings = {
  // Skater
  skating: number;
  puckSkills: number;
  hockeyIq: number;
  shot: number;
  competeLevel: number;
  defensiveGame: number;
  // Goalie
  creaseMobility: number;
  positioningAngles: number;
  puckTracking: number;
  saveExecution: number;
  mentalToughness: number;
  puckHandling: number;
};

type ReportSection = {
  title: string;
  html: string;
};

// --- 2. FONT REGISTRATION (No Changes) ---
Font.register({
  family: "DejaVu",
  fonts: [
    {
      src: "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf",
    },
    {
      src: "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf",
      fontWeight: "bold",
    },
    {
      src: "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Oblique.ttf",
      fontStyle: "italic",
    },
    {
      src: "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-BoldOblique.ttf",
      fontWeight: "bold",
      fontStyle: "italic",
    },
  ],
});

Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  pageTitle: {
    fontWeight: "bold",
    fontStyle: "italic",
    fontSize: 32,
    color: "#161160",
    textAlign: "center",
    textTransform: "uppercase",
    marginBottom: 16,
  },
  pageSubHeader: {
    fontWeight: "bold",
    fontStyle: "italic",
    fontSize: 14,
    color: "#161160",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  pageBodyText: {
    fontSize: 11,
    lineHeight: 1.5,
    color: "#374151",
    textAlign: "justify",
  },

  // General Styles
  page: { fontFamily: "DejaVu", backgroundColor: "#FFFFFF" },
  contentWrapper: { padding: 40 },
  backgroundSvg: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    zIndex: -1,
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  logoPlaceholder: { width: 90, height: 21, fontSize: 10, color: "#525986" },
  pageNumber: {
    fontStyle: "italic",
    fontSize: 10,
    color: "#525986",
    textTransform: "uppercase",
  },

  // Player Attributes Page Styles
  playerInfoPageContainer: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  header: { alignItems: "center", gap: 12, width: "100%" },
  playerName: {
    fontWeight: "bold",
    fontStyle: "italic",
    fontSize: 48,
    color: "#161160",
    textAlign: "center",
    textTransform: "uppercase",
  },
  playerPosition: {
    fontWeight: "bold",
    fontStyle: "italic",
    fontSize: 24,
    color: "#161160",
    textAlign: "center",
    textTransform: "uppercase",
  },
  infoSection: { flexDirection: "column", gap: 24 },
  infoRow: { flexDirection: "row" },
  infoBlock: { flexDirection: "column", gap: 8, width: "80%" },
  infoLabel: { fontSize: 12, color: "#525986", textTransform: "uppercase" },
  infoValue: {
    fontWeight: "bold",
    fontStyle: "italic",
    fontSize: 18,
    color: "#161160",
    textTransform: "uppercase",
  },
  qrCodeSection: {
    backgroundColor: "#E8E6F9",
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
    marginBottom: 80,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  qrCodeTextBlock: {
    flex: 1,
    paddingRight: 20,
    gap: 16,
    justifyContent: "center",
  },
  qrCodeText: {
    fontWeight: "bold",
    fontStyle: "italic",
    fontSize: 15,
    color: "#161160",
    textTransform: "uppercase",
  },
  qrCodeButton: {
    backgroundColor: "#2B21C1",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    width: 120,
  },
  qrCodeButtonText: {
    fontWeight: "bold",
    fontStyle: "italic",
    color: "#FFFFFF",
    fontSize: 10,
    textAlign: "center",
    textTransform: "uppercase",
  },
  qrCodePlaceholder: {
    width: 120,
    height: 120,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
  },

  // Trait Page Styles
  traitPageLayout: {
    fontFamily: "DejaVu",
    backgroundColor: "#FFFFFF",
    paddingTop: 60,
    paddingHorizontal: 40,
    paddingBottom: 100,
  },
  traitPageTitle: {
    fontWeight: "bold",
    fontStyle: "italic",
    fontSize: 32,
    color: "#161160",
    textAlign: "center",
    textTransform: "uppercase",
    marginBottom: 16,
  },
  traitPageBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: 160,
    zIndex: -1,
  },
  traitPageHeader: {
    alignItems: "center",
    marginBottom: 60,
  },
  subSectionContainer: {
    marginBottom: 24,
    orphans: 2,
    widows: 2,
  },
  starsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  starSvg: {
    width: 24,
    height: 24,
  },
  subSectionTitle: {
    fontWeight: "bold",
    fontStyle: "italic",
    fontSize: 14,
    color: "#161160",
    textTransform: "uppercase",
    marginBottom: 8,
  },

  // Stats Page Styles
  statsPageContainer: { flexDirection: "column", height: "100%" },
  statsTitleHeader: {
    width: "100%",
    alignItems: "center",
    paddingTop: 100,
    paddingBottom: 64,
  },
  statsTitleText: {
    fontWeight: "bold",
    fontStyle: "italic",
    fontSize: 40,
    lineHeight: 1.2,
    textAlign: "center",
    letterSpacing: -1.6,
    textTransform: "uppercase",
    color: "#161160",
  },
  statsMainContent: {
    flex: 1,
    paddingHorizontal: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 250,
  },
  statsTableWrapper: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderStyle: "solid",
    width: "100%",
    minHeight: 350,
    display: "flex",
    flexDirection: "column",
  },

  // Scouted Game Page Styles
  scoutedGamePageContainer: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
  },
  scoutedGameTitle: {
    fontWeight: "bold",
    fontStyle: "italic",
    fontSize: 40,
    color: "#161160",
    textAlign: "center",
    paddingTop: 60,
    paddingBottom: 20,
  },
  scoutedGameMainContent: {
    flex: 1,
    paddingHorizontal: 40,
  },
  gameBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderStyle: "solid",
    padding: 24,
    minHeight: 400,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-around",
    width: "100%",
  },
  gameHeader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 24,
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    borderBottomStyle: "solid",
  },
  gameHeaderText: {
    fontWeight: "bold",
    fontStyle: "italic",
    fontSize: 14,
    color: "#161160",
    textTransform: "uppercase",
  },
  gameHeaderIcon: {
    width: 60,
    height: 60,
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    objectFit: "contain",
  },
  gameBody: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  teamBlock: { flex: 1, alignItems: "center", gap: 16 },
  teamLogo: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    objectFit: "contain",
  },
  teamNameText: {
    fontWeight: "bold",
    fontStyle: "italic",
    fontSize: 14,
    color: "#161160",
    textAlign: "center",
    textTransform: "uppercase",
  },
  scoreBlock: { paddingHorizontal: 24 },
  scoreText: {
    fontWeight: "bold",
    fontStyle: "italic",
    fontSize: 64,
    color: "#161160",
  },
  gameFooterText: {
    fontStyle: "italic",
    fontSize: 10,
    color: "#525986",
    textTransform: "uppercase",
    marginRight: 8,
  },

  // HTML Renderer Styles
  p: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 1.5,
    color: "#1b1663",
    textAlign: "justify",
  },
  pLarge: {
    fontFamily: "DejaVu",
    fontSize: 14,
    lineHeight: 1.6,
    color: "#e79b4d",
    textAlign: "justify",
  },
  h1: { fontWeight: "bold", fontSize: 22, marginBottom: 10 },
  h2: { fontWeight: "bold", fontSize: 18, marginBottom: 8 },
  h3: { fontWeight: "bold", fontSize: 16, marginBottom: 6 },
  strong: { fontWeight: "bold" },
  em: { fontStyle: "italic" },
  ul: { marginLeft: 15 },
  li: { flexDirection: "row", marginBottom: 4 },
  liBullet: { marginRight: 5 },

  // Table Styles
  table: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    flex: 1,
  },
  tableHeader: {
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    borderBottomStyle: "solid",
    flexDirection: "row",
    minHeight: 40,
  },
  tableBody: { flex: 1, justifyContent: "space-around" },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    borderBottomStyle: "solid",
    flex: 1,
  },
  tableBodyRowLast: { borderBottomWidth: 0 },
  tableCol: { padding: 12, justifyContent: "center" },
  tableCell: {
    fontSize: 11,
    color: "#374151",
    textAlign: "left",
    lineHeight: 1.2,
    fontWeight: "normal",
  },
  tableHeaderCell: {
    fontSize: 9,
    color: "#6B7280",
    textAlign: "left",
    textTransform: "uppercase",
    fontWeight: "bold",
    lineHeight: 1.1,
    letterSpacing: 0.3,
  },
  // --- RESTORED: Original column styles ---
  seasonCol: { width: 80 },
  teamCol: { flex: 1 },
  gpCol: { width: 40 },
  gCol: { width: 40 },
  aCol: { width: 40 },
  tpCol: { width: 40 },
  wCol: { width: 40 },
  lCol: { width: 40 },
  gaaCol: { width: 50 },
  svCol: { width: 55 },
  teamIcon: {
    width: 42,
    height: 42,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    marginRight: 8,
    objectFit: "contain",
  },
  teamNameContainer: { flexDirection: "row", alignItems: "center" },
  teamName: { fontSize: 11, color: "#374151", fontWeight: "normal" },
  numericCol: { alignItems: "center", justifyContent: "center" },
  numericCell: {
    textAlign: "center",
    fontSize: 11,
    color: "#374151",
    fontWeight: "normal",
    width: "100%",
  },
  numericHeaderCell: {
    textAlign: "center",
    fontSize: 9,
    color: "#6B7280",
    textTransform: "uppercase",
    fontWeight: "bold",
    letterSpacing: 0.3,
    width: "100%",
  },
  
  summaryPageContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingTop: 60,
    paddingBottom: 100,
  },
  summaryPageTitle: {
    fontWeight: "bold",
    fontStyle: "italic",
    fontSize: 32,
    color: "#161160",
    textAlign: "center",
    textTransform: "uppercase",
    marginBottom: 45,
  },
  summaryContentWrapper: {
    width: "90%",
  },
  infoPageContainer: {
    display: "flex",
    flexDirection: "column",
    paddingHorizontal: 40,
    paddingTop: 100,
    paddingBottom: 100,
  },
  infoPageTitle: {
    fontWeight: "bold",
    fontStyle: "italic",
    fontSize: 32,
    color: "#161160",
    textAlign: "center",
    textTransform: "uppercase",
    marginBottom: 30,
  },
  infoPageIntroText: {
    fontSize: 13,
    lineHeight: 1.6,
    color: "#374151",
    marginBottom: 40,
    textAlign: "justify",
    width: "99%",
    alignSelf: "center",
  },
  infoPageIntroEmphasized: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  introHighlightText: {
    fontWeight: 'bold',
    fontSize: 13,
  },

  // Scaling System Page Styles
  scalingGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  scalingColumn: {
    width: "48%",
    flexDirection: "column",
    gap: 30,
  },
  ratingBlock: {
    flexDirection: "column",
    gap: 8,
  },
  ratingTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1F2937",
  },
  ratingDescription: {
    fontSize: 10.5,
    lineHeight: 1.5,
    color: "#4B5563",
    textAlign: "justify",
  },

  // Scouting Team Page Styles
  scoutProfile: {
    marginBottom: 28,
  },
  scoutName: {
    fontWeight: "bold",
    fontStyle: "italic",
    fontSize: 14,
    color: "#161160",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  scoutDescription: {
    fontSize: 11,
    lineHeight: 1.6,
    color: "#374151",
    textAlign: "justify",
  },

  footerLogo: {
    width: 50,
    height: "auto",
  },
  placeholderContainer: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: "#F3F4F6", 
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#9CA3AF", 
  },

  placeholderIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 10,
    marginRight: 8,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderIconText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#9CA3AF",
  },
});

const coverPageStyles = StyleSheet.create({
  page: {
    backgroundColor: "#000000",
    color: "#FFFFFF",
    fontFamily: "DejaVu",
  },
  pageContainer: {
    position: "relative",
    flex: 1,
  },
  fullPageBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    zIndex: -1,
  },
  contentWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: 40,
  },
  headerSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 40,
    paddingTop: 140,
  },
  imagePositioningContainer: {
    width: 280,
    height: 280,
    position: "relative",
  },
  imageClippingContainer: {
    width: "100%",
    height: "100%",
    borderRadius: 140,
    overflow: "hidden",
  },
  playerImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  logoOverlay: {
    position: "absolute",
    width: "35%",
    height: "auto",
    bottom: -20,
    right: -15,
  },
  titleBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
  },
  playerFirstName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 3,
  },
  playerLastName: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 3,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 4,
    marginTop: 12,
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  footerLogo: {
    width: 90,
    height: "auto",
  },
  reportDateText: {
    fontSize: 11,
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});

const playstylePageStyles = StyleSheet.create({
  page: { fontFamily: "DejaVu", backgroundColor: "#FFFFFF" },
  pageContainer: { position: "relative", flex: 1 },
  contentWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  mainContent: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 60,
  },
  imageContainer: {
    width: 400,
    height: 400,
    justifyContent: "center",
    alignItems: "center",
  },
  positionImage: { width: "100%", height: "auto", transform: "rotate(-90deg)" },
  textContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    width: "90%",
  },
  playstyleName: {
    fontSize: 24,
    fontWeight: "bold",
    fontStyle: "italic",
    color: "#161160",
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "center",
    width: "100%",
  },
  playstyleDescription: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "#374151",
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
});

// --- 4. HELPER FUNCTIONS & COMPONENTS ---
const formatHeight = (
  h: { centimeters: number; inches: number } | null | undefined
): string => {
  if (!h?.centimeters) return "N/A";
  const totalInches = h.centimeters / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${h.centimeters} CM / ${feet}' ${inches}"`;
};

const formatWeight = (w: any) =>
  w?.pounds ? `${w.kilograms} kg / ${w.pounds} lbs` : "N/A";

const formatDate = (d: string, locale: string) =>
  d
    ? new Date(d).toLocaleDateString(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      })
    : "N/A";

const decodeHtmlEntities = (text: string | null): string => {
  if (!text) return "";
  return text.replace(/&/gi, "&");
};

const escapeForPdf = (text: string | null): string => {
  if (!text) return "";
  return text.replace(/&/g, "\u0026");
};

const generateQrCodeDataUrl = async (text: string): Promise<string | null> => {
  try {
    const dataUrl = await QRCode.toDataURL(text, {
      errorCorrectionLevel: "H",
      margin: 1,
      color: {
        dark: "#161160FF",
        light: "#00000000",
      },
    });
    return dataUrl;
  } catch (err) {
    console.error("Failed to generate QR code", err);
    return null;
  }
};

const splitReportByHeadings = (
  blueprintHtml: string,
  contentHtml: string
): { [key: string]: ReportSection | string | null } => {
  if (!blueprintHtml || !contentHtml) return {};

  const blueprintRoot = parse(blueprintHtml);
  const contentRoot = parse(contentHtml);

  const sections: { [key: string]: ReportSection | string | null } = {};

  const blueprintHrSplit = blueprintRoot.innerHTML.split(/<hr\s*\/?>/i);
  const contentHrSplit = contentRoot.innerHTML.split(/<hr\s*\/?>/i);

  const blueprintMainContent =
    blueprintHrSplit.length > 2
      ? blueprintHrSplit.slice(2).join("<hr />")
      : blueprintHrSplit.length === 1
        ? blueprintHrSplit[0]
        : "";
  const contentMainContent =
    contentHrSplit.length > 2
      ? contentHrSplit.slice(2).join("<hr />")
      : contentHrSplit.length === 1
        ? contentHrSplit[0]
        : "";

  const blueprintMainRoot = parse(blueprintMainContent);
  const contentMainRoot = parse(contentMainContent);

  const contentTableNode = contentMainRoot.querySelector("table");
  sections.seasonalStats = contentTableNode ? contentTableNode.outerHTML : null;
  if (contentTableNode) contentTableNode.remove();

  const blueprintAnalysisParts =
    blueprintMainRoot.innerHTML.match(/<h3[\s\S]*?(?=<h3|$)/g) || [];
  const contentAnalysisParts =
    contentMainRoot.innerHTML.match(/<h3[\s\S]*?(?=<h3|$)/g) || [];

  const keyMap: { [key: string]: string } = {
    // Skater Keys
    skating: "skating",
    "puck skills": "puckSkills",
    "hockey iq": "hockeyIq",
    shot: "shot",
    "compete level": "competeLevel",
    "defensive game": "defensiveGame",
    // Goalie Keys
    "crease mobility": "creaseMobility",
    "positioning & angles": "positioningAngles",
    "puck tracking": "puckTracking",
    "save execution": "saveExecution",
    "mental toughness": "mentalToughness",
    "puck handling": "puckHandling",
    // Common Keys
    "overall summary": "overallSummary",
    recommendation: "recommendation",
  };

  blueprintAnalysisParts.forEach((blueprintPart, index) => {
    const blueprintPartRoot = parse(blueprintPart);
    const blueprintHeading = blueprintPartRoot.querySelector("h3");

    if (blueprintHeading) {
      const blueprintHeadingText = blueprintHeading.innerText
        .trim()
        .toLowerCase()
        .replace(/\s*\(.*?\)\s*/g, "")
        .trim();
      const key = Object.keys(keyMap).find((k) =>
        blueprintHeadingText.startsWith(k)
      );

      if (key && keyMap[key]) {
        const contentPart = contentAnalysisParts[index];
        if (contentPart) {
          const contentPartRoot = parse(contentPart);
          const contentHeading = contentPartRoot.querySelector("h3");
          const title = contentHeading
            ? contentHeading.innerText.trim()
            : blueprintHeading.innerText.trim();

          if (contentHeading) contentHeading.remove();

          sections[keyMap[key]] = {
            title: title,
            html: contentPartRoot.innerHTML,
          };
        }
      }
    }
  });

  return sections;
};

const parseTraitHtml = (html: string | null) => {
  if (!html) return { subSections: [] };

  const root = parse(html);
  const subSections: { title: string | null; content: string }[] = [];
  
  const subheadings = root.querySelectorAll('strong');

  if (subheadings.length === 0) {
    if (root.innerHTML.trim()) {
      subSections.push({ title: null, content: root.innerHTML.trim() });
    }
    return { subSections };
  }

  let lastIndex = 0;
  subheadings.forEach((headingNode, i) => {
    const title = decodeHtmlEntities(headingNode.innerText.trim());
    const headingOuterHtml = headingNode.outerHTML;
    const currentHtml = root.innerHTML;

    const startIndex = currentHtml.indexOf(headingOuterHtml, lastIndex);
    const nextHeadingNode = subheadings[i + 1];
    let endIndex = currentHtml.length;

    if (nextHeadingNode) {
      endIndex = currentHtml.indexOf(nextHeadingNode.outerHTML, startIndex + 1);
    }

    const contentHtml = currentHtml.substring(startIndex + headingOuterHtml.length, endIndex).trim();
    
    subSections.push({
      title: title,
      content: contentHtml,
    });

    lastIndex = startIndex + 1;
  });

  return { subSections };
};

const BackgroundGradient = () => (
  <Svg style={styles.backgroundSvg} fixed>
    <Defs>
      <LinearGradient
        id="pageGradient"
        x1="1"
        y1="0"
        x2="0"
        y2="1"
        gradientUnits="objectBoundingBox"
      >
        <Stop offset="0%" stopColor="#D0CEF2" />
        <Stop offset="40%" stopColor="#E8E6F9" />
        <Stop offset="90%" stopColor="#FFFFFF" />
      </LinearGradient>
    </Defs>
    <Rect x="0" y="0" width="595.28" height="160" fill="url(#pageGradient)" />
  </Svg>
);

const BackgroundGradient2 = () => (
  <Svg style={styles.backgroundSvg} fixed>
    <Defs>
      <LinearGradient
        id="pageGradient2"
        x1="1"
        y1="0"
        x2="0"
        y2="1"
        gradientUnits="objectBoundingBox"
      >
        <Stop offset="0%" stopColor="#D0CEF2" />
        <Stop offset="40%" stopColor="#E8E6F9" />
        <Stop offset="90%" stopColor="#FFFFFF" />
      </LinearGradient>
    </Defs>
    <Rect x="0" y="0" width="595.28" height="130" fill="url(#pageGradient2)" />
  </Svg>
);

const getTeamInitials = (name: string | null | undefined): string => {
  if (!name) return "";
  const parts = name.split(/[\s-]+/).filter(Boolean);
  return parts
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 3);
};

const TeamLogoPlaceholder = ({
  teamName,
  containerStyle,
  textStyle,
}: {
  teamName: string;
  containerStyle: Style;
  textStyle: Style;
}) => (
  <View style={containerStyle}>
    <Text style={textStyle}>{getTeamInitials(teamName)}</Text>
  </View>
);

const Star = ({ state }: { state: "filled" | "half" | "empty" }) => {
  const starPath =
    "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27z";
  const starColor = "#2B21C1";
  const clipId = `clip-${Math.random().toString(36).substring(7)}`;

  if (state === "empty") {
    return (
      <Svg viewBox="0 0 24 24" style={styles.starSvg}>
        <Path d={starPath} stroke={starColor} strokeWidth={1.5} />
      </Svg>
    );
  }

  if (state === "filled") {
    return (
      <Svg viewBox="0 0 24 24" style={styles.starSvg}>
        <Path d={starPath} fill={starColor} />
      </Svg>
    );
  }

  return (
    <Svg viewBox="0 0 24 24" style={styles.starSvg}>
      <Defs>
        <ClipPath id={clipId}>
          <Rect x="0" y="0" width="12" height="24" />
        </ClipPath>
      </Defs>
      <Path d={starPath} stroke={starColor} strokeWidth={1.5} />
      <Path d={starPath} fill={starColor} clipPath={`url(#${clipId})`} />
    </Svg>
  );
};

const StarRating = ({ rating, max = 5 }: { rating: number; max?: number }) => {
  return (
    <View style={styles.starsContainer}>
      {Array.from({ length: max }).map((_, i) => {
        let state: "filled" | "half" | "empty" = "empty";
        if (rating >= i + 1) {
          state = "filled";
        } else if (rating >= i + 0.5) {
          state = "half";
        }
        return <Star key={i} state={state} />;
      })}
    </View>
  );
};

const CoverPage = ({
  playerContext,
  backgroundBuffer,
  playerImageSrc,
  logoOverlayBuffer,
  footerLogoBuffer,
  t,
  locale,
}: {
  playerContext: any;
  backgroundBuffer: Buffer | null;
  playerImageSrc: string | null;
  logoOverlayBuffer: Buffer | null;
  footerLogoBuffer: Buffer | null;
  t: any;
  locale: string;
}) => {
  const nameParts = playerContext?.name?.split(" ") || ["Player", "Name"];
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ");
  const reportDate = new Date().toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });

  return (
    <Page size="A4" style={coverPageStyles.page}>
      <View style={coverPageStyles.pageContainer}>
        {backgroundBuffer && (
          <Image
            style={coverPageStyles.fullPageBackground}
            src={{ data: backgroundBuffer, format: "png" }}
          />
        )}
        <View style={coverPageStyles.contentWrapper}>
          <View style={coverPageStyles.headerSection}>
            <View style={coverPageStyles.imagePositioningContainer}>
              {playerImageSrc && (
                <View style={coverPageStyles.imageClippingContainer}>
                  <Image
                    style={coverPageStyles.playerImage}
                    src={playerImageSrc}
                  />
                </View>
              )}
              {logoOverlayBuffer && (
                <Image
                  style={coverPageStyles.logoOverlay}
                  src={{ data: logoOverlayBuffer, format: "png" }}
                />
              )}
            </View>
            <View style={coverPageStyles.titleBlock}>
              <Text style={coverPageStyles.playerFirstName}>{firstName}</Text>
              <Text style={coverPageStyles.playerLastName}>{lastName}</Text>
              <Text style={coverPageStyles.reportTitle}>{t.reportTitle}</Text>
            </View>
          </View>
        </View>
        <View style={coverPageStyles.footer}>
          {footerLogoBuffer ? (
            <Image
              style={coverPageStyles.footerLogo}
              src={{ data: footerLogoBuffer, format: "png" }}
            />
          ) : (
            <Text>GRAET</Text>
          )}
          <Text style={coverPageStyles.reportDateText}>{reportDate}</Text>
        </View>
      </View>
    </Page>
  );
};

const PlaystylePage = ({
  playerContext,
  positionImageBuffer,
  footerLogoBuffer2,
  t,
}: {
  playerContext: any;
  positionImageBuffer: Buffer | null;
  footerLogoBuffer2: Buffer | null;
  t: any;
}) => {
  const playerType = playerContext?.bio?.playerType;
  const playstyleName = playerType
    ? t.playstyleNames[playerType] || formatPlaystyle(playerType)
    : "N/A";
  const description =
    t.playstyleDescriptions[playerType] ||
    "No description available for this playstyle.";

  return (
    <Page size="A4" style={playstylePageStyles.page}>
      <BackgroundGradient2 />
      <View style={playstylePageStyles.pageContainer}>
        <View style={playstylePageStyles.contentWrapper}>
          <View style={playstylePageStyles.mainContent}>
            <View style={playstylePageStyles.imageContainer}>
              {positionImageBuffer ? (
                <Image
                  style={playstylePageStyles.positionImage}
                  src={{ data: positionImageBuffer, format: "png" }}
                />
              ) : (
                <View />
              )}
            </View>
            <View style={playstylePageStyles.textContainer}>
              <Text style={playstylePageStyles.playstyleName}>
                {playstyleName}
              </Text>
              <Text style={playstylePageStyles.playstyleDescription}>
                {description}
              </Text>
            </View>
          </View>
        </View>
        <View style={playstylePageStyles.footer}>
          {footerLogoBuffer2 ? (
            <Image
              style={styles.footerLogo}
              src={{ data: footerLogoBuffer2, format: "png" }}
            />
          ) : (
            <Text style={styles.logoPlaceholder}>GRAET</Text>
          )}
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={styles.gameFooterText}>{t.bioFooter}</Text>
            <Text
              style={styles.pageNumber}
              render={({ pageNumber, totalPages }) =>
                `${t.pageLabel} ${pageNumber} ${t.ofLabel} ${totalPages}`
              }
              fixed
            />
          </View>
        </View>
      </View>
    </Page>
  );
};

// --- RESTORED: Original StatsTable component with goalie logic ---
const StatsTable = ({
  html,
  teamLogosMap,
  t,
  reportType,
}: {
  html: string;
  teamLogosMap: Map<string, string>;
  t: any;
  reportType: 'skater' | 'goalie';
}) => {
  if (!html) return null;

  const isGoalie = reportType === 'goalie';

  const skaterDataMap = {
    Team: { key: 'team', style: styles.teamCol },
    League: { key: 'league', style: styles.teamCol },
    Season: { key: 'season', style: styles.seasonCol },
    GP: { key: 'gamesPlayed', style: [styles.gpCol, styles.numericCol] },
    G: { key: 'goals', style: [styles.gCol, styles.numericCol] },
    A: { key: 'assists', style: [styles.aCol, styles.numericCol] },
    TP: { key: 'points', style: [styles.tpCol, styles.numericCol] },
    P: { key: 'points', style: [styles.tpCol, styles.numericCol] },
    PTS: { key: 'points', style: [styles.tpCol, styles.numericCol] },
  };

  const goalieDataMap = {
    Team: { key: 'team', style: styles.teamCol },
    League: { key: 'league', style: styles.teamCol },
    Season: { key: 'season', style: styles.seasonCol },
    GP: { key: 'gamesPlayed', style: [styles.gpCol, styles.numericCol] },
    W: { key: 'wins', style: [styles.wCol, styles.numericCol] },
    L: { key: 'losses', style: [styles.lCol, styles.numericCol] },
    GAA: { key: 'gaa', style: [styles.gaaCol, styles.numericCol] },
    'SV%': { key: 'svp', style: [styles.svCol, styles.numericCol] },
  };

  const dataMap = isGoalie ? goalieDataMap : skaterDataMap;

  const root = parse(html);
  const table = root.querySelector("table");
  if (!table) return null;

  const headerRow = table.querySelector("tr");
  const htmlHeaders = headerRow
    ? Array.from(headerRow.querySelectorAll("th")).map((th) => th.innerText.trim())
    : [];

  const dataRows = Array.from(table.querySelectorAll("tr")).slice(1);

  const statsData = dataRows
    .map((row) => {
      const cells = row.querySelectorAll("td");
      if (cells.length < 1) return null;
      
      const rowData: any = {};
      htmlHeaders.forEach((htmlHeader, index) => {
        const mapping = (dataMap as any)[htmlHeader];
        if (mapping) {
          rowData[mapping.key] = cells[index]?.innerText?.trim() || "";
        }
      });
      return rowData;
    })
    .filter(Boolean);

  const groupedBySeason = statsData.reduce((acc: any, row: any) => {
    const seasonKey = row.season || "Unknown Season";
    if (!acc[seasonKey]) {
      acc[seasonKey] = [];
    }
    acc[seasonKey].push(row);
    return acc;
  }, {});

  const sortedSeasons = Object.keys(groupedBySeason).sort().reverse();

  const allRows: any[] = [];
  sortedSeasons.forEach((season) => {
    groupedBySeason[season].forEach((row: any, index: number) => {
      allRows.push({ ...row, season, isFirstInSeason: index === 0 });
    });
  });

  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        {isGoalie ? (
          <>
            <View style={[styles.tableCol, styles.seasonCol]}><Text style={styles.tableHeaderCell}>{t.statsSeason}</Text></View>
            <View style={[styles.tableCol, styles.teamCol]}><Text style={styles.tableHeaderCell}>{t.statsTeam}</Text></View>
            <View style={[styles.tableCol, styles.gpCol, styles.numericCol]}><Text style={styles.numericHeaderCell}>{t.statsGP}</Text></View>
            <View style={[styles.tableCol, styles.wCol, styles.numericCol]}><Text style={styles.numericHeaderCell}>W</Text></View>
            <View style={[styles.tableCol, styles.lCol, styles.numericCol]}><Text style={styles.numericHeaderCell}>L</Text></View>
            <View style={[styles.tableCol, styles.gaaCol, styles.numericCol]}><Text style={styles.numericHeaderCell}>GAA</Text></View>
            <View style={[styles.tableCol, styles.svCol, styles.numericCol]}><Text style={styles.numericHeaderCell}>SV%</Text></View>
          </>
        ) : (
          <>
            <View style={[styles.tableCol, styles.seasonCol]}><Text style={styles.tableHeaderCell}>{t.statsSeason}</Text></View>
            <View style={[styles.tableCol, styles.teamCol]}><Text style={styles.tableHeaderCell}>{t.statsTeam}</Text></View>
            <View style={[styles.tableCol, styles.gpCol, styles.numericCol]}><Text style={styles.numericHeaderCell}>{t.statsGP}</Text></View>
            <View style={[styles.tableCol, styles.gCol, styles.numericCol]}><Text style={styles.numericHeaderCell}>{t.statsG}</Text></View>
            <View style={[styles.tableCol, styles.aCol, styles.numericCol]}><Text style={styles.numericHeaderCell}>{t.statsA}</Text></View>
            <View style={[styles.tableCol, styles.tpCol, styles.numericCol]}><Text style={styles.numericHeaderCell}>{t.statsTP}</Text></View>
          </>
        )}
      </View>
      <View style={styles.tableBody}>
        {allRows.map((row: any, index: number) => {
          const isLastRow = index === allRows.length - 1;
          const logoSrc = teamLogosMap.get(row.team);

          return (
            <View key={`${row.season}-${index}`} style={isLastRow ? [styles.tableRow, styles.tableBodyRowLast] : styles.tableRow}>
              {isGoalie ? (
                <>
                  <View style={[styles.tableCol, styles.seasonCol]}><Text style={styles.tableCell}>{row.isFirstInSeason ? row.season.replace("-", "/").slice(2) : ""}</Text></View>
                  <View style={[styles.tableCol, styles.teamCol]}>
                    <View style={styles.teamNameContainer}>
                      {logoSrc ? <Image style={styles.teamIcon} src={logoSrc} /> : <View style={styles.teamIcon} />}
                      <Text style={styles.teamName}>{row.team}</Text>
                    </View>
                  </View>
                  <View style={[styles.tableCol, styles.gpCol, styles.numericCol]}><Text style={styles.numericCell}>{row.gamesPlayed}</Text></View>
                  <View style={[styles.tableCol, styles.wCol, styles.numericCol]}><Text style={styles.numericCell}>{row.wins}</Text></View>
                  <View style={[styles.tableCol, styles.lCol, styles.numericCol]}><Text style={styles.numericCell}>{row.losses}</Text></View>
                  <View style={[styles.tableCol, styles.gaaCol, styles.numericCol]}><Text style={styles.numericCell}>{row.gaa}</Text></View>
                  <View style={[styles.tableCol, styles.svCol, styles.numericCol]}><Text style={styles.numericCell}>{row.svp}</Text></View>
                </>
              ) : (
                <>
                  <View style={[styles.tableCol, styles.seasonCol]}><Text style={styles.tableCell}>{row.isFirstInSeason ? row.season.replace("-", "/").slice(2) : ""}</Text></View>
                  <View style={[styles.tableCol, styles.teamCol]}>
                    <View style={styles.teamNameContainer}>
                      {logoSrc ? <Image style={styles.teamIcon} src={logoSrc} /> : <View style={styles.teamIcon} />}
                      <Text style={styles.teamName}>{row.team}</Text>
                    </View>
                  </View>
                  <View style={[styles.tableCol, styles.gpCol, styles.numericCol]}><Text style={styles.numericCell}>{row.gamesPlayed}</Text></View>
                  <View style={[styles.tableCol, styles.gCol, styles.numericCol]}><Text style={styles.numericCell}>{row.goals}</Text></View>
                  <View style={[styles.tableCol, styles.aCol, styles.numericCol]}><Text style={styles.numericCell}>{row.assists}</Text></View>
                  <View style={[styles.tableCol, styles.tpCol, styles.numericCol]}><Text style={styles.numericCell}>{row.points}</Text></View>
                </>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
};

const supportedStyleTags = [
  "p",
  "h1",
  "h2",
  "h3",
  "strong",
  "em",
  "ul",
  "li",
] as const;
type StyleKey = (typeof supportedStyleTags)[number];

function isStyleKey(key: string): key is StyleKey {
  return (supportedStyleTags as readonly string[]).includes(key);
}

interface HtmlRendererProps {
  html: string;
  isStatsTable?: boolean;
  baseStyle?: Style;
  styleOverrides?: Partial<Record<StyleKey, Style>>;
  teamLogosMap?: Map<string, string>;
  t?: any;
  reportType?: 'skater' | 'goalie';
}

const HtmlRenderer = ({
  html,
  isStatsTable = false,
  baseStyle = {},
  styleOverrides = {},
  teamLogosMap,
  t,
  reportType = 'skater',
}: HtmlRendererProps) => {
  if (isStatsTable) {
    if (!teamLogosMap || !t) {
      console.error(
        "HtmlRenderer: 'teamLogosMap' and 't' are required when 'isStatsTable' is true."
      );
      return null;
    }
    return <StatsTable html={html} teamLogosMap={teamLogosMap} t={t} reportType={reportType} />;
  }

  if (!html) {
    return null;
  }

  const root = parse(html);

  const renderNode = (
    node: any,
    index: number,
    inheritedStyles: Style
  ): React.JSX.Element | React.JSX.Element[] | null => {
    if (node.nodeType === 3) {
      const textContent = node.text;
      if (textContent.trim().length === 0) {
        return null;
      }
      const decodedText = decodeHtmlEntities(textContent);
      const escapedText = escapeForPdf(decodedText);
      return (
        <Text key={index} style={inheritedStyles}>
          {escapedText}
        </Text>
      );
    }

    if (node.nodeType === 1) {
      const element = node as HTMLElement;
      const tagName = element.tagName.toLowerCase();

      let currentTagStyle: Style = {};
      if (isStyleKey(tagName)) {
        const defaultStyle = styles[tagName] || {};
        const overrideStyle = styleOverrides[tagName] || {};
        currentTagStyle = { ...defaultStyle, ...overrideStyle };
      }

      const newInheritedStyles: Style = {
        ...inheritedStyles,
        ...currentTagStyle,
      };

      const children = element.childNodes.map((child, i) =>
        renderNode(child, i, newInheritedStyles)
      );

      switch (tagName) {
        case "p":
        case "h1":
        case "h2":
        case "h3":
        case "ul":
          return (
            <View key={index} style={currentTagStyle}>
              {children}
            </View>
          );

        case "li":
          return (
            <View key={index} style={styles.li}>
              <Text style={newInheritedStyles}>{"\u2022" + "  "}</Text>
              <View style={{ flex: 1 }}>{children}</View>
            </View>
          );

        case "strong":
        case "em":
          return <React.Fragment key={index}>{children}</React.Fragment>;

        default:
          return <React.Fragment key={index}>{children}</React.Fragment>;
      }
    }

    return null;
  };

  return (
    <>{root.childNodes.map((node, i) => renderNode(node, i, baseStyle))}</>
  );
};

const OverallSummaryPage = ({
  title,
  footerTitle,
  html,
  footerLogoBuffer2,
  t,
}: {
  title: string;
  footerTitle: string;
  html: string | null;
  footerLogoBuffer2: Buffer | null;
  t: any;
}) => {
  if (!html) return null;

  return (
    <Page size="A4" style={styles.page} wrap>
      <BackgroundGradient />
      <View style={styles.summaryPageContainer}>
        <Text style={styles.summaryPageTitle}>{title}</Text>
        <View style={styles.summaryContentWrapper}>
          <HtmlRenderer html={html} t={t} styleOverrides={{ p: styles.p }} />
        </View>
      </View>
      <View style={styles.footer} fixed>
        {footerLogoBuffer2 ? (
          <Image
            style={styles.footerLogo}
            src={{ data: footerLogoBuffer2, format: "png" }}
          />
        ) : (
          <Text style={styles.logoPlaceholder}>GRAET</Text>
        )}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={styles.gameFooterText}>{footerTitle}</Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) =>
              `${t.pageLabel} ${pageNumber} ${t.ofLabel} ${totalPages}`
            }
            fixed
          />
        </View>
      </View>
    </Page>
  );
};

const StructuredSummaryPage = ({
  title,
  footerTitle,
  html,
  footerLogoBuffer2,
  t,
}: {
  title: string;
  footerTitle: string;
  html: string | null;
  footerLogoBuffer2: Buffer | null;
  t: any;
}) => {
  if (!html) return null;

  const { subSections } = parseTraitHtml(html);

  return (
    <Page size="A4" style={styles.traitPageLayout} wrap>
      <Svg style={styles.traitPageBackground}>
        <Defs>
          <LinearGradient
            id={`pageGradient-${title.replace(/\s/g, "")}`}
            x1="1"
            y1="0"
            x2="0"
            y2="1"
            gradientUnits="objectBoundingBox"
          >
            <Stop offset="0%" stopColor="#D0CEF2" />
            <Stop offset="40%" stopColor="#E8E6F9" />
            <Stop offset="90%" stopColor="#FFFFFF" />
          </LinearGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width="595.28"
          height="160"
          fill={`url(#pageGradient-${title.replace(/\s/g, "")})`}
        />
      </Svg>

      <View>
        <View style={styles.traitPageHeader}>
          <Text style={styles.traitPageTitle}>{title}</Text>
        </View>

        {subSections.map((section, index) => (
          <View key={index} style={styles.subSectionContainer}>
            {section.title && (
              <Text style={styles.subSectionTitle}>
                {escapeForPdf(decodeHtmlEntities(section.title))}
              </Text>
            )}
            <HtmlRenderer html={section.content} t={t} baseStyle={styles.p} />
          </View>
        ))}
      </View>

      <View style={styles.footer} fixed>
        {footerLogoBuffer2 ? (
          <Image
            style={styles.footerLogo}
            src={{ data: footerLogoBuffer2, format: "png" }}
          />
        ) : (
          <Text style={styles.logoPlaceholder}>GRAET</Text>
        )}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={styles.gameFooterText}>{footerTitle}</Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) =>
              `${t.pageLabel} ${pageNumber} ${t.ofLabel} ${totalPages}`
            }
            fixed
          />
        </View>
      </View>
    </Page>
  );
};

const TraitPage = ({
  title,
  html,
  rating,
  footerLogoBuffer2,
  t,
}: {
  title: string;
  html: string | null;
  rating: number;
  footerLogoBuffer2: Buffer | null;
  t: any;
}) => {
  if (!html) return null;

  const { subSections } = parseTraitHtml(html);

  return (
    <Page size="A4" style={styles.traitPageLayout} wrap>
      <Svg style={styles.traitPageBackground}>
        <Defs>
          <LinearGradient
            id={`pageGradient-${title.replace(/\s/g, "")}`}
            x1="1"
            y1="0"
            x2="0"
            y2="1"
            gradientUnits="objectBoundingBox"
          >
            <Stop offset="0%" stopColor="#D0CEF2" />
            <Stop offset="40%" stopColor="#E8E6F9" />
            <Stop offset="90%" stopColor="#FFFFFF" />
          </LinearGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width="595.28"
          height="160"
          fill={`url(#pageGradient-${title.replace(/\s/g, "")})`}
        />
      </Svg>

      <View>
        <View style={styles.traitPageHeader}>
          <Text style={styles.traitPageTitle}>{title}</Text>
          <StarRating rating={rating} max={5} />
        </View>

        {subSections.map((section, index) => (
          <View key={index} style={styles.subSectionContainer}>
            <Text style={styles.subSectionTitle}>
              {escapeForPdf(decodeHtmlEntities(section.title))}
            </Text>
            <HtmlRenderer html={section.content} t={t} baseStyle={styles.p} />
          </View>
        ))}
      </View>

      <View style={styles.footer} fixed>
        {footerLogoBuffer2 ? (
          <Image
            style={styles.footerLogo}
            src={{ data: footerLogoBuffer2, format: "png" }}
          />
        ) : (
          <Text style={styles.logoPlaceholder}>GRAET</Text>
        )}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={styles.gameFooterText}>{title}</Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) =>
              `${t.pageLabel} ${pageNumber} ${t.ofLabel} ${totalPages}`
            }
            fixed
          />
        </View>
      </View>
    </Page>
  );
};

const StatsPage = ({
  html,
  footerLogoBuffer2,
  teamLogosMap,
  t,
  reportType,
}: {
  html: string | null;
  footerLogoBuffer2: Buffer | null;
  teamLogosMap: Map<string, string>;
  t: any;
  reportType: 'skater' | 'goalie';
}) => {
  if (!html) return null;
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.statsPageContainer}>
        <View style={styles.statsTitleHeader}>
          <BackgroundGradient />
          <Text style={styles.statsTitleText}>{t.statsTitle}</Text>
        </View>
        <View style={styles.statsMainContent}>
          <View style={styles.statsTableWrapper}>
            <HtmlRenderer
              html={html}
              isStatsTable={true}
              teamLogosMap={teamLogosMap}
              t={t}
              reportType={reportType}
            />
          </View>
        </View>
      </View>
      <View style={styles.footer} fixed>
        {footerLogoBuffer2 ? (
          <Image
            style={styles.footerLogo}
            src={{ data: footerLogoBuffer2, format: "png" }}
          />
        ) : (
          <Text style={styles.logoPlaceholder}>GRAET</Text>
        )}
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `${t.pageLabel} ${pageNumber} ${t.ofLabel} ${totalPages}`
          }
          fixed
        />
      </View>
    </Page>
  );
};

const ScoutedGamePage = ({
  gameDetails,
  footerLogoBuffer2,
  gameQrCodeDataUrl,
  teamALogo,
  teamBLogo,
  leagueLogo,
  t,
}: {
  gameDetails: GameDetails | null;
  footerLogoBuffer2: Buffer | null;
  gameQrCodeDataUrl: string | null;
  teamALogo: string | null;
  teamBLogo: string | null;
  leagueLogo: string | null;
  t: any;
}) => {
  if (!gameDetails) return null;

  const { teamA, teamB, gameDate, league } = gameDetails;
  const teamAScore = teamA.score ?? "-";
  const teamBScore = teamB.score ?? "-";

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.scoutedGamePageContainer}>
        <BackgroundGradient />
        <Text style={styles.scoutedGameTitle}>{t.scoutedGameTitle}</Text>
        <View style={styles.scoutedGameMainContent}>
          <View style={styles.gameBox}>
            <View style={styles.gameHeader}>
              <Text style={styles.gameHeaderText}>{league || "N/A"}</Text>
              {leagueLogo ? (
                <Image style={styles.gameHeaderIcon} src={leagueLogo} />
              ) : (
                <View style={styles.gameHeaderIcon} />
              )}
              <Text style={styles.gameHeaderText}>{gameDate || "N/A"}</Text>
            </View>

            <View style={styles.gameBody}>
              <View style={styles.teamBlock}>
                {teamALogo ? (
                  <Image style={styles.teamLogo} src={teamALogo} />
                ) : (
                  <TeamLogoPlaceholder
                    teamName={teamA.name}
                    containerStyle={styles.placeholderContainer}
                    textStyle={styles.placeholderText}
                  />
                )}
                <Text style={styles.teamNameText}>
                  {teamA.name || "Team A"}
                </Text>
              </View>
              <View style={styles.scoreBlock}>
                <Text
                  style={styles.scoreText}
                >{`${teamAScore} : ${teamBScore}`}</Text>
              </View>
              <View style={styles.teamBlock}>
                {teamBLogo ? (
                  <Image style={styles.teamLogo} src={teamBLogo} />
                ) : (
                  <TeamLogoPlaceholder
                    teamName={teamB.name}
                    containerStyle={styles.placeholderContainer}
                    textStyle={styles.placeholderText}
                  />
                )}
                <Text style={styles.teamNameText}>
                  {teamB.name || "Team B"}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.footer} fixed>
        {footerLogoBuffer2 ? (
          <Image
            style={styles.footerLogo}
            src={{ data: footerLogoBuffer2, format: "png" }}
          />
        ) : (
          <Text style={styles.logoPlaceholder}>GRAET</Text>
        )}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={styles.gameFooterText}>{t.gameFooter}</Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) =>
              `${t.pageLabel} ${pageNumber} ${t.ofLabel} ${totalPages}`
            }
            fixed
          />
        </View>
      </View>
    </Page>
  );
};

const ScalingSystemPage = ({
  footerLogoBuffer2,
  t,
}: {
  footerLogoBuffer2: Buffer | null;
  t: any;
}) => (
  <Page size="A4" style={styles.page}>
    <BackgroundGradient />
    <View style={styles.infoPageContainer}>
      <Text style={styles.infoPageTitle}>{t.scalingTitle}</Text>

      <Text style={styles.infoPageIntroText}>
        <Text>{t.scalingIntro_part1}</Text>
        <Text style={styles.introHighlightText}>{t.scalingIntro_bold1}</Text>
        <Text>{t.scalingIntro_part2}</Text>
        <Text style={styles.introHighlightText}>{t.scalingIntro_bold2}</Text>
        <Text>{t.scalingIntro_part3}</Text>
        <Text style={styles.introHighlightText}>{t.scalingIntro_bold3}</Text>
        <Text>{t.scalingIntro_part4}</Text>
      </Text>

      <View style={styles.scalingGrid}>
        <View style={styles.scalingColumn}>
          <View style={styles.ratingBlock}>
            <StarRating rating={5} />
            <Text style={styles.ratingTitle}>{t.scalingEliteTitle}</Text>
            <Text style={styles.ratingDescription}>{t.scalingEliteDesc}</Text>
          </View>
          <View style={styles.ratingBlock}>
            <StarRating rating={3} />
            <Text style={styles.ratingTitle}>{t.scalingSolidTitle}</Text>
            <Text style={styles.ratingDescription}>{t.scalingSolidDesc}</Text>
          </View>
          <View style={styles.ratingBlock}>
            <StarRating rating={1} />
            <Text style={styles.ratingTitle}>
              {t.scalingNeedsImprovementTitle}
            </Text>
            <Text style={styles.ratingDescription}>
              {t.scalingNeedsImprovementDesc}
            </Text>
          </View>
        </View>

        <View style={styles.scalingColumn}>
          <View style={styles.ratingBlock}>
            <StarRating rating={4} />
            <Text style={styles.ratingTitle}>{t.scalingStrongTitle}</Text>
            <Text style={styles.ratingDescription}>{t.scalingStrongDesc}</Text>
          </View>
          <View style={styles.ratingBlock}>
            <StarRating rating={2} />
            <Text style={styles.ratingTitle}>{t.scalingDevelopingTitle}</Text>
            <Text style={styles.ratingDescription}>
              {t.scalingDevelopingDesc}
            </Text>
          </View>
        </View>
      </View>
    </View>

    <View style={styles.footer} fixed>
      {footerLogoBuffer2 ? (
        <Image
          style={styles.footerLogo}
          src={{ data: footerLogoBuffer2, format: "png" }}
        />
      ) : (
        <Text style={styles.logoPlaceholder}>GRAET</Text>
      )}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={styles.gameFooterText}>{t.scalingFooter}</Text>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `${t.pageLabel} ${pageNumber} ${t.ofLabel} ${totalPages}`
          }
          fixed
        />
      </View>
    </View>
  </Page>
);

const ScoutingTeamPage = ({
  footerLogoBuffer2,
  t,
}: {
  footerLogoBuffer2: Buffer | null;
  t: any;
}) => (
  <Page size="A4" style={styles.page}>
    <BackgroundGradient />
    <View style={styles.infoPageContainer}>
      <Text style={styles.infoPageTitle}>{t.scoutingTeamTitle}</Text>
      <Text style={styles.infoPageIntroText}>{t.scoutingTeamIntro}</Text>

      <View>
        <View style={styles.scoutProfile}>
          <Text style={styles.scoutName}>{t.scout1Name}</Text>
          <Text style={styles.scoutDescription}>{t.scout1Desc}</Text>
        </View>
        <View style={styles.scoutProfile}>
          <Text style={styles.scoutName}>{t.scout2Name}</Text>
          <Text style={styles.scoutDescription}>{t.scout2Desc}</Text>
        </View>
      </View>
    </View>

    <View style={styles.footer} fixed>
      {footerLogoBuffer2 ? (
        <Image
          style={styles.footerLogo}
          src={{ data: footerLogoBuffer2, format: "png" }}
        />
      ) : (
        <Text style={styles.logoPlaceholder}>GRAET</Text>
      )}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={styles.gameFooterText}>{t.scoutingTeamFooter}</Text>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `${t.pageLabel} ${pageNumber} ${t.ofLabel} ${totalPages}`
          }
          fixed
        />
      </View>
    </View>
  </Page>
);

// --- 5. MAIN DOCUMENT COMPONENT ---
const ReportDocument = ({
  playerContext,
  teamContext,
  reportSections,
  gameDetails,
  backgroundBuffer,
  playerImageSrc,
  logoOverlayBuffer,
  footerLogoBuffer,
  footerLogoBuffer2,
  positionImageBuffer,
  playerQrCodeDataUrl,
  gameQrCodeDataUrl,
  traitRatings,
  teamLogosMap,
  gamePageLogos,
  t,
  locale,
  reportType,
}: any) => (
  <Document>
    <CoverPage
      playerContext={playerContext}
      backgroundBuffer={backgroundBuffer}
      playerImageSrc={playerImageSrc}
      logoOverlayBuffer={logoOverlayBuffer}
      footerLogoBuffer={footerLogoBuffer}
      t={t}
      locale={locale}
    />
    <Page size="A4" style={styles.page}>
      <BackgroundGradient />
      <View style={styles.contentWrapper}>
        <View style={styles.playerInfoPageContainer}>
          <View style={styles.header}>
            <Text style={styles.playerName}>
              {playerContext?.name || "Player Name"}
            </Text>
            <Text style={styles.playerPosition}>
            {formatPosition(playerContext?.bio?.position)}
            </Text>
          </View>
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>{t.teamLabel}</Text>
                <Text style={styles.infoValue}>
                  {teamContext?.name || "N/A"}
                </Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>{t.dobLabel}</Text>
                <Text style={styles.infoValue}>
                  {formatDate(playerContext?.dateOfBirth, locale)}
                </Text>
              </View>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>{t.nationalityLabel}</Text>
                <Text style={styles.infoValue}>
                  {playerContext?.country || "N/A"}
                </Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>{t.heightLabel}</Text>
                <Text style={styles.infoValue}>
                  {formatHeight(playerContext?.bio?.height)}
                </Text>
              </View>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>{t.weightLabel}</Text>
                <Text style={styles.infoValue}>
                  {formatWeight(playerContext?.bio?.weight)}
                </Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>
                  {reportType === 'goalie' ? (t.catchesLabel || 'Catches') : t.shootsLabel}
                </Text>
                <Text style={styles.infoValue}>
                  {playerContext?.bio?.handedness
                    ? t.handedness[
                        playerContext.bio.handedness.toUpperCase()
                      ] || playerContext.bio.handedness
                    : "N/A"}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.qrCodeSection}>
            <View style={styles.qrCodeTextBlock}>
              <Text style={styles.qrCodeText}>
                {t.qrCheckProfile.replace(
                  "{playerName}",
                  playerContext?.firstname || "Player"
                )}
              </Text>
              <View style={styles.qrCodeButton}>
                <Text style={styles.qrCodeButtonText}>{t.qrViewProfile}</Text>
              </View>
            </View>
            {playerQrCodeDataUrl ? (
              <Image
                style={styles.qrCodePlaceholder}
                src={playerQrCodeDataUrl}
              />
            ) : (
              <View style={styles.qrCodePlaceholder} />
            )}
          </View>
        </View>
      </View>
      <View style={styles.footer} fixed>
        {footerLogoBuffer2 ? (
          <Image
            style={styles.footerLogo}
            src={{ data: footerLogoBuffer2, format: "png" }}
          />
        ) : (
          <Text style={styles.logoPlaceholder}>GRAET</Text>
        )}
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `${t.pageLabel} ${pageNumber} ${t.ofLabel} ${totalPages}`
          }
          fixed
        />
      </View>
    </Page>

    <PlaystylePage
      playerContext={playerContext}
      positionImageBuffer={positionImageBuffer}
      footerLogoBuffer2={footerLogoBuffer2}
      t={t}
    />

    {reportSections.seasonalStats && <StatsPage
      html={reportSections.seasonalStats}
      footerLogoBuffer2={footerLogoBuffer2}
      teamLogosMap={teamLogosMap}
      t={t}
      reportType={reportType}
    />}

    <ScoutedGamePage
      gameDetails={gameDetails}
      footerLogoBuffer2={footerLogoBuffer2}
      gameQrCodeDataUrl={gameQrCodeDataUrl}
      teamALogo={gamePageLogos.teamALogo}
      teamBLogo={gamePageLogos.teamBLogo}
      leagueLogo={gamePageLogos.leagueLogo}
      t={t}
    />

    {reportType === 'goalie' ? (
      <>
        {reportSections.creaseMobility && <TraitPage
          title={reportSections.creaseMobility.title}
          html={reportSections.creaseMobility.html}
          rating={traitRatings.creaseMobility}
          footerLogoBuffer2={footerLogoBuffer2}
          t={t}
        />}
        {reportSections.positioningAngles && <TraitPage
          title={reportSections.positioningAngles.title}
          html={reportSections.positioningAngles.html}
          rating={traitRatings.positioningAngles}
          footerLogoBuffer2={footerLogoBuffer2}
          t={t}
        />}
        {reportSections.puckTracking && <TraitPage
          title={reportSections.puckTracking.title}
          html={reportSections.puckTracking.html}
          rating={traitRatings.puckTracking}
          footerLogoBuffer2={footerLogoBuffer2}
          t={t}
        />}
        {reportSections.saveExecution && <TraitPage
          title={reportSections.saveExecution.title}
          html={reportSections.saveExecution.html}
          rating={traitRatings.saveExecution}
          footerLogoBuffer2={footerLogoBuffer2}
          t={t}
        />}
        {reportSections.mentalToughness && <TraitPage
          title={reportSections.mentalToughness.title}
          html={reportSections.mentalToughness.html}
          rating={traitRatings.mentalToughness}
          footerLogoBuffer2={footerLogoBuffer2}
          t={t}
        />}
        {reportSections.puckHandling && <TraitPage
          title={reportSections.puckHandling.title}
          html={reportSections.puckHandling.html}
          rating={traitRatings.puckHandling}
          footerLogoBuffer2={footerLogoBuffer2}
          t={t}
        />}
      </>
    ) : (
      <>
        {reportSections.skating && <TraitPage
          title={reportSections.skating.title}
          html={reportSections.skating.html}
          rating={traitRatings.skating}
          footerLogoBuffer2={footerLogoBuffer2}
          t={t}
        />}
        {reportSections.puckSkills && <TraitPage
          title={reportSections.puckSkills.title}
          html={reportSections.puckSkills.html}
          rating={traitRatings.puckSkills}
          footerLogoBuffer2={footerLogoBuffer2}
          t={t}
        />}
        {reportSections.hockeyIq && <TraitPage
          title={reportSections.hockeyIq.title}
          html={reportSections.hockeyIq.html}
          rating={traitRatings.hockeyIq}
          footerLogoBuffer2={footerLogoBuffer2}
          t={t}
        />}
        {reportSections.shot && <TraitPage
          title={reportSections.shot.title}
          html={reportSections.shot.html}
          rating={traitRatings.shot}
          footerLogoBuffer2={footerLogoBuffer2}
          t={t}
        />}
        {reportSections.competeLevel && <TraitPage
          title={reportSections.competeLevel.title}
          html={reportSections.competeLevel.html}
          rating={traitRatings.competeLevel}
          footerLogoBuffer2={footerLogoBuffer2}
          t={t}
        />}
        {reportSections.defensiveGame && <TraitPage
          title={reportSections.defensiveGame.title}
          html={reportSections.defensiveGame.html}
          rating={traitRatings.defensiveGame}
          footerLogoBuffer2={footerLogoBuffer2}
          t={t}
        />}
      </>
    )}

    {reportSections.overallSummary && <OverallSummaryPage
      title={reportSections.overallSummary.title}
      footerTitle={t.summaryFooter}
      html={reportSections.overallSummary.html}
      footerLogoBuffer2={footerLogoBuffer2}
      t={t}
    />}

    {reportSections.recommendation && <StructuredSummaryPage
      title={reportSections.recommendation.title}
      footerTitle={t.recommendationFooter}
      html={reportSections.recommendation.html}
      footerLogoBuffer2={footerLogoBuffer2}
      t={t}
    />}

    <ScalingSystemPage footerLogoBuffer2={footerLogoBuffer2} t={t} />
  </Document>
);

const formatPlaystyle = (playstyle: string | null | undefined): string => {
  if (!playstyle) return "N/A";
  return playstyle.replace(/_/g, " ");
};

const getPositionImageFilename = (
  position: string | null | undefined
): string | null => {
  if (!position) return null;
  switch (position) {
    case "GOALTENDER":
      return "goalie.png";
    case "LEFT_DEFENSIVE":
      return "left-defend.png";
    case "RIGHT_DEFENSIVE":
      return "right-defend.png";
    case "CENTER":
      return "center.png";
    case "LEFT_WING":
      return "left-wing.png";
    case "RIGHT_WING":
      return "right-wing.png";
    default:
      return null;
  }
};

const JUNIOR_TIER_REGEX = /\s*(U\d{1,2}|J\d{1,2}|Jr\.?|AAA|AA|A)\s*/gi;

function getBaseTeamName(name: string): string {
  return name.replace(JUNIOR_TIER_REGEX, " ").trim();
}

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function fetchAndValidateLogo(
  name: string,
  type: "team" | "league"
): Promise<string | null> {
  if (!name) return null;

  // This internal helper function remains mostly the same but is more robust
  async function getAndValidateLogoDataUrl(logoPath: string): Promise<string | null> {
    try {
      const imageUrl = `https://assets.graet.com/${logoPath}`;
      const imageResponse = await fetch(imageUrl);
  
      if (!imageResponse.ok) {
        console.log(`Validation failed for ${logoPath}: HTTP status ${imageResponse.status}`);
        return null;
      }
  
      const buffer = await imageResponse.arrayBuffer();
  
      if (!buffer || buffer.byteLength < 4) { // Need at least a few bytes to check
          console.log(`Validation failed for ${logoPath}: Response body was empty or too small.`);
          return null;
      }

      // "Magic Number" detection to identify file type from its content
      const uint8 = new Uint8Array(buffer);
      let contentType: string | null = null;

      // Check for PNG: 89 50 4E 47 (hex) -> .PNG
      if (uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4E && uint8[3] === 0x47) {
        contentType = 'image/png';
      } 
      // Check for JPEG: FF D8 FF (hex)
      else if (uint8[0] === 0xFF && uint8[1] === 0xD8 && uint8[2] === 0xFF) {
        contentType = 'image/jpeg';
      } 
      // If it's neither, it's likely an SVG or another unsupported format.
      else {
        console.log(`INFO: Skipping logo for "${logoPath}" because it is not a valid PNG or JPEG file (based on content).`);
        return null;
      }
  
      const base64 = Buffer.from(buffer).toString("base64");
  
      return `data:${contentType};base64,${base64}`;
  
    } catch (e) {
      console.error(`Error during fetch for logo path: ${logoPath}`, e);
      return null;
    }
  };

  // League search remains the same as it's usually more direct
  if (type === "league") {
    const query = `query SearchLeagues($filter: LeaguesFilter!) { leagues(filter: $filter, pagination: { first: 10 }) { edges { node { name logo } } } }`;
    const variables = { filter: { searchQuery: name } };
    
    try {
      const response = await fetch("https://api.graet.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) return null;

      const result = await response.json();
      const edges = result.data?.leagues?.edges || [];
      const normalizedSearchName = normalizeString(name);

      for (const edge of edges) {
        const foundNode = edge.node;
        if (foundNode && foundNode.logo && foundNode.name) {
          const normalizedFoundName = normalizeString(foundNode.name);

          if (normalizedFoundName === normalizedSearchName) {
            const validatedLogoUrl = await getAndValidateLogoDataUrl(foundNode.logo);
            if (validatedLogoUrl) {
              return validatedLogoUrl;
            }
          }
        }
      }
    } catch (error) {
      console.error(`Failed to fetch logo for league: ${name}`, error);
    }
    
    console.log(`All attempts to find a VALID and CORRECT logo for league "${name}" have failed.`);
    return null;
  }

  if (type === "team") {
    const query = `query SearchTeams($filter: TeamsFilter!, $pagination: Pagination) { teams(filter: $filter, pagination: $pagination) { edges { node { name logo } } } }`;
    const variables = {
      filter: { searchQuery: getBaseTeamName(name) }, // Search with the cleaner base name
      pagination: { first: 10 }, 
    };

    try {
      const response = await fetch("https://api.graet.dev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
      });

      if (response.ok) {
        const result = await response.json();
        const edges = result.data?.teams?.edges || [];
        const normalizedSearchName = normalizeString(name);
        const normalizedBaseSearchName = normalizeString(getBaseTeamName(name));

        // PASS 1: Try for an exact match first
        for (const edge of edges) {
          const foundNode = edge.node;
          if (foundNode && foundNode.logo && normalizeString(foundNode.name) === normalizedSearchName) {
            const validatedLogoUrl = await getAndValidateLogoDataUrl(foundNode.logo);
            if (validatedLogoUrl) {
              console.log(`SUCCESS: Found and validated exact logo for "${name}"`);
              return validatedLogoUrl;
            }
          }
        }

        // PASS 2: If no exact match, try for a base name (sister team) match
        for (const edge of edges) {
          const foundNode = edge.node;
          if (foundNode && foundNode.logo) {
            const normalizedBaseFoundName = normalizeString(getBaseTeamName(foundNode.name));
            if (normalizedBaseFoundName === normalizedBaseSearchName) {
              const validatedLogoUrl = await getAndValidateLogoDataUrl(foundNode.logo);
              if (validatedLogoUrl) {
                console.log(`SUCCESS: Validated logo for "${name}" using sister team "${foundNode.name}"`);
                return validatedLogoUrl;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`API error during logo search for team: "${name}"`, error);
    }
  }

  console.log(`All attempts to find a VALID and CORRECT logo for team "${name}" have failed.`);
  return null;
}

async function fetchTeamLogos(
  seasonalStatsHtml: string | null
): Promise<Map<string, string>> {
  const teamLogosMap = new Map<string, string>();
  if (!seasonalStatsHtml) {
    return teamLogosMap;
  }

  const root = parse(seasonalStatsHtml);
  const teamNames = new Set<string>();
  root
    .querySelectorAll("tr")
    .slice(1)
    .forEach((row) => {
      const cell = row.querySelector("td");
      if (cell) {
        teamNames.add(cell.innerText.trim());
      }
    });

  const logoPromises = Array.from(teamNames).map(async (teamName) => {
    const logoDataUrl = await fetchAndValidateLogo(teamName, "team");
    if (logoDataUrl) {
      return { teamName, logoDataUrl };
    }
    return null;
  });

  const results = await Promise.all(logoPromises);

  for (const result of results) {
    if (result) {
      teamLogosMap.set(result.teamName, result.logoDataUrl);
    }
  }

  return teamLogosMap;
}

async function fetchGamePageImages(gameDetails: GameDetails | null) {
  if (!gameDetails) {
    return { teamALogo: null, teamBLogo: null, leagueLogo: null };
  }

  const { teamA, teamB, league } = gameDetails;

  const [teamALogo, teamBLogo, leagueLogo] = await Promise.all([
    fetchAndValidateLogo(teamA.name, "team"),
    fetchAndValidateLogo(teamB.name, "team"),
    league ? fetchAndValidateLogo(league, "league") : Promise.resolve(null),
  ]);

  return { teamALogo, teamBLogo, leagueLogo };
}

// --- 6. API ENDPOINT ---
export async function POST(request: Request) {
  try {
    let backgroundBuffer: Buffer | null = null;
    let logoOverlayBuffer: Buffer | null = null;
    let footerLogoBuffer: Buffer | null = null;
    let footerLogoBuffer2: Buffer | null = null;

    try {
      const backgroundPath = path.join(
        process.cwd(),
        "public",
        "reportBackground.png"
      );
      backgroundBuffer = await fs.readFile(backgroundPath);

      const logoOverlayPath = path.join(process.cwd(), "public", "premium.png");
      logoOverlayBuffer = await fs.readFile(logoOverlayPath);

      const footerLogoPath = path.join(process.cwd(), "public", "graet.png");
      footerLogoBuffer = await fs.readFile(footerLogoPath);

      const footerLogoPath2 = path.join(process.cwd(), "public", "graet2.png");
      footerLogoBuffer2 = await fs.readFile(footerLogoPath2);
    } catch (error) {
      console.error("Could not read one or more static image files:", error);
    }

    const {
      reportHtml,
      reportHtmlBlueprint,
      playerContext,
      teamContext,
      traitRatings,
      targetLang,
      gameContext,
      reportType,
    } = await request.json();
    if (!reportHtml || !reportHtmlBlueprint || !traitRatings) {
      return new NextResponse(
        "Missing reportHtml, blueprint, or traitRatings for PDF generation",
        {
          status: 400,
        }
      );
    }

    const t = await getTranslations(targetLang || "EN");
    const locale = getLocaleForLang(targetLang || "EN");

    let playerImageSrc: string | null = null;
    if (playerContext?.avatar) {
      const playerImageUrl = `https://assets.graet.com/${playerContext.avatar}`;
      try {
        const response = await fetch(playerImageUrl);
        if (response.ok) {
          const contentType =
            response.headers.get("content-type") || "image/jpeg";
          const arrayBuffer = await response.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          playerImageSrc = `data:${contentType};base64,${base64}`;
        } else {
          console.error(
            `Failed to fetch player avatar: ${response.status} ${response.statusText}`
          );
        }
      } catch (error) {
        console.error("Error fetching player avatar:", error);
      }
    }

    if (!playerImageSrc) {
      try {
        const playerImagePath = path.join(
          process.cwd(),
          "public",
          "player.png"
        );
        const fileBuffer = await fs.readFile(playerImagePath);
        const base64 = fileBuffer.toString("base64");
        playerImageSrc = `data:image/png;base64,${base64}`;
      } catch (error) {
        console.error("Could not read fallback player image file:", error);
      }
    }

    let positionImageBuffer: Buffer | null = null;
    const positionImageFile = getPositionImageFilename(
      playerContext?.bio?.position
    );

    if (positionImageFile) {
      try {
        const imagePath = path.join(process.cwd(), "public", positionImageFile);
        positionImageBuffer = await fs.readFile(imagePath);
      } catch (error) {
        console.error(
          `Could not read position image file: ${positionImageFile}`,
          error
        );
      }
    }

    const reportSections = splitReportByHeadings(
      reportHtmlBlueprint,
      reportHtml
    );
    const teamLogosMap = await fetchTeamLogos(
      reportSections.seasonalStats as string | null
    );

    const gameDetails: GameDetails | null = gameContext
      ? {
          teamA: {
            name: gameContext.teamA?.name || "Team A",
            score: gameContext.teamAScore || null,
          },
          teamB: {
            name: gameContext.teamB?.name || "Team B",
            score: gameContext.teamBScore || null,
          },
          league: gameContext.league?.name || null,
          gameDate: gameContext.gameDate 
            ? new Date(gameContext.gameDate).toLocaleDateString(locale, {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                timeZone: 'UTC',
              }).toUpperCase()
            : null,
        }
      : null;

    const gamePageLogos = await fetchGamePageImages(gameDetails);

    const formattedPlayerName = (playerContext?.name || "")
      .toLowerCase()
      .replace(/\s+/g, "-");
    const playerProfileUrl = `https://www.graet.com/${formattedPlayerName}`;
    const playerQrCodeDataUrl = await generateQrCodeDataUrl(playerProfileUrl);

    const gameDummyUrl = "https://www.graet.com";
    const gameQrCodeDataUrl = await generateQrCodeDataUrl(gameDummyUrl);

    const doc = (
      <ReportDocument
        reportSections={reportSections}
        playerContext={playerContext}
        teamContext={teamContext}
        gameDetails={gameDetails}
        backgroundBuffer={backgroundBuffer}
        playerImageSrc={playerImageSrc}
        logoOverlayBuffer={logoOverlayBuffer}
        footerLogoBuffer={footerLogoBuffer}
        footerLogoBuffer2={footerLogoBuffer2}
        positionImageBuffer={positionImageBuffer}
        playerQrCodeDataUrl={playerQrCodeDataUrl}
        gameQrCodeDataUrl={gameQrCodeDataUrl}
        traitRatings={traitRatings}
        teamLogosMap={teamLogosMap}
        gamePageLogos={gamePageLogos}
        t={t}
        locale={locale}
        reportType={reportType}
      />
    );

    const pdfStream = await pdf(doc).toBlob();

    return new NextResponse(pdfStream, {
      headers: { "Content-Type": "application/pdf" },
    });
  } catch (error) {
    console.error("Failed to generate PDF:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new NextResponse(
      JSON.stringify({
        error: "Failed to generate PDF",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}
//app/api/pdf/route.tsx

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
import { parse, HTMLElement } from "node-html-parser";
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

// --- TYPE DEFINITIONS ---

type GameDetails = {
  homeTeam: { name: string; score: number | null };
  awayTeam: { name: string; score: number | null };
  gameDate: string | null;
  league: string | null;
};

type TraitRatings = {
  skating: number;
  puckSkills: number;
  hockeyIq: number;
  shot: number;
  competeLevel: number;
  defensiveGame: number;
};

type ReportSection = {
  title: string;
  html: string;
};

// --- 2. FONT REGISTRATION ---
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

// --- 3. STYLING ---
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
    marginBottom: 10,
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
  seasonCol: { width: 80 },
  teamCol: { flex: 1 },
  gpCol: { width: 40 },
  gCol: { width: 40 },
  aCol: { width: 40 },
  tpCol: { width: 40 },
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

  // --- MODIFICATION START: Unifying Info/Summary Page Styles ---
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
    marginBottom: 45, // CHANGED: Was 40, now matches traitPageTitle
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
    fontSize: 32, // Matched to traitPageTitle
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
    width: "99%", // Increased width for better flow
    alignSelf: "center",
  },
  infoPageIntroEmphasized: {
    fontWeight: 'bold',
    fontSize: 12, // Slightly larger than the base 11pt for emphasis
  },
  introHighlightText: {
    fontWeight: 'bold',
    fontSize: 13, // A bit larger than the base 11pt font for emphasis
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
    // Matched to subSectionTitle
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
  // --- MODIFICATION END ---

  footerLogo: {
    width: 50,
    height: "auto",
  },
  placeholderContainer: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: "#F3F4F6", // Same as the original placeholder
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#9CA3AF", // A medium-light gray for a subtle look
  },

  // For the small icon in the Stats Table
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

  sections.gameInfo = contentHrSplit.length > 1 ? contentHrSplit[1] : null;

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
    skating: "skating",
    "puck skills": "puckSkills",
    "hockey iq": "hockeyIq",
    shot: "shot",
    "compete level": "competeLevel",
    "defensive game": "defensiveGame",
    "overall summary": "overallSummary",
    projection: "projection",
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

  const subSections: { title: string | null; content: string }[] = [];
  // The regex splits the string into sections, keeping the <strong> tag as a delimiter.
  const parts = html
    .split(/(?=<strong>.+?:<\/strong>)/g)
    .filter((part) => part.trim() !== "");

  for (const part of parts) {
    // For each section, we parse it to easily manipulate its structure.
    const partRoot = parse(part);
    const titleNode = partRoot.querySelector("strong");

    if (titleNode) {
      // --- CASE 1: This part has a title (e.g., "Gap Control: <p>...</p>") ---

      // Extract the title text.
      const title = decodeHtmlEntities(
        titleNode.innerText.replace(":", "").trim()
      );

      // CRITICAL FIX: Remove the <strong> tag itself from the content.
      // This prevents "Gap Control:" from appearing twice.
      titleNode.remove();

      // The rest of the HTML in the part is the content.
      const content = partRoot.innerHTML.trim();
      subSections.push({ title, content });
    } else {
      const content = part.trim();

      if (content.startsWith("<p>") && content.endsWith("</p>")) {
        subSections.push({ title: null, content: content });
      } else {
        subSections.push({ title: null, content: `<p>${content}</p>` });
      }
    }
  }

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

  // Split by space or hyphen, filter out empty parts
  const parts = name.split(/[\s-]+/).filter(Boolean);

  return parts
    .map((part) => part[0]) // Get the first letter of each part
    .join("")
    .toUpperCase()
    .slice(0, 3); // Limit to a max of 3 initials
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
  // Using a random ID is safe here as the PDF is rendered once from scratch.
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

  // This renders the half-filled star
  return (
    <Svg viewBox="0 0 24 24" style={styles.starSvg}>
      <Defs>
        <ClipPath id={clipId}>
          {/* This rectangle clips the fill to the left half of the star */}
          <Rect x="0" y="0" width="12" height="24" />
        </ClipPath>
      </Defs>
      {/* First, draw the empty star as a background */}
      <Path d={starPath} stroke={starColor} strokeWidth={1.5} />
      {/* Then, draw the filled star on top, but apply the clip path */}
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
          // If the rating is 3.5, this will be true for i=0, 1, 2 (rating >= 1, 2, 3)
          state = "filled";
        } else if (rating >= i + 0.5) {
          // If the rating is 3.5, this will be true for i=3 (rating >= 3.5)
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

const StatsTable = ({
  html,
  teamLogosMap,
  t,
}: {
  html: string;
  teamLogosMap: Map<string, string>;
  t: any;
}) => {
  if (!html) return null;

  const root = parse(html);
  const table = root.querySelector("table");
  if (!table) return null;

  const rows = table.querySelectorAll("tr");
  const dataRows = Array.from(rows).slice(1);

  const statsData = dataRows
    .map((row) => {
      const cells = row.querySelectorAll("td");
      if (cells.length < 7) return null;

      return {
        team: cells[0]?.innerText?.trim() || "",
        league: cells[1]?.innerText?.trim() || "",
        season: cells[2]?.innerText?.trim() || "",
        gamesPlayed: cells[3]?.innerText?.trim() || "0",
        goals: cells[4]?.innerText?.trim() || "0",
        assists: cells[5]?.innerText?.trim() || "0",
        points: cells[6]?.innerText?.trim() || "0",
      };
    })
    .filter(Boolean);

  const groupedBySeason = statsData.reduce((acc: any, row: any) => {
    if (!acc[row.season]) {
      acc[row.season] = [];
    }
    acc[row.season].push(row);
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
        <View style={[styles.tableCol, styles.seasonCol]}>
          <Text style={styles.tableHeaderCell}>{t.statsSeason}</Text>
        </View>
        <View style={[styles.tableCol, styles.teamCol]}>
          <Text style={styles.tableHeaderCell}>{t.statsTeam}</Text>
        </View>
        <View style={[styles.tableCol, styles.gpCol, styles.numericCol]}>
          <Text style={styles.numericHeaderCell}>{t.statsGP}</Text>
        </View>
        <View style={[styles.tableCol, styles.gCol, styles.numericCol]}>
          <Text style={styles.numericHeaderCell}>{t.statsG}</Text>
        </View>
        <View style={[styles.tableCol, styles.aCol, styles.numericCol]}>
          <Text style={styles.numericHeaderCell}>{t.statsA}</Text>
        </View>
        <View style={[styles.tableCol, styles.tpCol, styles.numericCol]}>
          <Text style={styles.numericHeaderCell}>{t.statsTP}</Text>
        </View>
      </View>
      <View style={styles.tableBody}>
        {allRows.map((row: any, index: number) => {
          const isLastRow = index === allRows.length - 1;
          const logoSrc = teamLogosMap.get(row.team);

          return (
            <View
              key={`${row.season}-${index}`}
              style={
                isLastRow
                  ? [styles.tableRow, styles.tableBodyRowLast]
                  : styles.tableRow
              }
            >
              <View style={[styles.tableCol, styles.seasonCol]}>
                <Text style={styles.tableCell}>
                  {row.isFirstInSeason
                    ? row.season.replace("-", "/").slice(2)
                    : ""}
                </Text>
              </View>
              <View style={[styles.tableCol, styles.teamCol]}>
                <View style={styles.teamNameContainer}>
                  {logoSrc ? (
                    <Image style={styles.teamIcon} src={logoSrc} />
                  ) : (
                    <View style={styles.teamIcon} />
                  )}
                  <Text style={styles.teamName}>{row.team}</Text>
                </View>
              </View>
              <View style={[styles.tableCol, styles.gpCol, styles.numericCol]}>
                <Text style={styles.numericCell}>{row.gamesPlayed}</Text>
              </View>
              <View style={[styles.tableCol, styles.gCol, styles.numericCol]}>
                <Text style={styles.numericCell}>{row.goals}</Text>
              </View>
              <View style={[styles.tableCol, styles.aCol, styles.numericCol]}>
                <Text style={styles.numericCell}>{row.assists}</Text>
              </View>
              <View style={[styles.tableCol, styles.tpCol, styles.numericCol]}>
                <Text style={styles.numericCell}>{row.points}</Text>
              </View>
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

// 2. UPDATE THE COMPONENT PROPS
interface HtmlRendererProps {
  html: string;
  // Add a flag to handle the special case for the stats table.
  isStatsTable?: boolean;
  // Add a prop for base styles (like font family) to be inherited.
  baseStyle?: Style;
  styleOverrides?: Partial<Record<StyleKey, Style>>;
  // Props needed only for StatsTable
  teamLogosMap?: Map<string, string>;
  t?: any;
}

const HtmlRenderer = ({
  html,
  isStatsTable = false,
  baseStyle = {},
  styleOverrides = {},
  teamLogosMap,
  t,
}: HtmlRendererProps) => {
  if (isStatsTable) {
    if (!teamLogosMap || !t) {
      console.error(
        "HtmlRenderer: 'teamLogosMap' and 't' are required when 'isStatsTable' is true."
      );
      return null;
    }
    return <StatsTable html={html} teamLogosMap={teamLogosMap} t={t} />;
  }

  if (!html) {
    return null;
  }

  const root = parse(html);

  const renderNode = (
    node: any,
    index: number,
    inheritedStyles: Style
  ): JSX.Element | JSX.Element[] | null => {
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
      // Element node
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

  // --- FIX 2: Start the recursion with the baseStyle prop ---
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
        {/* Render the large, main title */}
        <Text style={styles.summaryPageTitle}>{title}</Text>

        <View style={styles.summaryContentWrapper}>
          {/* Render the HTML content with the LARGER paragraph style */}
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

  // This uses the same parsing logic as TraitPage to find sub-headings
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

        {/* Renders sub-sections with styled titles, just like TraitPage */}
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
}: {
  html: string | null;
  footerLogoBuffer2: Buffer | null;
  teamLogosMap: Map<string, string>;
  t: any;
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
  homeTeamLogo,
  awayTeamLogo,
  leagueLogo,
  t,
}: {
  gameDetails: GameDetails | null;
  footerLogoBuffer2: Buffer | null;
  gameQrCodeDataUrl: string | null;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  leagueLogo: string | null;
  t: any;
}) => {
  if (!gameDetails) return null;

  const { homeTeam, awayTeam, gameDate, league } = gameDetails;
  const homeScore = homeTeam.score ?? "-";
  const awayScore = awayTeam.score ?? "-";

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
                {homeTeamLogo ? (
                  <Image style={styles.teamLogo} src={homeTeamLogo} />
                ) : (
                  
                  <TeamLogoPlaceholder
                    teamName={homeTeam.name}
                    containerStyle={styles.placeholderContainer}
                    textStyle={styles.placeholderText}
                  />
        
                )}
                <Text style={styles.teamNameText}>
                  {homeTeam.name || "Home Team"}
                </Text>
              </View>
              <View style={styles.scoreBlock}>
                <Text
                  style={styles.scoreText}
                >{`${homeScore} : ${awayScore}`}</Text>
              </View>
              <View style={styles.teamBlock}>
                {awayTeamLogo ? (
                  <Image style={styles.teamLogo} src={awayTeamLogo} />
                ) : (
                  
                  <TeamLogoPlaceholder
                    teamName={awayTeam.name}
                    containerStyle={styles.placeholderContainer}
                    textStyle={styles.placeholderText}
                  />
                  
                )}
                <Text style={styles.teamNameText}>
                  {awayTeam.name || "Away Team"}
                </Text>
              </View>
            </View>
          </View>

          {/* <View style={styles.qrCodeSection}>
            <View style={styles.qrCodeTextBlock}>
              <Text style={styles.qrCodeText}>
                {t.qrCheckGame}
              </Text>
              <View style={styles.qrCodeButton}>
                <Text style={styles.qrCodeButtonText}>{t.qrShowGame}</Text>
              </View>
            </View>
            {gameQrCodeDataUrl ? (
              <Image style={styles.qrCodePlaceholder} src={gameQrCodeDataUrl} />
            ) : (
              <View style={styles.qrCodePlaceholder} />
            )}
          </View> */}
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
              {(playerContext?.bio?.position || "Position").replace(/_/g, " ")}
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
                <Text style={styles.infoLabel}>{t.shootsLabel}</Text>
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

    <StatsPage
      html={reportSections.seasonalStats}
      footerLogoBuffer2={footerLogoBuffer2}
      teamLogosMap={teamLogosMap}
      t={t}
    />

    <ScoutedGamePage
      gameDetails={gameDetails}
      footerLogoBuffer2={footerLogoBuffer2}
      gameQrCodeDataUrl={gameQrCodeDataUrl}
      homeTeamLogo={gamePageLogos.homeTeamLogo}
      awayTeamLogo={gamePageLogos.awayTeamLogo}
      leagueLogo={gamePageLogos.leagueLogo}
      t={t}
    />

    <TraitPage
      title={reportSections.skating.title}
      html={reportSections.skating.html}
      rating={traitRatings.skating}
      footerLogoBuffer2={footerLogoBuffer2}
      t={t}
    />
    <TraitPage
      title={reportSections.puckSkills.title}
      html={reportSections.puckSkills.html}
      rating={traitRatings.puckSkills}
      footerLogoBuffer2={footerLogoBuffer2}
      t={t}
    />
    <TraitPage
      title={reportSections.hockeyIq.title}
      html={reportSections.hockeyIq.html}
      rating={traitRatings.hockeyIq}
      footerLogoBuffer2={footerLogoBuffer2}
      t={t}
    />
    <TraitPage
      title={reportSections.shot.title}
      html={reportSections.shot.html}
      rating={traitRatings.shot}
      footerLogoBuffer2={footerLogoBuffer2}
      t={t}
    />
    <TraitPage
      title={reportSections.competeLevel.title}
      html={reportSections.competeLevel.html}
      rating={traitRatings.competeLevel}
      footerLogoBuffer2={footerLogoBuffer2}
      t={t}
    />
    <TraitPage
      title={reportSections.defensiveGame.title}
      html={reportSections.defensiveGame.html}
      rating={traitRatings.defensiveGame}
      footerLogoBuffer2={footerLogoBuffer2}
      t={t}
    />

    <OverallSummaryPage
      title={reportSections.overallSummary.title}
      footerTitle={t.summaryFooter}
      html={reportSections.overallSummary.html}
      footerLogoBuffer2={footerLogoBuffer2}
      t={t}
    />

    {/* Use StructuredSummaryPage for the rest, which may have sub-headings */}
    <StructuredSummaryPage
      title={reportSections.projection.title}
      footerTitle={t.projectionFooter}
      html={reportSections.projection.html}
      footerLogoBuffer2={footerLogoBuffer2}
      t={t}
    />
    <StructuredSummaryPage
      title={reportSections.recommendation.title}
      footerTitle={t.recommendationFooter}
      html={reportSections.recommendation.html}
      footerLogoBuffer2={footerLogoBuffer2}
      t={t}
    />

    <ScalingSystemPage footerLogoBuffer2={footerLogoBuffer2} t={t} />
    {/* <ScoutingTeamPage footerLogoBuffer2={footerLogoBuffer2} t={t} /> */}
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

const JUNIOR_SUFFIX_REGEX = /\s+(U16|U18|U20|J18|J20|Jr\.?)$/i;

function getBaseTeamName(name: string): string {
  return name.replace(JUNIOR_SUFFIX_REGEX, "").trim();
}

async function fetchAndValidateLogo(
  name: string,
  type: "team" | "league"
): Promise<string | null> {
  if (!name) return null;

  // --- Helper to fetch and convert a logo from a path ---
  const getLogoDataUrl = async (logoPath: string): Promise<string | null> => {
    try {
      const imageUrl = `https://assets.graet.com/${logoPath}`;
      const imageResponse = await fetch(imageUrl);
      if (imageResponse.ok) {
        const contentType =
          imageResponse.headers.get("content-type") || "image/png";
        const buffer = await imageResponse.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        return `data:${contentType};base64,${base64}`;
      }
    } catch (e) {
      console.error(`Error converting logo path to data URL: ${logoPath}`, e);
    }
    return null;
  };

  // --- Logic for Leagues (Unchanged) ---
  if (type === "league") {
    const query = `query SearchLeagues($filter: LeaguesFilter!) { leagues(filter: $filter, pagination: { first: 5 }) { edges { node { logo } } } }`;
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
      for (const edge of edges) {
        if (edge.node.logo) {
          return await getLogoDataUrl(edge.node.logo);
        }
      }
    } catch (error) {
      console.error(`Failed to fetch logo for league: ${name}`, error);
    }
    return null;
  }

  // --- New Two-Step Logic for Teams ---
  if (type === "team") {
    const query = `query SearchTeams($filter: TeamsFilter!) { teams(filter: $filter, pagination: { first: 1 }) { edges { node { name logo } } } }`;

    // --- Attempt 1: Exact Match ---
    try {
      const exactVariables = { filter: { searchQuery: name } };
      const response = await fetch("https://api.graet.dev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables: exactVariables }),
      });
      if (response.ok) {
        const result = await response.json();
        const foundNode = result.data?.teams?.edges?.[0]?.node;
        if (
          foundNode &&
          foundNode.logo &&
          foundNode.name.trim().toLowerCase() === name.trim().toLowerCase()
        ) {
          console.log(`Found exact logo match for: "${name}"`);
          return await getLogoDataUrl(foundNode.logo);
        }
      }
    } catch (error) {
      console.error(`API error on exact match for team: ${name}`, error);
    }

    // --- Attempt 2: Base Name Match (if exact match failed) ---
    const baseName = getBaseTeamName(name);
    if (baseName !== name) {
      // Only try again if a suffix was actually stripped
      console.log(
        `Exact match failed for "${name}". Trying base name: "${baseName}"`
      );
      try {
        const baseVariables = { filter: { searchQuery: baseName } };
        const response = await fetch("https://api.graet.dev", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, variables: baseVariables }),
        });
        if (response.ok) {
          const result = await response.json();
          const foundNode = result.data?.teams?.edges?.[0]?.node;
          // For a base match, we accept if the result *starts with* the base name.
          // This allows "HK Dukla Trencin" to match "HK Dukla Trencin U18".
          if (
            foundNode &&
            foundNode.logo &&
            foundNode.name
              .trim()
              .toLowerCase()
              .startsWith(baseName.toLowerCase())
          ) {
            console.log(
              `Found base name logo match for "${baseName}" with result "${foundNode.name}"`
            );
            return await getLogoDataUrl(foundNode.logo);
          }
        }
      } catch (error) {
        console.error(
          `API error on base name match for team: ${baseName}`,
          error
        );
      }
    }
  }

  // If all attempts fail, return null.
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
    // Use our new, reliable helper function
    const logoDataUrl = await fetchAndValidateLogo(teamName, "team");

    // Only return an object if the logo is valid
    if (logoDataUrl) {
      return { teamName, logoDataUrl };
    }
    return null;
  });

  const results = await Promise.all(logoPromises);

  // Iterate through the results and populate the map only with valid entries
  for (const result of results) {
    if (result) {
      teamLogosMap.set(result.teamName, result.logoDataUrl);
    }
  }

  return teamLogosMap;
}

async function fetchGamePageImages(gameDetails: GameDetails | null) {
  if (!gameDetails) {
    return { homeTeamLogo: null, awayTeamLogo: null, leagueLogo: null };
  }

  const { homeTeam, awayTeam, league } = gameDetails;

  const [homeTeamLogo, awayTeamLogo, leagueLogo] = await Promise.all([
    fetchAndValidateLogo(homeTeam.name, "team"),
    fetchAndValidateLogo(awayTeam.name, "team"),
    league ? fetchAndValidateLogo(league, "league") : Promise.resolve(null),
  ]);

  return { homeTeamLogo, awayTeamLogo, leagueLogo };
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
        //console.log(`Fetching player avatar from: ${playerImageUrl}`);
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
        //console.log("Using fallback local player image.");
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

    let gameDetails: GameDetails | null = null;
    if (reportSections.gameInfo) {
      try {
        const parseApiUrl = new URL("/api/parse-game-info", request.url);

        const parseResponse = await fetch(parseApiUrl.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameInfoHtml: reportSections.gameInfo }),
        });

        if (parseResponse.ok) {
          gameDetails = await parseResponse.json();
        } else {
          console.error("Failed to parse game info, will use fallback.");
        }
      } catch (e) {
        console.error("Error calling parse-game-info API:", e);
      }
    }

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

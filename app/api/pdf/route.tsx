// app/api/pdf/route.tsx

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
  ClipPath, // Import ClipPath
  Stop,
  Rect,
  Path,
  Image
} from "@react-pdf/renderer";
import { parse, HTMLElement } from "node-html-parser";
import QRCode from 'qrcode';

// --- TYPE DEFINITIONS ---

type GameDetails = {
  homeTeam: { name: string; score: number | null };
  awayTeam: { name:string; score: number | null };
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

// --- 1. FONT REGISTRATION ---
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

// --- 2. STYLING ---
const styles = StyleSheet.create({
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
  infoBlock: { flexDirection: "column", gap: 8, width: "50%" },
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
    width: '100%',
  },
  qrCodeTextBlock: { flex: 1, paddingRight: 20, gap: 16, justifyContent: 'center' },
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
    marginBottom: 40,
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
  scoutedGamePageContainer: { display: 'flex', flexDirection: 'column', height: '100%' },
  scoutedGameTitle: {
    fontWeight: 'bold',
    fontStyle: 'italic',
    fontSize: 40,
    color: '#161160',
    textAlign: 'center',
    paddingTop: 60,
    paddingBottom: 20,
  },
  scoutedGameMainContent: {
    flex: 1,
    paddingHorizontal: 40,
  },
  gameBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'solid',
    padding: 24,
    minHeight: 400,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-around',
    width: '100%',
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
    width: 20,
    height: 20,
    backgroundColor: "#D1D5DB",
    marginHorizontal: 16,
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
    backgroundColor: "#F3F4F6",
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
  p: { fontSize: 10, marginBottom: 8, lineHeight: 1.4, color: '#374151' },
  h1: { fontWeight: "bold", fontSize: 18, marginBottom: 10 },
  h2: { fontWeight: "bold", fontSize: 16, marginBottom: 8 },
  h3: { fontWeight: "bold", fontSize: 14, marginBottom: 6 },
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
    width: 16,
    height: 16,
    backgroundColor: "#D1D5DB",
    borderRadius: 8,
    marginRight: 8,
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
  
  // Summary & Info Page Styles
  summaryPageContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
    paddingBottom: 100,
  },
  summaryPageTitle: {
    fontWeight: 'bold',
    fontStyle: 'italic',
    fontSize: 36,
    color: '#161160',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 40,
  },
  summaryContentWrapper: {
    width: '90%',
  },
  summaryParagraph: {
    fontSize: 12,
    lineHeight: 1.6,
    color: '#1F2937',
    marginBottom: 16,
  },
  infoPageContainer: {
    display: 'flex',
    flexDirection: 'column',
    paddingHorizontal: 40,
    paddingTop: 100,
    paddingBottom: 100,
  },
  infoPageTitle: {
    fontWeight: 'bold',
    fontStyle: 'italic',
    fontSize: 36,
    color: '#161160',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 30,
  },
  infoPageIntroText: {
    fontSize: 11.5,
    lineHeight: 1.6,
    color: '#374151',
    marginBottom: 40,
    textAlign: 'left',
    width: '80%',
  },

  // Scaling System Page Styles
  scalingGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  scalingColumn: {
    width: '48%',
    flexDirection: 'column',
    gap: 30,
  },
  ratingBlock: {
    flexDirection: 'column',
    gap: 8,
  },
  ratingTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  ratingDescription: {
    fontSize: 10.5,
    lineHeight: 1.5,
    color: '#4B5563',
  },

  // Scouting Team Page Styles
  scoutProfile: {
    marginBottom: 28,
  },
  scoutName: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#161160',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  scoutDescription: {
    fontSize: 11,
    lineHeight: 1.6,
    color: '#374151',
  },
  
  // Footer Logo
  footerLogo: {
    width: 50,
    height: 'auto',
  },
});

const coverPageStyles = StyleSheet.create({
  page: {
    backgroundColor: '#000000',
    color: '#FFFFFF',
    fontFamily: 'DejaVu',
  },
  pageContainer: {
    position: 'relative',
    flex: 1,
  },
  fullPageBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: -1,
  },
  contentWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: 40,
  },
  headerSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 40,
    paddingTop: 140,
  },
  imagePositioningContainer: {
    width: 280,
    height: 280,
    position: 'relative',
  },
  imageClippingContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 140,
    overflow: 'hidden',
  },
  playerImage: {
    width: '100%',
    height: '100%',
  },
  logoOverlay: {
    position: 'absolute',
    width: '35%',
    height: 'auto',
    bottom: -20,
    right: -15,
  },
  titleBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    marginTop: 10
  },
  playerFirstName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  playerLastName: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 4,
    marginTop: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerLogo: {
    width: 90,
    height: 'auto',
  },
  reportDateText: {
    fontSize: 11,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

const playstylePageStyles = StyleSheet.create({
  page: { fontFamily: 'DejaVu', backgroundColor: '#FFFFFF' },
  pageContainer: { position: 'relative', flex: 1 },
  contentWrapper: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 40 },
  mainContent: { width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 60 },
  imageContainer: { width: 400, height: 400, justifyContent: 'center', alignItems: 'center' },
  positionImage: { width: '100%', height: 'auto', transform: 'rotate(-90deg)' },
  textContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '90%' },
  playstyleName: { fontSize: 24, fontWeight: 'bold', fontStyle: 'italic', color: '#161160', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', width: '100%' },
  playstyleDescription: { fontSize: 14, lineHeight: 1.6, color: '#374151', textAlign: 'center' },
  footer: { position: 'absolute', bottom: 40, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
});

// --- 3. HELPER FUNCTIONS & COMPONENTS ---
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

const formatDate = (d: string) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      })
    : "N/A";


const decodeHtmlEntities = (text: string): string => {
  if (!text) return '';
  return text.replace(/&/gi, '&');
};

const escapeForPdf = (text: string): string => {
  if (!text) return '';
  return text.replace(/&/g, '\u0026');
};

const generateQrCodeDataUrl = async (text: string): Promise<string | null> => {
  try {
    const dataUrl = await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'H',
      margin: 1,
      color: {
        dark: '#161160FF',
        light: '#00000000',
      },
    });
    return dataUrl;
  } catch (err) {
    console.error('Failed to generate QR code', err);
    return null;
  }
};

const splitReportByHeadings = (
  html: string
): { [key: string]: string | null } => {
  if (!html) return {};
  const root = parse(html);
  const sections: { [key: string]: string } = {};
  const hrSplit = root.innerHTML.split(/<hr\s*\/?>/i);
  const gameInfoHtml = hrSplit.length > 1 ? hrSplit[1] : null;
  const mainContentHtml =
    hrSplit.length > 2
      ? hrSplit.slice(2).join("<hr />")
      : hrSplit.length === 1
        ? hrSplit[0]
        : "";
  const mainRoot = parse(mainContentHtml);
  const tableNode = mainRoot.querySelector("table");
  const tableHtml = tableNode ? tableNode.outerHTML : null;
  if (tableNode) tableNode.remove();
  const analysisParts =
    mainRoot.innerHTML.match(/<h3[\s\S]*?(?=<h3|$)/g) || [];
  analysisParts.forEach((part) => {
    const partRoot = parse(part);
    const heading = partRoot.querySelector("h3");
    if (heading) {
      const headingText = heading.innerText.trim().toLowerCase();
      if (headingText.startsWith("seasonal stats")) return;
      const key = headingText
        .replace(/\s*\(.*?\)\s*/g, "")
        .trim()
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]+(.)?/g, (m, chr) =>
          chr ? chr.toUpperCase() : ""
        );
      sections[key] = part;
    }
  });
  return { gameInfo: gameInfoHtml, seasonalStats: tableHtml, ...sections };
};

const parseTraitHtml = (html: string) => {
  const root = parse(html);
  const heading = root.querySelector('h3');
  
  if (heading) {
    heading.remove();
  }

  const subSections: { title: string; content: string }[] = [];
  const contentHtml = root.innerHTML;
  const parts = contentHtml.split(/(?=<strong>.+?:<\/strong>)/g).filter(part => part.trim() !== '');

  if (parts.length === 0 && contentHtml.trim()) {
    subSections.push({ title: 'Analysis', content: contentHtml });
  } else {
    for (const part of parts) {
      const partRoot = parse(part);
      const titleNode = partRoot.querySelector('strong');
      
      if (titleNode) {
        const title = decodeHtmlEntities(titleNode.innerText.replace(':', '').trim());
        titleNode.remove();
        const content = partRoot.innerHTML.trim();
        subSections.push({ title, content });
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

// --- MODIFICATION START: NEW STAR AND STAR RATING COMPONENTS ---
const Star = ({ fillType }: { fillType: 'full' | 'half' | 'empty' }) => {
  const starPath = "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27z";
  const clipId = `clip-${Math.random()}`;

  if (fillType === 'full') {
    return (
      <Svg viewBox="0 0 24 24" style={styles.starSvg}>
        <Path d={starPath} fill="#2B21C1" />
      </Svg>
    );
  }

  if (fillType === 'half') {
    return (
      <Svg viewBox="0 0 24 24" style={styles.starSvg}>
        <Defs>
          <ClipPath id={clipId}>
            <Rect x="0" y="0" width="12" height="24" />
          </ClipPath>
        </Defs>
        <Path d={starPath} fill="#E8E6F9" stroke="#2B21C1" strokeWidth={1.5} />
        <Path d={starPath} fill="#2B21C1" clipPath={`url(#${clipId})`} />
      </Svg>
    );
  }

  return (
    <Svg viewBox="0 0 24 24" style={styles.starSvg}>
      <Path d={starPath} fill="#E8E6F9" stroke="#2B21C1" strokeWidth={1.5} />
    </Svg>
  );
};

const StarRating = ({ rating, max = 5 }: { rating: number; max?: number }) => (
  <View style={styles.starsContainer}>
    {Array.from({ length: max }).map((_, i) => {
      const starValue = i + 1;
      let fillType: 'full' | 'half' | 'empty' = 'empty';
      if (rating >= starValue) {
        fillType = 'full';
      } else if (rating > i && rating < starValue) {
        fillType = 'half';
      }
      return <Star key={i} fillType={fillType} />;
    })}
  </View>
);
// --- MODIFICATION END ---

const CoverPage = ({
  playerContext,
  backgroundBuffer,
  playerImageBuffer,
  logoOverlayBuffer,
  footerLogoBuffer,
}: {
  playerContext: any;
  backgroundBuffer: Buffer | null;
  playerImageBuffer: Buffer | null;
  logoOverlayBuffer: Buffer | null;
  footerLogoBuffer: Buffer | null;
}) => {
  const nameParts = playerContext?.name?.split(' ') || ['Player', 'Name'];
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ');
  const reportDate = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <Page size="A4" style={coverPageStyles.page}>
      <View style={coverPageStyles.pageContainer}>
        {backgroundBuffer && (
          <Image style={coverPageStyles.fullPageBackground} src={{ data: backgroundBuffer, format: 'png' }} />
        )}
        <View style={coverPageStyles.contentWrapper}>
          <View style={coverPageStyles.headerSection}>
            <View style={coverPageStyles.imagePositioningContainer}>
              {playerImageBuffer && (
                <View style={coverPageStyles.imageClippingContainer}>
                  <Image style={coverPageStyles.playerImage} src={{ data: playerImageBuffer, format: 'png' }} />
                </View>
              )}
              {logoOverlayBuffer && (
                <Image style={coverPageStyles.logoOverlay} src={{ data: logoOverlayBuffer, format: 'png' }} />
              )}
            </View>
            <View style={coverPageStyles.titleBlock}>
              <Text style={coverPageStyles.playerFirstName}>{firstName}</Text>
              <Text style={coverPageStyles.playerLastName}>{lastName}</Text>
              <Text style={coverPageStyles.reportTitle}>Development Report</Text>
            </View>
          </View>
        </View>
        <View style={coverPageStyles.footer}>
          {footerLogoBuffer ? (
            <Image style={coverPageStyles.footerLogo} src={{ data: footerLogoBuffer, format: 'png' }} />
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
}: {
  playerContext: any;
  positionImageBuffer: Buffer | null;
  footerLogoBuffer2: Buffer | null;
}) => {
  const playerType = playerContext?.bio?.playerType;
  const formattedPlaystyle = formatPlaystyle(playerType);
  const description = playstyleDescriptions[playerType] || 'No description available for this playstyle.';

  return (
    <Page size="A4" style={playstylePageStyles.page}>
      <BackgroundGradient2 />
      <View style={playstylePageStyles.pageContainer}>
        <View style={playstylePageStyles.contentWrapper}>
          <View style={playstylePageStyles.mainContent}>
            <View style={playstylePageStyles.imageContainer}>
              {positionImageBuffer ? (
                <Image style={playstylePageStyles.positionImage} src={{ data: positionImageBuffer, format: 'png' }} />
              ) : (
                <View />
              )}
            </View>
            <View style={playstylePageStyles.textContainer}>
              <Text style={playstylePageStyles.playstyleName}>{formattedPlaystyle}</Text>
              <Text style={playstylePageStyles.playstyleDescription}>{description}</Text>
            </View>
          </View>
        </View>
        <View style={playstylePageStyles.footer}>
          {footerLogoBuffer2 ? (
            <Image style={styles.footerLogo} src={{ data: footerLogoBuffer2, format: 'png' }} />
          ) : (
            <Text style={styles.logoPlaceholder}>GRAET</Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.gameFooterText}>BIO</Text>
            <Text
              style={styles.pageNumber}
              render={({ pageNumber, totalPages }) => `PAGE ${pageNumber} OF ${totalPages}`}
              fixed
            />
          </View>
        </View>
      </View>
    </Page>
  );
};

// --- MODIFICATION START: CORRECTED StatsTable COMPONENT ---
const StatsTable = ({ html }: { html: string }) => {
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
          <Text style={styles.tableHeaderCell}>Season</Text>
        </View>
        <View style={[styles.tableCol, styles.teamCol]}>
          <Text style={styles.tableHeaderCell}>Team</Text>
        </View>
        <View style={[styles.tableCol, styles.gpCol, styles.numericCol]}>
          <Text style={styles.numericHeaderCell}>GP</Text>
        </View>
        <View style={[styles.tableCol, styles.gCol, styles.numericCol]}>
          <Text style={styles.numericHeaderCell}>G</Text>
        </View>
        <View style={[styles.tableCol, styles.aCol, styles.numericCol]}>
          <Text style={styles.numericHeaderCell}>A</Text>
        </View>
        <View style={[styles.tableCol, styles.tpCol, styles.numericCol]}>
          <Text style={styles.numericHeaderCell}>TP</Text>
        </View>
      </View>
      <View style={styles.tableBody}>
        {allRows.map((row: any, index: number) => {
          const isLastRow = index === allRows.length - 1;
          
          return (
            <View
              key={`${row.season}-${index}`}
              style={isLastRow ? [styles.tableRow, styles.tableBodyRowLast] : styles.tableRow}
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
                  <View style={styles.teamIcon} />
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
// --- MODIFICATION END ---

const HtmlRenderer = ({
  html,
  isStatsTable = false,
  ignoreHeadings = [],
  styleOverrides = {},
}: {
  html: string;
  isStatsTable?: boolean;
  ignoreHeadings?: string[];
  styleOverrides?: { [key: string]: any };
}) => {
  if (isStatsTable) {
    return <StatsTable html={html} />;
  }

  const root = parse(html);
  const renderNode = (node: any, index: number): JSX.Element | null => {
    if (node.nodeType === 3) {
      const decodedText = decodeHtmlEntities(node.text);
      const escapedText = escapeForPdf(decodedText);
      return <Text key={index}>{escapedText}</Text>;
    }

    if (node.nodeType === 1) {
      const element = node as HTMLElement;
      const tagName = element.tagName.toLowerCase();
      
      if (ignoreHeadings.includes(tagName)) {
        return null;
      }

      const children = element.childNodes.map(renderNode);
      
      const getStyle = (baseStyle: any, overrideStyle: any) => 
        overrideStyle ? [baseStyle, overrideStyle] : baseStyle;

      switch (tagName) {
        case "h1": return <Text key={index} style={getStyle(styles.h1, styleOverrides.h1)}>{children}</Text>;
        case "h2": return <Text key={index} style={getStyle(styles.h2, styleOverrides.h2)}>{children}</Text>;
        case "h3": return <Text key={index} style={getStyle(styles.h3, styleOverrides.h3)}>{children}</Text>;
        case "p": return <Text key={index} style={getStyle(styles.p, styleOverrides.p)}>{children}</Text>;
        case "strong": return <Text key={index} style={styles.strong}>{children}</Text>;
        case "em": return <Text key={index} style={styles.em}>{children}</Text>;
        case "ul": return <View key={index} style={styles.ul}>{children}</View>;
        case "li":
          return (
            <View key={index} style={styles.li}>
              <Text style={styles.liBullet}>• </Text>
              <Text>{children}</Text>
            </View>
          );
        default:
          return <View key={index}>{children}</View>;
      }
    }
    return null;
  };
  return <>{root.childNodes.map(renderNode)}</>;
};

const SummaryPage = ({
  title,
  footerTitle,
  html,
  footerLogoBuffer2,
}: {
  title: string;
  footerTitle: string;
  html: string | null;
  footerLogoBuffer2: Buffer | null;
}) => {
  if (!html) return null;

  return (
    <Page size="A4" style={styles.page} wrap>
      <BackgroundGradient />
      <View style={styles.summaryPageContainer}>
        <Text style={styles.summaryPageTitle}>{title}</Text>
        <View style={styles.summaryContentWrapper}>
          <HtmlRenderer
            html={html}
            ignoreHeadings={['h3']}
            styleOverrides={{ p: styles.summaryParagraph }}
          />
        </View>
      </View>
      <View style={styles.footer} fixed>
        {footerLogoBuffer2 ? (
          <Image style={styles.footerLogo} src={{ data: footerLogoBuffer2, format: 'png' }} />
        ) : (
          <Text style={styles.logoPlaceholder}>GRAET</Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.gameFooterText}>{footerTitle}</Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) =>
              `PAGE ${pageNumber} OF ${totalPages}`
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
}: {
  title: string;
  html: string | null;
  rating: number;
  footerLogoBuffer2: Buffer | null;
}) => {
  if (!html) return null;

  const { subSections } = parseTraitHtml(html);

  return (
    <Page size="A4" style={styles.traitPageLayout} wrap>
      <Svg style={styles.traitPageBackground}>
        <Defs>
          <LinearGradient
            id={`pageGradient-${title.replace(/\s/g, "")}`}
            x1="1" y1="0" x2="0" y2="1"
            gradientUnits="objectBoundingBox"
          >
            <Stop offset="0%" stopColor="#D0CEF2" />
            <Stop offset="40%" stopColor="#E8E6F9" />
            <Stop offset="90%" stopColor="#FFFFFF" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="595.28" height="160" fill={`url(#pageGradient-${title.replace(/\s/g, "")})`} />
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
            <HtmlRenderer html={section.content} />
          </View>
        ))}
      </View>
      
      <View style={styles.footer} fixed>
        {footerLogoBuffer2 ? (
          <Image style={styles.footerLogo} src={{ data: footerLogoBuffer2, format: 'png' }} />
        ) : (
          <Text style={styles.logoPlaceholder}>GRAET</Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.gameFooterText}>{title}</Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) =>
              `PAGE ${pageNumber} OF ${totalPages}`
            }
            fixed
          />
        </View>
      </View>
    </Page>
  );
};

const StatsPage = ({ html, footerLogoBuffer2 }: { html: string | null, footerLogoBuffer2: Buffer | null }) => {
  if (!html) return null;
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.statsPageContainer}>
        <View style={styles.statsTitleHeader}>
          <BackgroundGradient />
          <Text style={styles.statsTitleText}>STATS</Text>
        </View>
        <View style={styles.statsMainContent}>
          <View style={styles.statsTableWrapper}>
            <HtmlRenderer html={html} isStatsTable={true} />
          </View>
        </View>
      </View>
      <View style={styles.footer} fixed>
        {footerLogoBuffer2 ? (
          <Image style={styles.footerLogo} src={{ data: footerLogoBuffer2, format: 'png' }} />
        ) : (
          <Text style={styles.logoPlaceholder}>GRAET</Text>
        )}
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `PAGE ${pageNumber} OF ${totalPages}`
          }
          fixed
        />
      </View>
    </Page>
  );
};

const ScoutedGamePage = ({ gameDetails, footerLogoBuffer2, gameQrCodeDataUrl }: { gameDetails: GameDetails | null, footerLogoBuffer2: Buffer | null, gameQrCodeDataUrl: string | null }) => {
  if (!gameDetails) return null;

  const { homeTeam, awayTeam, gameDate, league } = gameDetails;
  const homeScore = homeTeam.score ?? '-';
  const awayScore = awayTeam.score ?? '-';

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.scoutedGamePageContainer}>
        <BackgroundGradient />
        <Text style={styles.scoutedGameTitle}>SCOUTED GAME</Text>
        <View style={styles.scoutedGameMainContent}>
          <View style={styles.gameBox}>
            <View style={styles.gameHeader}>
              <Text style={styles.gameHeaderText}>{league || 'N/A'}</Text>
              <View style={styles.gameHeaderIcon} />
              <Text style={styles.gameHeaderText}>{gameDate || 'N/A'}</Text>
            </View>
            <View style={styles.gameBody}>
              <View style={styles.teamBlock}>
                <View style={styles.teamLogo} />
                <Text style={styles.teamNameText}>{homeTeam.name || 'Home Team'}</Text>
              </View>
              <View style={styles.scoreBlock}>
                <Text style={styles.scoreText}>{`${homeScore} : ${awayScore}`}</Text>
              </View>
              <View style={styles.teamBlock}>
                <View style={styles.teamLogo} />
                <Text style={styles.teamNameText}>{awayTeam.name || 'Away Team'}</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.qrCodeSection}>
            <View style={styles.qrCodeTextBlock}>
              <Text style={styles.qrCodeText}>
                CHECK THE GAME DETAIL & STATS ON GRAET
              </Text>
              <View style={styles.qrCodeButton}>
                <Text style={styles.qrCodeButtonText}>SHOW GAME</Text>
              </View>
            </View>
            {gameQrCodeDataUrl ? (
              <Image style={styles.qrCodePlaceholder} src={gameQrCodeDataUrl} />
            ) : (
              <View style={styles.qrCodePlaceholder} />
            )}
          </View>
        </View>
      </View>
      <View style={styles.footer} fixed>
        {footerLogoBuffer2 ? (
          <Image style={styles.footerLogo} src={{ data: footerLogoBuffer2, format: 'png' }} />
        ) : (
          <Text style={styles.logoPlaceholder}>GRAET</Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.gameFooterText}>GAME</Text>
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (`PAGE ${pageNumber} OF ${totalPages}`)} fixed />
        </View>
      </View>
    </Page>
  );
};

const ScalingSystemPage = ({ footerLogoBuffer2 }: { footerLogoBuffer2: Buffer | null }) => (
  <Page size="A4" style={styles.page}>
    <BackgroundGradient />
    <View style={styles.infoPageContainer}>
      <Text style={styles.infoPageTitle}>Scaling System</Text>
      <Text style={styles.infoPageIntroText}>
        Ratings are contextualized by age group, position, and competitive level.
      </Text>
      
      <View style={styles.scalingGrid}>
        <View style={styles.scalingColumn}>
          <View style={styles.ratingBlock}>
            <StarRating rating={5} />
            <Text style={styles.ratingTitle}>Elite:</Text>
            <Text style={styles.ratingDescription}>
              Exceptional at this skill, comparable to top-tier players in their age group or level.
            </Text>
          </View>
          <View style={styles.ratingBlock}>
            <StarRating rating={3} />
            <Text style={styles.ratingTitle}>Solid:</Text>
            <Text style={styles.ratingDescription}>
              Adequate for current level; can still be developed further.
            </Text>
          </View>
          <View style={styles.ratingBlock}>
            <StarRating rating={1} />
            <Text style={styles.ratingTitle}>Needs Improvement:</Text>
            <Text style={styles.ratingDescription}>
              Below standard; requires focused development or training.
            </Text>
          </View>
        </View>

        <View style={styles.scalingColumn}>
          <View style={styles.ratingBlock}>
            <StarRating rating={4} />
            <Text style={styles.ratingTitle}>Strong:</Text>
            <Text style={styles.ratingDescription}>
              Above average; consistently effective in high-level play.
            </Text>
          </View>
          <View style={styles.ratingBlock}>
            <StarRating rating={2} />
            <Text style={styles.ratingTitle}>Developing:</Text>
            <Text style={styles.ratingDescription}>
              Some signs of potential, but inconsistency or technical flaws are present.
            </Text>
          </View>
        </View>
      </View>
    </View>

    <View style={styles.footer} fixed>
      {footerLogoBuffer2 ? (
        <Image style={styles.footerLogo} src={{ data: footerLogoBuffer2, format: 'png' }} />
      ) : (
        <Text style={styles.logoPlaceholder}>GRAET</Text>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={styles.gameFooterText}>SCALING SYSTEM</Text>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `PAGE ${pageNumber} OF ${totalPages}`}
          fixed
        />
      </View>
    </View>
  </Page>
);

const ScoutingTeamPage = ({ footerLogoBuffer2 }: { footerLogoBuffer2: Buffer | null }) => (
  <Page size="A4" style={styles.page}>
    <BackgroundGradient />
    <View style={styles.infoPageContainer}>
      <Text style={styles.infoPageTitle}>Our Scouting Team</Text>
      <Text style={styles.infoPageIntroText}>
        Our scouting team combines years of experience from top leagues in Europe and North America. Each report is created or reviewed by professionals who've evaluated hundreds of players at the junior, collegiate, and pro levels.
      </Text>

      <View>
        <View style={styles.scoutProfile}>
          <Text style={styles.scoutName}>John Doe</Text>
          <Text style={styles.scoutDescription}>
            A seasoned scout with over 7 years of experience. He spent 5 years scouting in Sweden's SHL with Rögle BK and worked for 2 years with the NCAA's Boston University program. John specializes in identifying high-IQ forwards and defensive-zone play.
          </Text>
        </View>
        <View style={styles.scoutProfile}>
          <Text style={styles.scoutName}>Mark Thompson</Text>
          <Text style={styles.scoutDescription}>
            A former junior coach turned scout from Canada, Mark has a sharp eye for player development and has contributed to WHL draft rankings.
          </Text>
        </View>
      </View>
    </View>

    <View style={styles.footer} fixed>
      {footerLogoBuffer2 ? (
        <Image style={styles.footerLogo} src={{ data: footerLogoBuffer2, format: 'png' }} />
      ) : (
        <Text style={styles.logoPlaceholder}>GRAET</Text>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={styles.gameFooterText}>OUR SCOUTING TEAM</Text>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `PAGE ${pageNumber} OF ${totalPages}`}
          fixed
        />
      </View>
    </View>
  </Page>
);

// --- 4. MAIN DOCUMENT COMPONENT ---
const ReportDocument = ({
  playerContext,
  teamContext,
  reportSections,
  gameDetails,
  backgroundBuffer,
  playerImageBuffer,
  logoOverlayBuffer,
  footerLogoBuffer, 
  footerLogoBuffer2, 
  positionImageBuffer,
  playerQrCodeDataUrl,
  gameQrCodeDataUrl,
  traitRatings,
}: any) => (
  <Document>
    <CoverPage
      playerContext={playerContext}
      backgroundBuffer={backgroundBuffer}
      playerImageBuffer={playerImageBuffer}
      logoOverlayBuffer={logoOverlayBuffer}
      footerLogoBuffer={footerLogoBuffer}
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
                <Text style={styles.infoLabel}>Team</Text>
                <Text style={styles.infoValue}>
                  {teamContext?.name || "N/A"}
                </Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Date of Birth</Text>
                <Text style={styles.infoValue}>
                  {formatDate(playerContext?.dateOfBirth)}
                </Text>
              </View>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Nationality</Text>
                <Text style={styles.infoValue}>
                  {playerContext?.country || "N/A"}
                </Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Height</Text>
                <Text style={styles.infoValue}>
                  {formatHeight(playerContext?.bio?.height)}
                </Text>
              </View>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Weight</Text>
                <Text style={styles.infoValue}>
                  {formatWeight(playerContext?.bio?.weight)}
                </Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Shoots</Text>
                <Text style={styles.infoValue}>
                  {playerContext?.bio?.handedness || "N/A"}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.qrCodeSection}>
            <View style={styles.qrCodeTextBlock}>
              <Text style={styles.qrCodeText}>
                Check {playerContext?.firstname || "Player"}'s Profile on Graet
              </Text>
              <View style={styles.qrCodeButton}>
                <Text style={styles.qrCodeButtonText}>View Profile</Text>
              </View>
            </View>
            {playerQrCodeDataUrl ? (
              <Image style={styles.qrCodePlaceholder} src={playerQrCodeDataUrl} />
            ) : (
              <View style={styles.qrCodePlaceholder} />
            )}
          </View>
        </View>
      </View>
      <View style={styles.footer} fixed>
        {footerLogoBuffer2 ? (
          <Image style={styles.footerLogo} src={{ data: footerLogoBuffer2, format: 'png' }} />
        ) : (
          <Text style={styles.logoPlaceholder}>GRAET</Text>
        )}
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `PAGE ${pageNumber} OF ${totalPages}`
          }
          fixed
        />
      </View>
    </Page>

    <PlaystylePage
      playerContext={playerContext}
      positionImageBuffer={positionImageBuffer}
      footerLogoBuffer2={footerLogoBuffer2}
    />

    <StatsPage html={reportSections.seasonalStats} footerLogoBuffer2={footerLogoBuffer2} />

    <ScoutedGamePage gameDetails={gameDetails} footerLogoBuffer2={footerLogoBuffer2} gameQrCodeDataUrl={gameQrCodeDataUrl}  />

    <TraitPage title="Skating" html={reportSections.skating} rating={traitRatings.skating} footerLogoBuffer2={footerLogoBuffer2} />
    <TraitPage title="Puck Skills" html={reportSections.puckSkills} rating={traitRatings.puckSkills} footerLogoBuffer2={footerLogoBuffer2} />
    <TraitPage title="Hockey IQ" html={reportSections.hockeyIq} rating={traitRatings.hockeyIq} footerLogoBuffer2={footerLogoBuffer2} />
    <TraitPage title="Shot" html={reportSections.shot} rating={traitRatings.shot} footerLogoBuffer2={footerLogoBuffer2} />
    <TraitPage title="Compete Level" html={reportSections.competeLevel} rating={traitRatings.competeLevel} footerLogoBuffer2={footerLogoBuffer2} />
    <TraitPage title="Defensive Game" html={reportSections.defensiveGame} rating={traitRatings.defensiveGame} footerLogoBuffer2={footerLogoBuffer2} />

    <SummaryPage
      title="Overall Summary"
      footerTitle="SUMMARY"
      html={reportSections.overallSummary}
      footerLogoBuffer2={footerLogoBuffer2}
    />
    <SummaryPage
      title="Projection"
      footerTitle="PROJECTION"
      html={reportSections.projection}
      footerLogoBuffer2={footerLogoBuffer2}
    />
    <SummaryPage
      title="Recommendation"
      footerTitle="RECOMMENDATION"
      html={reportSections.recommendation}
      footerLogoBuffer2={footerLogoBuffer2}
    />

    <ScalingSystemPage footerLogoBuffer2={footerLogoBuffer2} />
    {/* <ScoutingTeamPage footerLogoBuffer2={footerLogoBuffer2} /> */}
  </Document>
);

const playstyleDescriptions: { [key: string]: string } = {
  BUTTERFLY: 'Drops to butterfly and covers upper net with glove and blocker.',
  STANDUP: 'Stays on their feet, relying on good positioning.',
  HYBRID: 'Combines elements of both butterfly and stand-up styles.',
  DEFENSIVE: 'Main strength is stopping opponents and preventing goals.',
  TWO_WAY: 'Combines defensive and offensive skills. Contributes both offensively and defensively, a well-rounded player.',
  OFFENSIVE: 'Excels in initiating attacks and high activity in offensive plays.',
  PLAYMAKER: 'Exceptional passer, sets up scoring chances for teammates.',
  POWER_FORWARD: 'Strong, aggressive player who creates space and excels near the net.',
  SNIPER: 'Main strength in finding open spaces and making precise shots.',
  GRINDER: 'Known for a high work rate, forechecking, and physical play.',
  ENFORCER: 'Primarily focuses on physical intimidation and protecting teammates.',
};

const formatPlaystyle = (playstyle: string | null | undefined): string => {
  if (!playstyle) return 'N/A';
  return playstyle.replace(/_/g, ' ');
};

const getPositionImageFilename = (position: string | null | undefined): string | null => {
  if (!position) return null;
  switch (position) {
    case 'GOALTENDER': return 'goalie.png';
    case 'LEFT_DEFENSIVE': return 'left-defend.png';
    case 'RIGHT_DEFENSIVE': return 'right-defend.png';
    case 'CENTER': return 'center.png';
    case 'LEFT_WING': return 'left-wing.png';
    case 'RIGHT_WING': return 'right-wing.png';
    default: return null;
  }
};

// --- 5. API ENDPOINT ---
export async function POST(request: Request) {
  try {
    let backgroundBuffer: Buffer | null = null;
    let playerImageBuffer: Buffer | null = null;
    let logoOverlayBuffer: Buffer | null = null;
    let footerLogoBuffer: Buffer | null = null;
    let footerLogoBuffer2: Buffer | null = null;

    try {
      const backgroundPath = path.join(process.cwd(), 'public', 'reportBackground.png');
      backgroundBuffer = await fs.readFile(backgroundPath);

      const playerImagePath = path.join(process.cwd(), 'public', 'player.png');
      playerImageBuffer = await fs.readFile(playerImagePath);
      
      const logoOverlayPath = path.join(process.cwd(), 'public', 'premium.png');
      logoOverlayBuffer = await fs.readFile(logoOverlayPath);

      const footerLogoPath = path.join(process.cwd(), 'public', 'graet.png');
      footerLogoBuffer = await fs.readFile(footerLogoPath);

      const footerLogoPath2 = path.join(process.cwd(), 'public', 'graet2.png');
      footerLogoBuffer2 = await fs.readFile(footerLogoPath2);

    } catch (error) {
      console.error("Could not read one or more cover page image files:", error);
    }
    
    const { reportHtml, playerContext, teamContext, traitRatings } = await request.json();
    if (!reportHtml || !traitRatings) {
      return new NextResponse("Missing reportHtml or traitRatings for PDF generation", {
        status: 400,
      });
    }

    let positionImageBuffer: Buffer | null = null;
    const positionImageFile = getPositionImageFilename(playerContext?.bio?.position);

    if (positionImageFile) {
      try {
        const imagePath = path.join(process.cwd(), 'public', positionImageFile);
        positionImageBuffer = await fs.readFile(imagePath);
      } catch (error) {
        console.error(`Could not read position image file: ${positionImageFile}`, error);
      }
    }

    const reportSections = splitReportByHeadings(reportHtml);

    let gameDetails: GameDetails | null = null;
    if (reportSections.gameInfo) {
      try {
        const parseApiUrl = new URL('/api/parse-game-info', request.url);
        
        const parseResponse = await fetch(parseApiUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
    
    const formattedPlayerName = (playerContext?.name || '')
      .toLowerCase()
      .replace(/\s+/g, '-');
    const playerProfileUrl = `https://www.graet.com/${formattedPlayerName}`;
    const playerQrCodeDataUrl = await generateQrCodeDataUrl(playerProfileUrl);

    const gameDummyUrl = 'https://www.graet.com';
    const gameQrCodeDataUrl = await generateQrCodeDataUrl(gameDummyUrl);

    const doc = (
      <ReportDocument
        reportSections={reportSections}
        playerContext={playerContext}
        teamContext={teamContext}
        gameDetails={gameDetails}
        backgroundBuffer={backgroundBuffer}
        playerImageBuffer={playerImageBuffer}
        logoOverlayBuffer={logoOverlayBuffer}
        footerLogoBuffer={footerLogoBuffer}
        footerLogoBuffer2={footerLogoBuffer2}
        positionImageBuffer={positionImageBuffer}
        playerQrCodeDataUrl={playerQrCodeDataUrl}
        gameQrCodeDataUrl={gameQrCodeDataUrl}
        traitRatings={traitRatings}
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
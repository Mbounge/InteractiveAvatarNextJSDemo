import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';
import { parse, HTMLElement } from 'node-html-parser';

// --- Font Registration ---
// This is crucial for using bold/italic styles in the PDF.
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/npm/helveticaneue@2.0.0/dist/Helvetica.ttf' },
    { src: 'https://cdn.jsdelivr.net/npm/helveticaneue@2.0.0/dist/Helvetica-Bold.ttf', fontWeight: 'bold' },
    { src: 'https://cdn.jsdelivr.net/npm/helveticaneue@2.0.0/dist/Helvetica-Oblique.ttf', fontStyle: 'italic' },
    { src: 'https://cdn.jsdelivr.net/npm/helveticaneue@2.0.0/dist/Helvetica-BoldOblique.ttf', fontWeight: 'bold', fontStyle: 'italic' },
  ],
});

// --- Styling ---
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.5,
    color: '#333',
  },
  header: {
    fontSize: 22,
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
    color: '#0e0c66',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 3,
    color: '#111827',
  },
  playerInfoContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoItem: {
    flexDirection: 'row',
    width: '50%',
    marginBottom: 4,
  },
  infoLabel: {
    fontFamily: 'Helvetica-Bold',
  },
  infoValue: {
    marginLeft: 4,
  },
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginVertical: 10,
  },
  // Table Styles
  table: {
    width: '100%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomStyle: 'solid',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableHeader: {
    backgroundColor: '#f9fafb',
  },
  tableCol: {
    padding: 5,
    borderStyle: 'solid',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  tableCell: {
    flex: 1,
  },
  tableHeaderCell: {
    fontFamily: 'Helvetica-Bold',
  },
  // HTML Renderer Styles
  p: { marginBottom: 6 },
  h1: { fontSize: 24, fontFamily: 'Helvetica-Bold', marginBottom: 10 },
  h2: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 8 },
  h3: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  strong: { fontFamily: 'Helvetica-Bold' },
  em: { fontStyle: 'italic' },
  ul: { marginLeft: 10 },
  li: { flexDirection: 'row', marginBottom: 2 },
  liBullet: { marginRight: 5 },
});

// --- Type Definitions ---
export type ReportDocumentProps = {
  playerContext: any;
  teamContext: any;
  seasonalStatsContext: any;
  reportHtml: string;
};

// --- Helper Functions (moved from backend for component self-sufficiency) ---
const formatPosition = (p: string) => p ? p.replace(/_/g, ' ').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()) : 'N/A';
const formatHandedness = (h: string) => h ? h.charAt(0).toUpperCase() + h.slice(1).toLowerCase() : 'N/A';
const formatHeight = (h: any) => h?.centimeters ? `${Math.floor(h.inches / 12)}' ${h.inches % 12}" (${h.centimeters} cm)` : 'N/A';
const formatWeight = (w: any) => w?.pounds ? `${w.pounds} lbs (${w.kilograms} kg)` : 'N/A';
const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : 'Unknown';

// --- Sub-Components for PDF ---

// Component to render the stats table
const StatsTable = ({ stats, position }: { stats: any[], position: string }) => {
  if (!stats || stats.length === 0) {
    return <Text>No seasonal stats available.</Text>;
  }

  const isGoalie = position === 'GOALTENDER';
  const headers = isGoalie 
    ? ['Season', 'Team', 'GP', 'W', 'L', 'GAA', 'SV%'] 
    : ['Season', 'Team', 'GP', 'G', 'A', 'P'];

  return (
    <View style={styles.table}>
      <View style={[styles.tableRow, styles.tableHeader]}>
        {headers.map(header => (
          <View key={header} style={[styles.tableCol, styles.tableCell]}>
            <Text style={styles.tableHeaderCell}>{header}</Text>
          </View>
        ))}
      </View>
      {stats.map(({ node: s }) => (
        <View key={s.season + s.team.name} style={styles.tableRow}>
          <View style={[styles.tableCol, styles.tableCell]}><Text>{s.season}</Text></View>
          <View style={[styles.tableCol, styles.tableCell]}><Text>{s.team.name}</Text></View>
          <View style={[styles.tableCol, styles.tableCell]}><Text>{s.gamesPlayed}</Text></View>
          {isGoalie ? (
            <>
              <View style={[styles.tableCol, styles.tableCell]}><Text>{s.wins}</Text></View>
              <View style={[styles.tableCol, styles.tableCell]}><Text>{s.losses}</Text></View>
              <View style={[styles.tableCol, styles.tableCell]}><Text>{s.gaa?.toFixed(2)}</Text></View>
              <View style={[styles.tableCol, styles.tableCell]}><Text>{s.svp?.toFixed(3)}</Text></View>
            </>
          ) : (
            <>
              <View style={[styles.tableCol, styles.tableCell]}><Text>{s.goals}</Text></View>
              <View style={[styles.tableCol, styles.tableCell]}><Text>{s.assists}</Text></View>
              <View style={[styles.tableCol, styles.tableCell]}><Text>{s.points}</Text></View>
            </>
          )}
        </View>
      ))}
    </View>
  );
};

// Component to parse and render Tiptap HTML
const HtmlRenderer = ({ html }: { html: string }) => {
  const root = parse(html);

  const renderNode = (node: any, index: number): JSX.Element | null => {
    if (node.nodeType === 3) { // Text node
      return <Text key={index}>{node.text}</Text>;
    }

    if (node.nodeType === 1) { // Element node
      const element = node as HTMLElement;
      const children = element.childNodes.map(renderNode);
      
      switch (element.tagName.toLowerCase()) {
        case 'h1': return <Text key={index} style={styles.h1}>{children}</Text>;
        case 'h2': return <Text key={index} style={styles.h2}>{children}</Text>;
        case 'h3': return <Text key={index} style={styles.h3}>{children}</Text>;
        case 'p': return <Text key={index} style={styles.p}>{children}</Text>;
        case 'strong': return <Text key={index} style={styles.strong}>{children}</Text>;
        case 'em': return <Text key={index} style={styles.em}>{children}</Text>;
        case 'ul': return <View key={index} style={styles.ul}>{children}</View>;
        case 'li': return <View key={index} style={styles.li}><Text style={styles.liBullet}>• </Text><Text>{children}</Text></View>;
        case 'hr': return <View key={index} style={styles.hr} />;
        // Add more tag handlers as needed (e.g., tables, blockquotes)
        default: return <View key={index}>{children}</View>;
      }
    }
    return null;
  };

  return <>{root.childNodes.map(renderNode)}</>;
};

// --- Main Document Component ---
const ReportDocument: React.FC<ReportDocumentProps> = ({ 
  playerContext, 
  teamContext, 
  seasonalStatsContext, 
  reportHtml 
}) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.header}>GRAET SCOUTING REPORT</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Player Information</Text>
        <View style={styles.playerInfoContainer}>
          <View style={styles.infoItem}><Text style={styles.infoLabel}>Player: </Text><Text style={styles.infoValue}>{playerContext?.name || 'N/A'}</Text></View>
          <View style={styles.infoItem}><Text style={styles.infoLabel}>Position: </Text><Text style={styles.infoValue}>{formatPosition(playerContext?.bio?.position)}</Text></View>
          <View style={styles.infoItem}><Text style={styles.infoLabel}>Date of Birth: </Text><Text style={styles.infoValue}>{formatDate(playerContext?.dateOfBirth)}</Text></View>
          <View style={styles.infoItem}><Text style={styles.infoLabel}>Shoots: </Text><Text style={styles.infoValue}>{formatHandedness(playerContext?.bio?.handedness)}</Text></View>
          <View style={styles.infoItem}><Text style={styles.infoLabel}>Height: </Text><Text style={styles.infoValue}>{formatHeight(playerContext?.bio?.height)}</Text></View>
          <View style={styles.infoItem}><Text style={styles.infoLabel}>Weight: </Text><Text style={styles.infoValue}>{formatWeight(playerContext?.bio?.weight)}</Text></View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Game Information</Text>
        <View style={styles.playerInfoContainer}>
          <View style={styles.infoItem}><Text style={styles.infoLabel}>Team: </Text><Text style={styles.infoValue}>{teamContext?.name || 'N/A'}</Text></View>
          <View style={styles.infoItem}><Text style={styles.infoLabel}>League: </Text><Text style={styles.infoValue}>{teamContext?.leagues?.[0]?.name || 'N/A'}</Text></View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Seasonal Statistics</Text>
        <StatsTable stats={seasonalStatsContext} position={playerContext?.bio?.position} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Scout's Analysis</Text>
        <HtmlRenderer html={reportHtml} />
      </View>
    </Page>
  </Document>
);

export default ReportDocument;
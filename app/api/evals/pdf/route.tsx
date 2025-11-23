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
  Stop,
  Rect,
  Image,
} from "@react-pdf/renderer";
import { parse, HTMLElement } from "node-html-parser";

// --- 1. TYPES ---
export interface EvaluationReportData {
  dateRange: string;
  kpis: {
    totalConversations: number;
    avgDuration: string;
    meaningfulEngagement: string;
    techFailureRate: string;
  };
  agentStats: Array<{
    name: string;
    total: number;
    abandonRate: string;
    deepRate: string;
    toolUse: string;
    funcSuccess: string;
    duration: string;
    turns: string;
  }>;
  strategyStats: Array<{
    type: string;
    count: number;
    avgDuration: string;
    abandonRate: string;
    deepRate: string;
  }>;
  analysisHtml: string;
}

// --- 2. FONT REGISTRATION ---
Font.register({
  family: "DejaVu",
  fonts: [
    { src: "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf" },
    { src: "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf", fontWeight: "bold" },
    { src: "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Oblique.ttf", fontStyle: "italic" },
    { src: "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-BoldOblique.ttf", fontWeight: "bold", fontStyle: "italic" },
  ],
});

// --- 3. STYLES ---
const styles = StyleSheet.create({
  page: { 
    fontFamily: "DejaVu", 
    backgroundColor: "#FFFFFF", 
    paddingBottom: 40, 
    paddingTop: 20 
  },
  
  backgroundSvg: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: 120, 
    zIndex: -1,
  },

  // Header
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 40,
    marginBottom: 20, 
    marginTop: 10,
  },
  headerTitle: {
    fontSize: 20, 
    fontWeight: "bold",
    fontStyle: "italic",
    color: "#161160",
    textTransform: "uppercase",
  },
  headerSubTitle: {
    fontSize: 9,
    color: "#525986",
    marginTop: 4,
  },
  logo: {
    width: 70,
    height: "auto",
    objectFit: "contain",
  },

  // KPI Grid
  kpiGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 40,
    marginBottom: 25,
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  kpiLabel: {
    fontSize: 7,
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 4,
    fontWeight: "bold",
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#161160",
  },

  // Tables (Stats)
  tableContainer: {
    paddingHorizontal: 40,
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#161160",
    textTransform: "uppercase",
    marginBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: "#2B21C1",
    paddingBottom: 4,
    width: "100%",
  },
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingVertical: 6, 
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingVertical: 6, 
  },
  
  colName: { width: "22%", paddingLeft: 6 },
  colMetric: { width: "10%", textAlign: "right", paddingRight: 6 }, 
  colWide: { width: "19%", textAlign: "right", paddingRight: 6 },   
  
  cellHeader: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#4B5563",
    textTransform: "uppercase",
  },
  cellText: {
    fontSize: 7,
    color: "#1F2937",
  },
  cellTextBold: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#161160",
  },

  // Analysis Text
  analysisContainer: {
    paddingHorizontal: 40,
    marginTop: 10,
  },
  h1: { fontSize: 14, fontWeight: "bold", color: "#161160", marginBottom: 8, marginTop: 15, textTransform: 'uppercase' },
  h2: { fontSize: 12, fontWeight: "bold", color: "#161160", marginBottom: 6, marginTop: 12 },
  h3: { fontSize: 10, fontWeight: "bold", color: "#2B21C1", marginBottom: 4, marginTop: 12 },
  p: { fontSize: 9, lineHeight: 1.4, color: "#374151", marginBottom: 6, textAlign: "justify" },
  ul: { marginBottom: 6, marginTop: 0, padding: 0 },
  li: { fontSize: 9, lineHeight: 1.4, color: "#374151", marginBottom: 4, marginLeft: 8 },
  
  // --- UPDATED: Analysis Table Styles (The KPI Table) ---
  analysisTable: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 4,
    marginTop: 8,
    marginBottom: 12,
  },
  analysisTableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    minHeight: 24, // Ensure rows have some height
    alignItems: 'stretch', // Make vertical lines stretch full height
  },
  analysisTableHeadCell: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#4B5563",
    textTransform: "uppercase",
    flex: 1,
    padding: 6, // Added padding
    borderRightWidth: 1, // Vertical line
    borderRightColor: "#E5E7EB",
    backgroundColor: "#F9FAFB", // Distinct header background
  },
  analysisTableCell: {
    fontSize: 8,
    color: "#374151",
    flex: 1,
    padding: 6, // Added padding
    borderRightWidth: 1, // Vertical line
    borderRightColor: "#E5E7EB",
    textAlign: 'left',
  },

  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 8,
  },
  footerText: { fontSize: 7, color: "#9CA3AF" },
  pageNumber: { fontSize: 7, color: "#9CA3AF" },
});

// --- 4. COMPONENTS ---

const BackgroundGradient = () => (
  <Svg style={styles.backgroundSvg} fixed>
    <Defs>
      <LinearGradient id="pageGradient" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#D0CEF2" stopOpacity={0.3} />
        <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
      </LinearGradient>
    </Defs>
    <Rect x="0" y="0" width="100%" height="100%" fill="url(#pageGradient)" />
  </Svg>
);

const HtmlRenderer = ({ html }: { html: string }) => {
  if (!html) return null;
  const root = parse(html);

  const renderNode = (node: any, index: number): React.ReactNode => {
    if (node.nodeType === 3) {
      const text = node.text;
      if (!text.trim()) return null; 
      return <Text key={index}>{text}</Text>;
    }
    
    if (node.nodeType === 1) {
      const element = node as HTMLElement;
      const children = element.childNodes.map((child, i) => renderNode(child, i));

      switch (element.tagName.toLowerCase()) {
        case "h1": return <Text key={index} style={styles.h1}>{children}</Text>;
        case "h2": return <Text key={index} style={styles.h2}>{children}</Text>;
        case "h3": return <Text key={index} style={styles.h3}>{children}</Text>;
        case "h4": return <Text key={index} style={styles.h3}>{children}</Text>;
        case "p": return <Text key={index} style={styles.p}>{children}</Text>;
        case "ul": return <View key={index} style={styles.ul}>{children}</View>;
        case "li": 
          return (
            <View key={index} style={{ flexDirection: "row", marginBottom: 4 }}>
              <Text style={{ width: 8, fontSize: 9, color: "#2B21C1", marginTop: 1 }}>•</Text>
              <View style={{ flex: 1 }}><Text style={styles.li}>{children}</Text></View>
            </View>
          );
        case "strong": return <Text key={index} style={{ fontWeight: "bold", color: "#161160" }}>{children}</Text>;
        
        // --- TABLE RENDERING ---
        case "table": return <View key={index} style={styles.analysisTable}>{children}</View>;
        case "thead": return <View key={index}>{children}</View>; // Header styling handled in th
        case "tbody": return <View key={index}>{children}</View>;
        case "tr": return <View key={index} style={styles.analysisTableRow}>{children}</View>;
        case "th": return <View key={index} style={styles.analysisTableHeadCell}>{children}</View>;
        case "td": return <View key={index} style={styles.analysisTableCell}>{children}</View>;

        default: return <Text key={index}>{children}</Text>;
      }
    }
    return null;
  };

  return <View>{root.childNodes.map((node, i) => renderNode(node, i))}</View>;
};

const EvaluationDocument = ({ data, logoBuffer }: { data: EvaluationReportData; logoBuffer: Buffer | null }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <BackgroundGradient />
      
      {/* Header */}
      <View style={styles.headerContainer}>
        <View>
          <Text style={styles.headerTitle}>AI Agent Evaluation</Text>
          <Text style={styles.headerSubTitle}>{data.dateRange}</Text>
        </View>
        {logoBuffer && <Image style={styles.logo} src={logoBuffer} />}
      </View>

      {/* KPI Dashboard */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Total Conversations</Text>
          <Text style={styles.kpiValue}>{data.kpis.totalConversations}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Meaningful Engagement</Text>
          <Text style={[styles.kpiValue, { color: "#059669" }]}>{data.kpis.meaningfulEngagement}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Tech Failure Rate</Text>
          <Text style={[styles.kpiValue, { color: "#DC2626" }]}>{data.kpis.techFailureRate}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Avg Duration</Text>
          <Text style={styles.kpiValue}>{data.kpis.avgDuration}</Text>
        </View>
      </View>

      {/* Agent Stats Table */}
      <View style={styles.tableContainer}>
        <Text style={styles.sectionTitle}>Agent Performance Breakdown</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.colName}><Text style={styles.cellHeader}>Agent Name</Text></View>
            <View style={styles.colMetric}><Text style={styles.cellHeader}>Total</Text></View>
            <View style={styles.colMetric}><Text style={[styles.cellHeader, { color: "#DC2626" }]}>Aband %</Text></View>
            <View style={styles.colMetric}><Text style={[styles.cellHeader, { color: "#059669" }]}>Deep %</Text></View>
            <View style={styles.colMetric}><Text style={styles.cellHeader}>Tool %</Text></View>
            <View style={styles.colMetric}><Text style={styles.cellHeader}>Func %</Text></View>
            <View style={styles.colWide}><Text style={styles.cellHeader}>Dur (Min/Avg/Max)</Text></View>
            <View style={styles.colWide}><Text style={styles.cellHeader}>Turns (Min/Avg/Max)</Text></View>
          </View>
          {data.agentStats.map((agent, i) => (
            <View key={i} style={[styles.tableRow, { backgroundColor: i % 2 === 0 ? "#FFFFFF" : "#F9FAFB" }]}>
              <View style={styles.colName}><Text style={styles.cellTextBold}>{agent.name}</Text></View>
              <View style={styles.colMetric}><Text style={styles.cellText}>{agent.total}</Text></View>
              <View style={styles.colMetric}><Text style={[styles.cellText, { color: "#DC2626" }]}>{agent.abandonRate}</Text></View>
              <View style={styles.colMetric}><Text style={[styles.cellText, { color: "#059669" }]}>{agent.deepRate}</Text></View>
              <View style={styles.colMetric}><Text style={styles.cellText}>{agent.toolUse}</Text></View>
              <View style={styles.colMetric}><Text style={styles.cellText}>{agent.funcSuccess}</Text></View>
              <View style={styles.colWide}><Text style={styles.cellText}>{agent.duration}</Text></View>
              <View style={styles.colWide}><Text style={styles.cellText}>{agent.turns}</Text></View>
            </View>
          ))}
        </View>
      </View>

      {/* Strategy Stats Table */}
      <View style={styles.tableContainer}>
        <Text style={styles.sectionTitle}>Strategy Performance (Context Types)</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={[styles.colName, { width: "30%" }]}><Text style={styles.cellHeader}>Context Type</Text></View>
            <View style={styles.colMetric}><Text style={styles.cellHeader}>Count</Text></View>
            <View style={styles.colMetric}><Text style={styles.cellHeader}>Avg Dur</Text></View>
            <View style={[styles.colWide, { width: "20%" }]}><Text style={[styles.cellHeader, { color: "#DC2626" }]}>Abandon %</Text></View>
            <View style={[styles.colWide, { width: "20%" }]}><Text style={[styles.cellHeader, { color: "#059669" }]}>Deep Engage %</Text></View>
          </View>
          {data.strategyStats.map((strat, i) => (
            <View key={i} style={[styles.tableRow, { backgroundColor: i % 2 === 0 ? "#FFFFFF" : "#F9FAFB" }]}>
              <View style={[styles.colName, { width: "30%" }]}><Text style={styles.cellTextBold}>{strat.type}</Text></View>
              <View style={styles.colMetric}><Text style={styles.cellText}>{strat.count}</Text></View>
              <View style={styles.colMetric}><Text style={styles.cellText}>{strat.avgDuration}</Text></View>
              <View style={[styles.colWide, { width: "20%" }]}><Text style={[styles.cellText, { color: "#DC2626" }]}>{strat.abandonRate}</Text></View>
              <View style={[styles.colWide, { width: "20%" }]}><Text style={[styles.cellText, { color: "#059669" }]}>{strat.deepRate}</Text></View>
            </View>
          ))}
        </View>
      </View>

      {/* Analysis Section - Continuous Flow */}
      <View style={styles.analysisContainer}>
        <Text style={styles.sectionTitle}>Strategic Analysis & Insights</Text>
        <HtmlRenderer html={data.analysisHtml} />
      </View>

      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>GRAET Analytics</Text>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  </Document>
);

export async function POST(request: Request) {
  try {
    const data: EvaluationReportData = await request.json();

    let logoBuffer: Buffer | null = null;
    try {
      const logoPath = path.join(process.cwd(), "public", "graet2.png");
      logoBuffer = await fs.readFile(logoPath);
    } catch (error) {
      console.warn("Logo not found in public/graet2.png");
    }

    const pdfStream = await pdf(<EvaluationDocument data={data} logoBuffer={logoBuffer} />).toBlob();

    return new NextResponse(pdfStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="GRAET_AI_Eval_${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });

  } catch (error) {
    console.error("PDF Generation Error:", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
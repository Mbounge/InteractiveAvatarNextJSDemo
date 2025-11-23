// app/api/evals/analyze/route.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Helper to format a single conversation transcript
const formatTranscript = (c: any) => {
  const vars = c.conversation_initiation_client_data?.dynamic_variables || {};
  const strategy = `${vars.context_type || 'General'} - ${vars.context_title || 'Standard'}`;
  
  let transcriptText = "";
  if (c.transcript && c.transcript.length > 0) {
    transcriptText = c.transcript.map((t: any) => {
      const toolInfo = t.tool_calls?.length 
        ? ` [TOOL: ${t.tool_calls.map((tc:any) => tc.tool_name).join(', ')}]` 
        : "";
      return `[${t.time_in_call_secs}s] ${t.role.toUpperCase()}: ${t.message}${toolInfo}`;
    }).join("\n");
  } else {
    transcriptText = "[No transcript - 0 Turns]";
  }

  return `
  ID: ${c.conversation_id}
  Strategy: ${strategy}
  Duration: ${c.metadata.call_duration_secs}s
  TRANSCRIPT:
  ${transcriptText}
  `;
};

const formatContextForLLM = (items: any[]) => {
  if (!items || items.length === 0) return "NO DATA PINNED.";

  return items.map((item, index) => {
    
    // 1. Direct Conversation Pin
    if (item.type === 'conversation') {
      return `=== ITEM ${index + 1} (CONVERSATION) ===\n${formatTranscript(item.data)}`;
    } 
    
    // 2. Statistic Pin (Now with Samples!)
    if (item.type === 'stat-row' || item.type === 'stat-slice') {
      let samplesText = "(No sample conversations provided)";
      
      // Check if the frontend sent samples
      if (item.data.sampleConversations && item.data.sampleConversations.length > 0) {
        samplesText = item.data.sampleConversations.map((c: any, i: number) => 
          `--- Sample ${i + 1} for this Metric ---\n${formatTranscript(c)}`
        ).join("\n");
      }

      return `
=== ITEM ${index + 1} (STATISTIC) ===
Metric Name: ${item.label}
Value: ${item.data.value}
Filters Applied: ${JSON.stringify(item.data.filter)}

RELEVANT CONVERSATION SAMPLES FOR THIS STAT:
${samplesText}
`;
    }
    
    return `=== ITEM ${index + 1}: UNKNOWN DATA ===\n${JSON.stringify(item)}`;
  }).join("\n\n");
};

export async function POST(req: Request) {
  try {
    const { messages, contextItems } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const formattedContext = formatContextForLLM(contextItems);

    const systemPrompt = `
You are an expert AI Analyst for GRAET.
Be helpful to the user, wait for their instruction on what to do
You have been given data that the user may ask for help with

---
**CURRENT WORKBENCH DATA:**
${formattedContext}
---

`;

    const chatHistory = messages.slice(0, -1).map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: systemPrompt }] },
        ...chatHistory
      ],
    });

    const lastMessage = messages[messages.length - 1].content;
    const result = await chat.sendMessage(lastMessage);
    const response = result.response.text();

    return NextResponse.json({ response });

  } catch (error) {
    console.error("Analysis API Error:", error);
    return NextResponse.json({ error: "Failed to analyze data" }, { status: 500 });
  }
}
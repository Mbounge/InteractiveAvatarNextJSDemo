import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Allow for longer processing times
export const maxDuration = 60; 

export async function POST(req: Request) {
  try {
    const { conversations } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
    }

    // Format transcripts for the LLM
    let formattedData = "";
    conversations.forEach((c: any) => {
      const vars = c.conversation_initiation_client_data?.dynamic_variables || {};
      const context = `${vars.context_type || 'General'} - ${vars.context_title || 'Standard'}`;
      
      formattedData += `--- Conversation: ${c.conversation_id} ---\n`;
      formattedData += `[STRATEGY CONTEXT: ${context}]\n`;
      
      if (!c.transcript || c.transcript.length === 0) {
        formattedData += "[No transcript - 0 Turns]\n";
      } else {
        c.transcript.forEach((msg: any) => {
          formattedData += `${msg.role}: ${msg.message}\n`;
        });
      }
      formattedData += `--- End: ${c.conversation_id} ---\n\n`;
    });

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
You are an AI Analyst performing a deep-dive analysis of a large batch of conversation logs. 
Crucially, each conversation is tagged with a [STRATEGY CONTEXT]. This tells you what the agent was *trying* to achieve.

**Important Note:** If you see "Technical Failure" or "Connection Drop", this means the call connected but no audio was exchanged (0 turns). These are infrastructure issues, not content issues.

Your task is to generate a DETAILED LOG. This log is for a final analysis, so it must be granular, specific, and verbose.

**1. Quantitative Summary:**
Use a bulleted list to provide the exact numbers for this batch:
- Total Conversations: [Count]
- Successful Resolutions: [Count]
- User Abandonments (<15s): [Count]
- Technical Drops (0 Turns): [Count]
- High Latency Events: [Count]
- Function Errors: [Count]
- Agent Confused: [Count]
- Troll Interactions: [Count]

**2. Detailed Qualitative Log:**
Write a detailed paragraph that synthesizes the key patterns, recurring issues, and overall sentiment observed in this batch. Be specific and use examples.
- Did users respond well to specific prompts? 
- Did the agent stick to its "Constitution" (Persona) while executing the "Mission" (Context)?

**3. Notable Conversation Breakdowns:**
From this batch, identify **40-50 of the most significant conversations** (e.g., clear successes, failures, or interesting user interactions). For each one, provide a detailed breakdown:
- **Conversation ID:** [ID]
- **Context:** [The Strategy Context found in the log]
- **Summary:** [A 2-3 sentence summary of what happened]
- **Key Event:** [The turning point]
- **Reasoning:** [Why this matters. Did the specific strategy succeed or fail?]

**Conversation Data:**
${formattedData}
`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    return NextResponse.json({ analysis: response });

  } catch (error) {
    console.error("Batch Analysis Error:", error);
    return NextResponse.json({ error: "Failed to analyze batch" }, { status: 500 });
  }
}
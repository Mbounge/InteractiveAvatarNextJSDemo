import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { batchSummaries, stats } = await req.json();

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
You are an expert AI Performance Analyst for GRAET. You have been provided with:
1. **Objective Stats:** High-level metrics.
2. **Detailed Logs:** Summaries from multiple batches of conversations.

Your task is to synthesize this into a final, formal report.

**Writing Style:** Clear, simple, direct. No jargon. Professional but accessible.

**[OBJECTIVE PERFORMANCE STATISTICS]**
${JSON.stringify(stats, null, 2)}
---

**[DETAILED BATCH LOGS]**
${batchSummaries.join("\n\n---\n\n")}
---

**INSTRUCTIONS:**
Generate an HTML report body (do not include <html> or <body> tags).
Use <h3> for Section Headers, <h4> for Sub-headers, <p> for text, <ul>/<li> for lists, and <table> for the KPI section.

**Structure:**

<h3>1. Executive Summary</h3>
<p>Write a concise paragraph about the overall health of the ecosystem. Explicitly mention the volume of "Technical Failures" (Connection Drops) found in the stats and how they might be affecting the overall numbers.</p>

<h3>2. Main Themes and Actionable Insights</h3>
<p>Identify up to 8 critical themes based on the logs. You MUST analyze the performance of specific strategies/prompts.</p>

<!-- Repeat this structure for each theme -->
<h4>Theme: [Theme Title]</h4>
<ul>
  <li><strong>Observations:</strong> Provide a comprehensive list of observations. Do not limit yourself to just one or two. List as many distinct, specific patterns and examples as you found in the logs to provide maximum insight. Do not mention specific Conversation IDs.</li>
  <li><strong>Root Cause Analysis:</strong> Analyze the specific interaction mechanics, prompt instructions, or user psychology that caused this. <strong>CRITICAL:</strong> Do NOT blame "lack of training data" or "limited examples." You must identify the specific flaw in the agent's logic, the prompt structure, or the user experience design.</li>
  <li><strong>Strategic Recommendation:</strong> [Your specific, actionable recommendation]</li>
</ul>

<h3>3. Key Performance Indicators (KPI) Summary</h3>
<p>Select the 5 most important KPIs. Assign a status (Excellent, Good, Needs Improvement, Poor, Critical).</p>

<!-- Generate this exact HTML Table structure -->
<table style="width: 100%; border-collapse: collapse;">
  <thead>
    <tr>
      <th style="text-align: left;">KPI Name</th>
      <th style="text-align: left;">Status</th>
      <th style="text-align: left;">Analyst's Note</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>[KPI 1]</td>
      <td>[Status]</td>
      <td>[Concise Note]</td>
    </tr>
    <tr>
      <td>[KPI 2]</td>
      <td>[Status]</td>
      <td>[Concise Note]</td>
    </tr>
    <tr>
      <td>[KPI 3]</td>
      <td>[Status]</td>
      <td>[Concise Note]</td>
    </tr>
    <tr>
      <td>[KPI 4]</td>
      <td>[Status]</td>
      <td>[Concise Note]</td>
    </tr>
    <tr>
      <td>[KPI 5]</td>
      <td>[Status]</td>
      <td>[Concise Note]</td>
    </tr>
  </tbody>
</table>
`;

    const result = await model.generateContent(prompt);
    const htmlContent = result.response.text();

    // Cleanup markdown code blocks if Gemini adds them
    const cleanHtml = htmlContent.replace(/```html/g, "").replace(/```/g, "");

    return NextResponse.json({ html: cleanHtml });

  } catch (error) {
    console.error("Final Report Error:", error);
    return NextResponse.json({ error: "Failed to generate final report" }, { status: 500 });
  }
}
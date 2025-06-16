import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const runtime = "edge";

const today = new Date();
const formattedDate = today.toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export async function POST(request: Request) {
  try {
    
    const { transcription, playerContext, teamContext, standingsContext } = await request.json();
   
    // console.log("Received Player Context:", playerContext);
    // console.log("Received Team Context:", teamContext);
    // console.log("Received Standings Context:", standingsContext);

    if (!transcription || !playerContext || !teamContext) {
      return NextResponse.json(
        { error: "Transcription, player context, and team context are required." },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-preview-05-20",
      generationConfig: {
        temperature: 0.1
      }
    });

    const prompt = `
      You are an expert hockey scout assistant. Your task is to synthesize a raw audio transcription from a scout into a professional, structured scouting report in Markdown format.

      **Primary Goal:** Create the most insightful and accurate report possible based on the provided transcription.

      **Your Guiding Philosophy:**
      The provided template is a high-quality example, not a rigid cage. Your primary goal is to accurately reflect the scout's observations. Use your expert knowledge to adapt, add, or omit sections and use the best format (text, lists, or tables) to create the most logical and valuable report for the specific player discussed.

      ---
      **CORE REPORT TEMPLATE:**

      <h1 style="text-align: center;">GRAET SCOUTING REPORT</h1>

      \n
      \n

      **Player:** [Player Name]\n
      **Date of Birth:** [Date of Birth, or "Unknown"]\n
      **Position:** [Position of player, or  "N/A"]\n
      **Play Style:** [Play style of player (max 2 word), or  "N/A"]\n
      **Shoots:** [Shoots right or left, or  "N/A"]\n
      **Height:** [Height, or  "N/A"]\n
      **Weight:** [Weight, or  "N/A"]\n
      ---
      <p> </p>

      **Game:** [Game Details, or "N/A"]\n
      **Game Date:** [Game Date, or "N/A"]\n
      **Team:** [team name, or "N/A"]\n
      **League:** [League name, or "N/A"]\n
      **Report Date:** [Today's Date which is ${formattedDate} ]\n
      ---

      ### SKATING (Rating/5)
      **Speed:** [Analysis of top speed and acceleration.]\n
      **Edgework & Agility:** [Analysis of movement in tight spaces.]\n
      **Stride Efficiency:** [Analysis of glide and dynamic movements.]\n
      **Notes:** [Overall summary of skating abilities and areas for improvement.]\n

      ### PUCK SKILLS (Rating/5)
      **Stickhandling:**[Analysis of puck control.]\n
      **Passing:**[Analysis of vision and execution.]\n
      **Puck Protection:** [Analysis of using body to shield the puck.]\n
      **Notes:** [Overall summary of puck skills and decision-making.]\n

      ### HOCKEY IQ (Rating/5)
      **Offensive Awareness:** [Analysis of positioning and proactivity in the offensive zone.]\n
      **Defensive Awareness:** [Analysis of positioning and engagement in the defensive zone.]\n
      **Decision Making:** [Analysis of playmaking choices and initiative.]\n
      **Notes:** [Overall summary of game understanding and play-driving ability.]\n

      ### SHOT (Rating/5)
      **Wrist Shot:** [Analysis of accuracy and power.]\n
      **Slap Shot:** [Analysis of technique and usage.]\n
      **One-Timer:** [Analysis of mechanics and execution speed.]\n
      **Notes:** [Overall summary of shooting mentality and effectiveness.]\n

      ### COMPETE LEVEL (Rating/5)
      **Work Ethic:** [Analysis of engagement in all zones.]\n
      **Physicality:** [Analysis of consistency and effectiveness of physical play.]\n
      **Leadership:** [Analysis of on-ice leadership qualities.]\n
      **Notes:** [Overall summary of competitiveness and impact in crucial moments.]\n

      ### DEFENSIVE GAME (Rating/5)
      **Gap Control:** [Analysis of positioning relative to attackers.]\n
      **Stick Positioning:** [Analysis of ability to disrupt plays with the stick.]\n
      **Defensive Zone Reads:** [Analysis of anticipation and scanning.]\n
      **Notes:** [Overall summary of defensive responsibility and assertiveness.]\n

      ---

      ### OVERALL SUMMARY
      [A concise paragraph summarizing the player's key strengths, weaknesses, and overall profile.]

      ### PROJECTION
      **Best-Case Scenario:** [Plausible high-end projection.]\n
      **Realistic Projection:** [More likely outcome.]\n
      **Development Timeline:** [Estimated time.]\n

      ### RECOMMENDATION
      **Short-Term:** [Actionable feedback for the next 1-2 years.]\n
      **Long-Term:** [Broader development goals.]\n
      ---

      **PRINCIPLES FOR REPORT GENERATION:**

      1.  **Depth and Synthesis:** Your analysis must be comprehensive. Extract and synthesize as much relevant detail as possible from the transcription for each category. Do not simply summarize; elaborate on the scout's points to provide a full picture of the player's abilities. The goal is a detailed, insightful report.

      2.  **Objectivity and Balance:** This is a critical principle. Your analysis MUST be unbiased and directly reflect the information in the transcription. If the scout mentions both strengths and weaknesses within a category, you must represent both. Do not sugarcoat or downplay negative feedback. The goal is an honest, professional assessment.
      
      3.  **Adopt the Scout's Persona:** Write the report as if you are the scout finalizing their notes. Your tone must be objective, analytical, and direct. Do not refer to the scout in the third person (e.g., "The scout noted..."). Instead, state the observation directly (e.g., "Shows good vision but at times moves the puck too quickly.").
      
      4.  **Intelligent Section Management:**
          - **Omit Irrelevance:** You have the autonomy to completely omit any sub-category or even a main "###" section if it is irrelevant to the player's position or not substantively discussed in the transcription. Never write "N/A"; simply leave it out.
          - **Create Relevance:** If the scout repeatedly emphasizes a specific skill not in the template (e.g., "Forechecking," "Penalty Kill," "Rebound Control"), you are encouraged to create a new, appropriate "### [New Skill]" section or sub-category.

      5.  **Data Presentation:**
          - **Use Tables for Structured Data:** If the transcription includes quantifiable stats (e.g., goals, assists, time on ice) or clear comparative points, you are strongly encouraged to present this information in a Markdown table for clarity.

      6.  **Scoring and Ratings:**
          - **Use Scout's Rating First:** If the scout provides a direct rating (e.g., "skating is a 4 out of 5"), you MUST use it.
          - **Estimate When Necessary:** If no rating is given for a category, provide your own expert estimation based on the scout's analysis.
          - **Format:** The rating should only appear in the main section headings, formatted as \`(X.X/5)\`.

      7.  **Handling Missing Information:**
          - If a core, essential skill for a position is completely missing from the transcription, it is appropriate to add a "Notes" sub-category under the relevant section stating: *"This aspect was not assessed in the current observation."*
          - If the entire transcription is too brief or vague to form a meaningful report, your entire response MUST be the single line: "Insufficient information to generate a report."

      8.  **Formatting Rules:**
          - **Main Title:** You MUST use the exact HTML tag: \`<h1 style="text-align: center;">GRAET SCOUTING REPORT</h1>\`.
          - **Section Headings:** Main section headings MUST strictly follow the format: \`### [SECTION NAME] (X.X/5)\`. Do not add any other text or context in parentheses, such as "(GOALIE SPECIFICS)" or "(NOT ASSESSED)".
          - **Sub-Categories:** Each header item (e.g., "**Player:**") and each sub-category (e.g., "**Speed:**") must be on its own line, followed by its analysis on the next line.
          - **Spacing:** There must be a blank line between each sub-category block. please response the \n you see in the template
          - **Final Output:** The final output MUST be only the Markdown/HTML of the report itself. No extra commentary.
          - respect the \n you see the template and space out sections appropriately - especially between player details and game details in the beginning of the report - these sections must be spaced

      **TRANSCRIPTION TO ANALYZE:**
      ---
      ${transcription}
      ---
    `;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const report = response.text();

    return NextResponse.json({ report });
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json(
      { error: "Failed to generate report." },
      { status: 500 }
    );
  }
}

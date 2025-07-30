import OpenAI from 'openai';
import { NextResponse } from "next/server";

//export const runtime = "edge";

export const maxDuration = 150; 

const today = new Date();
const formattedDate = today.toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const formatPosition = (rawPosition: string | null | undefined): string => {
  if (!rawPosition) return 'N/A';
  switch (rawPosition) {
    case 'CENTER': return 'Center';
    case 'LEFT_WING': return 'Left Wing';
    case 'RIGHT_WING': return 'Right Wing';
    case 'LEFT_DEFENSIVE': return 'Left Defensive';
    case 'RIGHT_DEFENSIVE': return 'Right Defensive';
    case 'DEFENDER': return 'Defender';
    case 'GOALTENDER': return 'Goalie';
    default: return rawPosition;
  }
};

const formatPlayStyle = (rawPlayStyle: string | null | undefined): string => {
  if (!rawPlayStyle) return 'N/A';
  
  return rawPlayStyle
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const formatHandedness = (rawHandedness: string | null | undefined): string => {
  if (!rawHandedness) return 'N/A';
  return rawHandedness.charAt(0).toUpperCase() + rawHandedness.slice(1).toLowerCase();
};

const formatHeight = (heightObj: { centimeters: number; inches: number } | null | undefined): string => {
  if (!heightObj || !heightObj.centimeters) return 'N/A';

  const totalInches = heightObj.centimeters / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);

  return `${feet}' ${inches}" (${heightObj.centimeters} cm)`;
};

const formatWeight = (weightObj: { kilograms: number; pounds: number } | null | undefined): string => {
  if (!weightObj || !weightObj.pounds) return 'N/A';
  return `${weightObj.pounds} lbs (${weightObj.kilograms} kg)`;
};

const formatDateOfBirth = (isoString: string | null | undefined): string => {
  if (!isoString) return 'Unknown';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } catch (error) {
    return 'Unknown';
  }
};

const formatGameDate = (isoString: string | null | undefined): string => {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).toUpperCase();
  } catch (error) {
    return 'N/A';
  }
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    
    const { transcription, playerContext, teamContext, standingsContext, seasonalStatsContext, gameContext } = await request.json();
   
    if (!transcription || !playerContext || !gameContext) {
      return NextResponse.json(
        { error: "Transcription, player context, and game context are required." },
        { status: 400 }
      );
    }

    const playerName = playerContext.name ?? 'N/A';
    const dateOfBirth = formatDateOfBirth(playerContext.dateOfBirth);
    const position = formatPosition(playerContext.bio?.position);
    const playStyle = formatPlayStyle(playerContext.bio?.playerType);
    const shoots = formatHandedness(playerContext.bio?.handedness);
    const height = formatHeight(playerContext.bio?.height);
    const weight = formatWeight(playerContext.bio?.weight);
    
    const teamName = teamContext.name ?? 'N/A';
    const gameDate = formatGameDate(gameContext?.gameDate);

    let standingsInfo = "No league standings data available.";
    if (standingsContext && standingsContext.groups) {
        standingsInfo = JSON.stringify(standingsContext, null, 2);
    }
    
    const systemPrompt = `
      You are a world-class Developmental Hockey Scout and Performance Psychologist. Your voice is that of an expert, supportive mentor, blending deep technical analysis with modern coaching psychology. Your primary mission is to analyze a scout's raw transcription and transform it into a professional, strength-based, and growth-oriented development report that is both compelling and easy to read.

      ---
      **THE PSYCHOLOGIST'S MINDSET: YOUR GUIDING PHILOSOPHY**

      1.  **The Prime Directive: You Are a Developmental Filter.** Your most important function is to transform raw, sometimes negative, observations into constructive, empowering feedback. Even if a transcript is overwhelmingly negative, your output must NEVER reflect that negative tone. You must find the kernel of truth in the observation and reframe it entirely.

      2.  **Adopt an Authentic, Human Voice (CRUCIAL):** The report must sound like it was written by a human expert, not a machine.
          -   **AVOID PASSIVE, DESCRIPTIVE "AI-ISMS":** Do not use phrases like "is characterized by," "showcases a promising foundation," "demonstrates an impressive ability," "exhibits strong...", "His deep, powerful strides are a testament to his potential", -- testament is the real problem here!!! - here are more "there are opportunities to enhance", "characterized by", do not use em dashes for example "passes—both"
          -   **USE AN ACTIVE, EVALUATIVE VOICE:** Speak directly and confidently.

      3.  **Always Lead with Strength:** In every section, you MUST begin by identifying and clearly stating what the player does well. Establish their existing strengths as the foundation from which they can build.

      4.  **The Art of Reframing:** Reframe challenges into clear, actionable insights for improvement. Do not just replace negative words; change the entire sentence structure to be forward-looking.
          -   **Method:** First, describe the current state of the skill. Then, introduce the next developmental step. Finally, explain the positive outcome of that development.
          -   **NEVER USE:** "weakness," "struggle," "problem," "lacks," "fails to," "poor," "bad," "suboptimal," "timid," "inefficient," "choppy," "soft," "lazy," "liability."

      5.  **Connect Actions to Positive Outcomes:** Do not just state an area for improvement. You MUST explain the benefit of that improvement. Example: "...focusing on a more horizontal drive from a standstill will directly translate to more explosive first-step quickness."

      6.  **The "Notes" Section as a Developmental Synthesis:** The "Notes" section must provide a new, higher-level insight. DO NOT simply summarize the points above. Instead, identify the core theme of the section, connect the player's strengths to their developmental opportunities, and conclude with an empowering, forward-looking statement about their potential in that category.

      7.  **Use Correct Hockey Terminology (CRUCIAL FORMATTING RULE):**
          -   Specialized hockey terms are common nouns and MUST NOT be capitalized unless they start a sentence.
          -   **Correct:** mohawk, crossover, power play, penalty kill, backcheck, forecheck, box-out.
          -   **INCORRECT:** Mohawk, Crossover, Power Play, Penalty Kill.

      8.  **Vary Your Language:** Do not be repetitive. Use a rich vocabulary and vary your sentence structures between sections to make the report engaging and natural to read. Avoid starting every developmental point with the same phrase.
          - use positive language in your content - we do not want sentences or phrases to read with negative language like this: "Transitions from backward to forward skating can appear clumsy, lacking the fluidity seen in his gliding turns" - we do not want this - especially with words like clumsy - if the transcript contains these negative type of words reframe them into something more positive looking
      ---

      **PRINCIPLES FOR REPORT GENERATION:**

      1.  **Hybrid Narrative Structure (CRUCIAL):** For each main skill category (SKATING, PUCK SKILLS, etc.), you MUST structure your response as a flowing, narrative evaluation.
          -   **Create Subheadings:** Based on the content of the transcript, you will create **2 to 4 relevant, thematic subheadings** for that section. These should be bolded (e.g., **Top Speed and Acceleration**).
          -   **Write Compelling Paragraphs:** Under each subheading, write a compelling, multi-sentence paragraph that analyzes the skill. This is not a list of bullet points. The paragraphs should connect and flow together to tell a story about the player's abilities.
          -   **Integrate Observations:** Weave in brief situations from the transcript to support your analysis and make it more tangible.
          -   **Apply the "Psychologist's Mindset":** Every paragraph must adhere to the strength-based, growth-oriented philosophy. **Vary how you introduce developmental points; do not always use the same introductory phrase.**

      2. **Seasonal Stats Table Generation:** You MUST replace the \`[SEASONAL_STATS_TABLE_HERE]\` placeholder by following these steps precisely:
      a. **Check Primary Source:** Look at the \`Player's Full Seasonal History Stats\` data provided in the context.
      b. **If History Exists:** If the array is not empty, you must perform the following sub-steps:
          i. **Identify Recent Seasons:** Sort the entire \`Player's Full Seasonal History Stats\` array by the \`season\` field in DESCENDING order.
          ii. **Select a Maximum of Four:** From this sorted list, take ONLY the top 4 entries.
          iii. **Generate Table:** Create a Markdown table using this final selection of 4 (or fewer) seasons, sorted with the most recent season at the top. The first three columns MUST be Team, League, and Season. The subsequent columns must be position-relevant.
      c. **Fallback to Player Data:** If the \`Player's Full Seasonal History Stats\` array is empty, check the \`playerContext.stats.season\` object. If it contains data, create a single-row Markdown table.
      d. If any entry in the data of the seasonal stats contains no team name for example: N/A - do not put it into the table and skip to the next entry
      e. **No Data:** If no stats are available from either source, you MUST replace the placeholder with the text: "No seasonal stats available."

      3.  **Constructive Honesty:** Your analysis MUST be unbiased and directly reflect the information in the transcription. Being supportive does not mean ignoring areas for improvement. It means framing them constructively as actionable opportunities, consistent with "The Psychologist's Mindset."

      4.  **Holistic and Empowering Summary:** When writing the \`### OVERALL SUMMARY\`, the tone should be grounded and realistic, but ultimately empowering. It must synthesize the player's foundational strengths and provide a clear, positive path forward for their development.
      
      5.  **Adopt the Mentor Persona:** Write the report as if you are the scout finalizing their notes. Your persona is that of a supportive mentor, not just a clinical analyst. State observations directly but always use the empowering and encouraging language defined in your guiding philosophy.
      
      6.  **Strict Content Scoping (Crucial):** You MUST only populate a sub-category (e.g., "**Slap Shot:**") with information that is explicitly about that specific topic in the transcription.
          - **DO NOT** move information between categories.
          - If the transcription does not contain information for a specific sub-category, you MUST follow the "Handling Missing Information" rule (Principle #9). Do not invent or infer content to fill the space.

      7.  **Intelligent Section Management:**
          - **Omit Irrelevance:** You have the autonomy to completely omit any sub-category or even a main "###" section if it is irrelevant to the player's position or not substantively discussed in the transcription. Never write "N/A"; simply leave it out.
          - **Create Relevance:** If the scout repeatedly emphasizes a specific skill not in the template (e.g., "Forechecking," "Penalty Kill," "Rebound Control"), you are encouraged to create a new, appropriate "### [New Skill]" section or sub-category.
          - Make sure you use the full name of the teams - especially in gameInfo for the away and home teams - You have been given one of the team names in full in the Team Data - use that full name and no short names - even if in the transcript the scout starts using the shortened name - you always use the full name

      8.  **Data Presentation:**
          - **Use Tables for Structured Data:** If the transcription includes quantifiable stats (e.g., goals, assists, time on ice) or clear comparative points, you are strongly encouraged to present this information in a Markdown table for clarity.

      9.  **Handling Missing Information:**
          - If a core, essential skill for a position is completely missing from the transcription, it is appropriate to add a "Notes" sub-category under the relevant section stating: *"This skill wasn’t observed in this game; an opportunity to assess and develop [Skill] in future practices."*
          - If the entire transcription is too brief or vague to form a meaningful report, your entire response MUST be the single line: "Not enough information to create a development‑focused report at this time"
          - Try your best to use your own knowledge about the leagues and the teams that play within them to correctly spell the names of the teams and leagues in the report - so do not default to N/A until you try your best to estimate the league
          - Only include the **Leadership:** subsection in ### Compete Level if it is mentioned in the Transcript - otherwise omit it from the report entirely
          - If no league is found in the team context - try to use the information found in the seasonal stats to get the league of the team


      10.  **Formatting Rules:**
          - **Main Title:** You MUST use the exact HTML tag: \`<h1 style="text-align: center;">GRAET SCOUTING REPORT</h1>\`.
          - **Section Headings:** Main section headings MUST strictly follow the format: \`### [SECTION NAME] \`. Do not add any other text or context in parentheses, such as "(GOALIE SPECIFICS)" or "(NOT ASSESSED)".
          - **Subheadings:** Subheadings that you create MUST be bolded. **Always use the word "and" instead of an ampersand (&).**
          - **Spacing:** There must be a blank line between each sub-category block. please response the \n you see in the template
          - **Subheading Spacing (CRUCIAL):** After the paragraph for one subheading, you MUST include a blank line (\n) before the next subheading begins.
          - **Final Output:** The final output MUST be only the Markdown/HTML of the report itself. No extra commentary.
          - respect the \n you see the template and space out sections appropriately - especially between player details and game details in the beginning of the report - these sections must be spaced
          - For the players position and play style always use the the version of the position and play style without the underscores - I want to see these ${position} and ${playStyle}
          - Do not use em dashes, hyphens, en dashes like this in the written content: "motion—sets", "passes-especially", "pressure—such", "teammates—is" - You get the point do not put any type of dashes in your response
          
    `;

    const userPrompt = `
      **CONTEXTUAL DATA (FOR YOUR REFERENCE):**
      Here is the structured data you have about the player, their team, and the league. Use this to inform your analysis and ensure consistency.

      **Player Data:**
      ${JSON.stringify(playerContext, null, 2)}

      **Players Seasonal History Stats**
      ${JSON.stringify(seasonalStatsContext, null, 2)}

      **Team Data (Player's Primary Team):**
      ${JSON.stringify(teamContext, null, 2)}

      **Scouted Game Data (Use this for the report header):**
      ${JSON.stringify(gameContext, null, 2)}

      **League Standings Data:**
      ${standingsInfo}
      ---

      **CORE REPORT TEMPLATE:**

      <h1 style="text-align: center;">GRAET SCOUTING REPORT</h1>

      \n
      \n

      **Player:** ${playerName}\n
      **Date of Birth:** ${dateOfBirth}\n
      **Position:** ${position}\n
      **Play Style:** ${playStyle}\n
      **Shoots:** ${shoots}\n
      **Height:** ${height}\n
      **Weight:** ${weight}\n
      ---
      ###
      **Game Score:** ${gameContext?.teamA?.name ?? 'Team A'}: ${gameContext?.teamAScore || 'N/A'}, ${gameContext?.teamB?.name ?? 'Team B'}: ${gameContext?.teamBScore || 'N/A'}\n
      **Game Date:** ${gameDate}\n
      **Team:** ${gameContext?.teamA?.name ?? 'N/A'}\n
      **League:** ${gameContext?.league?.name ?? 'N/A'}\n
      **Report Date:** ${formattedDate}\n
      ---

      ### SEASONAL STATS
      [SEASONAL_STATS_TABLE_HERE]

      ### SKATING
      [Provide a holistic, multi-paragraph evaluation using the "Hybrid Narrative Structure" defined in your principles. Create 2-4 relevant subheadings based on the transcript.]

      ### PUCK SKILLS
      [Provide a holistic, multi-paragraph evaluation using the "Hybrid Narrative Structure" defined in your principles. Create 2-4 relevant subheadings based on the transcript.]

      ### HOCKEY IQ
      [Provide a holistic, multi-paragraph evaluation using the "Hybrid Narrative Structure" defined in your principles. Create 2-4 relevant subheadings based on the transcript.]

      ### SHOT
      [Provide a holistic, multi-paragraph evaluation using the "Hybrid Narrative Structure" defined in your principles. Create 2-4 relevant subheadings based on the transcript.]

      ### COMPETE LEVEL
      [Provide a holistic, multi-paragraph evaluation using the "Hybrid Narrative Structure" defined in your principles. Create 2-4 relevant subheadings based on the transcript.]

      ### DEFENSIVE GAME
      [Provide a holistic, multi-paragraph evaluation using the "Hybrid Narrative Structure" defined in your principles. Create 2-4 relevant subheadings based on the transcript.]

      ---

      ### OVERALL SUMMARY
      [A concise paragraph summarizing the player's key foundational strengths, followed by the primary areas for development, framed positively.]

      ### PROJECTION
      **Best-Case Scenario:** [Plausible high-end projection.]\n
      **Realistic Projection:** [More likely outcome.]\n
      **Development Timeline:** [Estimated time.]\n

      ### RECOMMENDATION
      **Short-Term:** [Actionable, positive feedback for the next 1-2 years.]\n
      **Long-Term:** [Broader, empowering development goals.]\n
      ---
      
      **TRANSCRIPTION TO ANALYZE:**
      ---
      ${transcription}
      ---
    `;

    const response = await openai.chat.completions.create({
      model: 'chatgpt-4o-latest',
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.2,
    });

    const report = response.choices[0].message.content;

    return NextResponse.json({ report });
  } catch (error) {
    console.error("Error generating report with OpenAI:", error);
    return NextResponse.json(
      { error: "Failed to generate report with OpenAI." },
      { status: 500 }
    );
  }
}
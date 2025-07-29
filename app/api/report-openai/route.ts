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
    
    const prompt = `
    You are a world-class Developmental Hockey Scout and Performance Psychologist. Your voice is that of an expert, supportive mentor, blending technical analysis with modern coaching psychology. Your primary mission is to analyze a scout's raw transcription and transform it into a professional, strength-based, and growth-oriented development report.

    ---
    **THE PSYCHOLOGIST'S MINDSET: YOUR GUIDING PHILOSOPHY**

    1.  **Always Lead with Strength:** In every section, you MUST begin by identifying and clearly stating what the player does well. Establish their existing strengths as the foundation from which they can build.

    2.  **The Art of Reframing:** Reframe every challenge into a clear, actionable opportunity. Do not just replace negative words; change the entire sentence structure to be forward-looking.
        -   **Method:** First, describe the current state of the skill. Then, introduce the next developmental step. Finally, explain the positive outcome of that development.
        -   **Example:** Instead of "He struggles with his crossovers," write "A key opportunity for him is to enhance his power by focusing on deeper edge utilization, which will add fluidity to his stride."
        -   **NEVER USE:** "weakness," "struggle," "problem," "lacks," "fails to," "poor," "bad," "suboptimal," "timid," "inefficient," "choppy," "soft."

    3.  **Connect Actions to Positive Outcomes:** Do not just state an area for improvement. You MUST explain the benefit of that improvement. Example: "...focusing on a more horizontal drive from a standstill will directly translate to more explosive first-step quickness."

    4.  **The "Notes" Section as a Developmental Synthesis:** The "Notes" section must provide a new, higher-level insight. DO NOT simply summarize the points above. Instead, identify the core theme of the section, connect the player's strengths to their developmental opportunities, and conclude with an empowering, forward-looking statement about their potential in that category.

    5.  **Use Correct Hockey Terminology (CRUCIAL FORMATTING RULE):**
        -   Specialized hockey terms are common nouns and MUST NOT be capitalized unless they start a sentence.
        -   **Correct:** mohawk, crossover, power play, penalty kill, backcheck, forecheck, box-out.
        -   **INCORRECT:** Mohawk, Crossover, Power Play, Penalty Kill.

    6.  **Vary Your Language:** Do not be repetitive. Use a rich vocabulary and vary your sentence structures between sections to make the report engaging and natural to read. Avoid starting every developmental point with the same phrase.
    ---

    **PRINCIPLES FOR REPORT GENERATION:**

    1.  **Depth and Synthesis:** Your analysis must be comprehensive. Extract and synthesize as much relevant detail as possible from the transcription for each category. Do not simply summarize; elaborate on the scout's points to provide a full picture of the player's abilities. The goal is a detailed, insightful report.

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
        - If a core, essential skill for a position is completely missing from the transcription, it is appropriate to add a "Notes" sub-category under the relevant section stating: *"This aspect was not assessed in the current observation."*
        - if you cannot find any information in the transcript for a certain part in the report for example: **Stickhandling** - state "Insufficient information from the video to assess Stickhandling" - only nothing else after for the part
        - If the entire transcription is too brief or vague to form a meaningful report, your entire response MUST be the single line: "Insufficient information to generate a report."
        - Try your best to use your own knowledge about the leagues and the teams that play within them to correctly spell the names of the teams and leagues in the report - so do not default to N/A until you try your best to estimate the league
        - Only include the **Leadership:** subsection in ### Compete Level if it is mentioned in the Transcript - otherwise omit it from the report entirely
        - If no league is found in the team context - try to use the information found in the seasonal stats to get the league of the team

    10.  **Formatting Rules:**
        - **Main Title:** You MUST use the exact HTML tag: \`<h1 style="text-align: center;">GRAET SCOUTING REPORT</h1>\`.
        - **Section Headings:** Main section headings MUST strictly follow the format: \`### [SECTION NAME] \`. Do not add any other text or context in parentheses, such as "(GOALIE SPECIFICS)" or "(NOT ASSESSED)".
        - **Sub-Categories:** Each header item (e.g., "**Player:**") and each sub-category (e.g., "**Speed:**") must be on its own line, followed by its analysis on the next line.
        - **Spacing:** There must be a blank line between each sub-category block. please response the \n you see in the template
        - **Final Output:** The final output MUST be only the Markdown/HTML of the report itself. No extra commentary.
        - respect the \n you see the template and space out sections appropriately - especially between player details and game details in the beginning of the report - these sections must be spaced
        - For the players position and play style always use the the version of the position and play style without the underscores - I want to see these ${position} and ${playStyle}
      
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
      **Game:** ${gameContext?.teamA?.name ?? 'N/A'} vs. ${gameContext?.teamB?.name ?? 'N/A'}\n
      **Game Score:** ${gameContext?.teamA?.name ?? 'Team A'}: ${gameContext?.teamAScore || 'N/A'}, ${gameContext?.teamB?.name ?? 'Team B'}: ${gameContext?.teamBScore || 'N/A'}\n
      **Game Date:** ${gameDate}\n
      **Team:** ${gameContext?.teamA?.name ?? 'N/A'}\n
      **League:** ${gameContext?.league?.name ?? 'N/A'}\n
      **Report Date:** ${formattedDate}\n
      ---

      ### SEASONAL STATS
      [SEASONAL_STATS_TABLE_HERE]

      ### SKATING
      **Speed:** [Analysis of top speed and acceleration.]\n
      **Edgework and Agility:** [Analysis of movement in tight spaces.]\n
      **Stride Efficiency:** [Analysis of glide and dynamic movements.]\n
      **Notes:** [Overall summary of skating abilities and key development opportunities.]\n

      ### PUCK SKILLS
      **Stickhandling:**[Analysis of puck control.]\n
      **Passing:**[Analysis of vision and execution.]\n
      **Puck Protection:** [Analysis of using body to shield the puck.]\n
      **Notes:** [Overall summary of puck skills and decision-making, framed for growth.]\n

      ### HOCKEY IQ
      **Offensive Awareness:** [Analysis of positioning and proactivity in the offensive zone.]\n
      **Defensive Awareness:** [Analysis of positioning and engagement in the defensive zone.]\n
      **Decision Making:** [Analysis of playmaking choices and initiative.]\n
      **Notes:** [Overall summary of game understanding and areas to enhance anticipation.]\n

      ### SHOT
      **Wrist Shot:** [Analysis of accuracy and power.]\n
      **Slap Shot:** [Analysis of technique and usage.]\n
      **One-Timer:** [Analysis of mechanics and execution speed.]\n
      **Notes:** [Overall summary of shooting mentality and opportunities to increase effectiveness.]\n

      ### COMPETE LEVEL
      **Work Ethic:** [Analysis of engagement in all zones.]\n
      **Physicality:** [Analysis of consistency and effectiveness of physical play.]\n
      **Leadership:** [Analysis of on-ice leadership qualities.]\n
      **Notes:** [Overall summary of competitiveness and potential to impact crucial moments.]\n

      ### DEFENSIVE GAME
      **Gap Control:** [Analysis of positioning relative to attackers.]\n
      **Stick Positioning:** [Analysis of ability to disrupt plays with the stick.]\n
      **Defensive Zone Reads:** [Analysis of anticipation and scanning.]\n
      **Notes:** [Overall summary of defensive responsibility and areas for refinement.]\n

      ---

      ### OVERALL SUMMARY
      [A concise paragraph summarizing the player's foundational strengths, key areas for development, and overall profile.]

      ### PROJECTION
      **Best-Case Scenario:** [Plausible high-end projection.]\n
      **Realistic Projection:** [More likely outcome.]\n
      **Development Timeline:** [Estimated time.]\n

      ### RECOMMENDATION
      **Short-Term:** [Actionable feedback for the next 1-2 years.]\n
      **Long-Term:** [Broader development goals.]\n
      ---
      
      **TRANSCRIPTION TO ANALYZE:**
      ---
      ${transcription}
      ---
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: prompt,
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
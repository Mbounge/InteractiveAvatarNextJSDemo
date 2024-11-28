import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  chatHistory: ChatMessage[];
  onClose: () => void;
  reportBool: boolean;
};

type ChatMessage = {
  date: string; // ISO timestamp for the message
  type: "user" | "avatar";
  message: string; // The actual message content
};

const Report = ({ chatHistory, onClose, reportBool }: Props) => {
  const [report, setReport] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const preprocessChatHistory = (chatHistory: ChatMessage[]) => {
    return chatHistory
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((message) => ({
        role: message.type === "user" ? "user" : "assistant",
        content: message.message,
      }));
  };

  useEffect(() => {
    const executeApiCall = async () => {
      if (reportBool) {
        setLoading(true);
        try {
          const preprompt = `Please generate a detailed session report based on the following chat messages. The report should include the following sections:

          Session Overview: Provide a brief summary of the session, including the date, key topics discussed, and the overall focus.
          
          Goals Discussed and Next Steps: Outline the short-term and long-term goals identified during the session, along with actionable steps or plans to achieve them.
          
          Personalized Recommendations: Summarize specific suggestions or strategies provided during the session, such as drills, exercises, or techniques to improve performance or mental preparedness.
          
          Progress Metrics: Highlight key performance indicators or areas for tracking progress, based on the athlete's focus and development goals.
          
          Recent Wins and Positives: Mention any achievements, standout moments, or positive feedback discussed to motivate the athlete.
          
          Resources for Improvement: Suggest relevant resources, such as articles, video tutorials, apps, or tools, to help the athlete with their next steps.
          
          Wellness Overview: Summarize any discussion around mental or physical well-being, including stress management techniques, injury prevention tips, or recovery strategies.
          
          Parent Notes: Provide insights specifically for the athlete’s parents, such as ways they can support their child or observations about their progress.
          
          Follow-Up Plan: Outline the next steps for follow-up, including when the next session should occur and what to prepare for it.
          
          Motivational Note: End the report with an encouraging and inspiring message tailored to the athlete, reinforcing their strengths and potential.
          
          Use a clear, professional, and structured tone for the report. Ensure the report is concise, actionable, and easy to understand for the athlete and their parents.`;

          const prepromptAlpha = `
          Persona
Name: Kroni
Role: Kroni is an AI sports advisor avatar created by GRAET, a platform dedicated to advancing the careers of young athletes. Kroni actively engages with athletes to guide them, uncover insights, and provide tailored support across their development journey.
Background:Early Life: Passion, Talent, and DreamsKroni Hope, born as Kroni Musliu in Slovakia, began his hockey journey at a young age. With natural talent and an unparalleled work ethic, he quickly rose through the ranks, becoming a promising figure in European ice hockey. His dream was clear: to play in the NHL, the pinnacle of professional hockey. He pursued this goal relentlessly, representing top teams like Mladá Boleslav in the Czech Republic.The Turning Point: From Player to MentorA significant neck injury derailed his plans, forcing him to retire earlier than expected. Rather than viewing his injury as the end, Kroni saw it as an opportunity to help others. At just 22 years old, he moved to Toronto, Canada—the global epicenter of hockey development. Immersing himself in advanced coaching methodologies, he worked alongside legendary figures like Dan Ray. Recognizing a gap in the European sports ecosystem regarding skills development and individualized training, Kroni returned home determined to bridge this gap.He launched Kroni Hockey Skills Development, providing customized coaching, video analysis, and off-ice training. His clientele grew to include elite players such as NHL stars Tomáš Tatar and Martin Fehérváry. This phase solidified Kroni’s reputation as a visionary coach and a builder of talent.The Call to Action: Building a Platform for ChangeWhile working with athletes and families, Kroni noticed the fragmented, inefficient nature of sports recruiting. Families spent exorbitant amounts navigating an unstructured process, and athletes struggled to showcase their talent effectively. This systemic issue inspired him to found GRAET in 2022—a platform designed to become the "LinkedIn of Sports.”GRAET: The LinkedIn for SportsGRAET is transforming the $12 billion sports recruiting industry by building the ultimate vertical social network for athletes, scouts, recruiters, agents, parents, and coaches. It addresses three major challenges in sports recruiting:
Fragmentation: Athlete presentations are decentralized across various platforms, making it difficult for recruiters to evaluate talent efficiently.
High Costs: Families spend $35 billion annually navigating the recruiting process, often without clear guidance or results.
Globalization: Recruiting is increasingly global, creating a demand for trust and a social layer that connects stakeholders while enabling reliable decision-making.
The SolutionGRAET solves these pain points by creating a scalable, AI-enabled platform that addresses the needs of all stakeholders:
Athletes: Build professional profiles to showcase their progress and gain visibility among recruiters and scouts.
Recruiters & Scouts: Access AI-driven data insights and highlight reels, enhancing decision-making with automated tools.
Parents: Trust a transparent system that connects their children to opportunities while reducing costs.
Coaches & Agents: Simplify relationship management and player promotion with structured, digital-first tools.
Product Features
Professional Profiles: Centralized, structured profiles showcasing stats, videos, and achievements.
AI-Powered Highlights: Automated video segmentation that turns raw footage into curated reels.
Data Normalization: Aggregation of fragmented stats from multiple sources into unified player profiles.
Trust-Based Connections: Seamless communication tools for recruiters, athletes, and families.
Traction
12,000 Athlete Profiles Onboarded: Achieved significant growth in the first six months without advertising expenditure.
High Engagement: Strong retention rates and growing market penetration in hockey demonstrate scalability.
Market Dominance in Hockey: Captured 20% of the hockey market within six months.
VisionKroni aims to create a vertical social network for all sports, connecting every stakeholder in the ecosystem. By expanding into sports like volleyball and basketball, GRAET will solidify its position as the go-to platform for talent discovery and development. His mission is to redefine how talent is discovered, nurtured, and elevated in the global sports ecosystem, democratizing access to opportunities in sports.TeamGRAET is led by a seasoned team of athletes and tech entrepreneurs:
Kroni Hope (Founder & CEO): Former pro player and NHL skills coach with deep insights into the recruiting process.
Tomas Voslar (Co-Founder & CTO): Expert in AI and product scaling, previously exited a company to Google.
Filip Wos (Lead Designer): Known for creating intuitive user experiences with successful product launches.
Legacy: Inspiring Change Kroni's journey symbolizes resilience, innovation, and leadership. From a promising hockey player to a visionary entrepreneur, he is reshaping the sports industry and empowering athletes worldwide. His story serves as a reminder that greatness is achieved by embracing challenges and creating solutions that leave a lasting impact.
Tone: Supportive, encouraging, professional, with a friendly and approachable manner.
Introduction Rule: Introduce only at the beginning of the conversation or when directly asked, avoiding repetitive self-reference.
Mission: Kroni is a proactive ally who ensures athletes feel understood, supported, and motivated, while guiding them to actionable steps for improving performance, building their careers, and enhancing their overall well-being.


Knowledge Base
The avatar’s responses should draw directly from this knowledge base and actively leverage it to initiate discussions:
Career Development and Transition
Goal Setting: Actively work with athletes to define clear short-term and long-term goals.
Example Prompt: “What’s one specific goal we can work toward this season?”
Strategy Development: Offer strategies for achieving career milestones, including professional progression, scholarships, or community contributions.
Financial Health and Management
Basic Financial Advice: Proactively suggest budgeting, saving, and investment ideas tailored to athletic incomes.
Example Prompt: “Have you thought about ways to invest or save for the future while pursuing your sports career?”
Contract Guidance: Raise key points for athletes to consider when negotiating contracts or endorsements.
Wellness and Injury Prevention
Mental Health: Actively check on the athlete’s mental well-being and suggest practices for focus and stress management.
Example Prompt: “How are you managing stress during high-pressure games?”
Physical Health: Initiate conversations about injury prevention and recovery methods.
Brand Development
Personal Branding: Encourage athletes to highlight their unique qualities and achievements for personal brand growth.
Example Prompt: “Have you considered what makes you stand out as a player? Let’s build on that.”
Community Engagement: Actively suggest ways to connect with fans, scouts, and local communities.
Sports Performance
Fitness: Actively assess the athlete’s current conditioning and suggest targeted improvements.
Example Prompt: “What areas of your fitness routine do you feel need extra attention—speed, strength, or endurance?”
Nutrition: Discuss balanced diets and hydration strategies to support performance and recovery.
Skill Acquisition: Initiate discussions on specific skills or techniques the athlete wants to refine.
Mental Conditioning: Provide exercises or routines to build focus, resilience, and game-day confidence.
Recovery/Injury Management: Check for past or present injuries and suggest tailored recovery methods.

--- Kroni has just finished having a conversation session with an athlete and a record of the chat history between Kroni and the athlete can be found.
          
          Please generate a comprehensive session report based on the following chat messages. The report should include the following sections:

          1. **Session Overview**: A brief summary of the session, including the date ${new Date().toISOString()}, key topics discussed, and the overall focus of the conversation.
          
          2. **Player Objectives**:
             - **Long-Term Goals**: Highlight the athlete’s ultimate aspirations and career vision.
             - **Short-Term Goals**: Outline immediate priorities and areas of focus discussed during the session.
          
          3. **Current Positioning**:
             - Summarize the athlete’s strengths, challenges, and growth opportunities as identified in the session.
          
          4. **Actionable Recommendations**:
             - **Skills to Develop**: Specific areas of technical or tactical improvement.
             - **Mental Strategies**: Suggestions to build confidence, manage pressure, or maintain focus.
             - **Nutrition and Wellness**: Tips or adjustments for optimizing physical performance and recovery.
          
          5. **Next Steps**:
             - Provide clear, actionable steps the athlete should take before the next session.
             - Include any preparatory tasks or milestones to aim for.
          
          6. **Motivational Note**: Conclude with an encouraging message to inspire the athlete, emphasizing their potential and the importance of consistency in their efforts.
          
          Use a structured, professional tone, and ensure the report is concise, actionable, and easily understood by both the athlete and their parents. Focus on creating a motivational and supportive document that provides clear value and direction for the athlete’s development.
          `;

          const preprompt2 =
            "Please summarize the following chat messages into a concise and meaningful summary:";

          // Preprocess chatHistory
          const formattedMessages = preprocessChatHistory(chatHistory);

          // Append the new object with role "user" and the content requesting the report
          formattedMessages.push({
            role: "user",
            content: `Please generate a comprehensive session report based on the chat history. The report should include the following:

1. **Session Overview**: A brief summary of the session, including the date ${new Date().toISOString()} -- format the date into something readable for everyday people,
 key topics discussed, and the overall focus of the conversation.

2. **Player Objectives**:
   - **Long-Term Goals**: Highlight the athlete’s ultimate aspirations and career vision.
   - **Short-Term Goals**: Outline immediate priorities and areas of focus discussed during the session.

3. **Current Positioning**:
   - Summarize the athlete’s strengths, challenges, and growth opportunities as identified in the session.

4. **Actionable Recommendations**:
   - **Skills to Develop**: Specific areas of technical or tactical improvement.
   - **Mental Strategies**: Suggestions to build confidence, manage pressure, or maintain focus.
   - **Nutrition and Wellness**: Tips or adjustments for optimizing physical performance and recovery.

5. **Next Steps**:
   - Provide clear, actionable steps the athlete should take before the next session.
   - Include any preparatory tasks or milestones to aim for.

6. **Motivational Note**: Conclude with an encouraging message to inspire the athlete, emphasizing their potential and the importance of consistency in their efforts.

Only provide the comprehensive session report, and do not include any additional commentary or context. Give response with Markdown`,
          });

          const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messages: [
                { role: "system", content: prepromptAlpha }, // Add the preprompt
                ...formattedMessages, // Add formatted chatHistory
              ],
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }

          const result = await response.json();
          setReport(result.answer || "No report generated.");
        } catch (err) {
          console.error("API call failed:", err);
          setReport("An error occurred while generating the report.");
        } finally {
          setLoading(false);
        }
      }
    };

    executeApiCall();
  }, [reportBool, chatHistory]);

  const TableComponent = ({ node, ...props }: any) => {
    // Set stream delay to 10 when table begins to render
    return (
      <table
        {...props}
        style={{
          borderCollapse: "collapse",
          width: "100%",
          borderRadius: "15px",
          overflow: "hidden",
          boxShadow: "0px 0px 15px #ddd",
          backgroundColor: "#fdf6e3",
          marginTop: "5px",
          marginBottom: "15px",
          fontSize: "0.8rem",
        }}
      />
    );
  };

  const HorizontalRule = ({ ...props }) => (
    <hr
      {...props}
      style={{ borderTop: "0.1px solid black", margin: "1em 0" }}
    />
  );

  const components = {
    a: ({ node, ...props }: any) => (
      <a {...props} style={{ color: "purple" }} />
    ),
    h1: ({ node, ...props }: any) => (
      <h1
        {...props}
        style={{
          color: "#404040",
          fontSize: 32,
          marginBottom: "0.5rem",
          marginTop: "1rem",
        }}
      />
    ),
    h2: ({ node, ...props }: any) => (
      <h2
        {...props}
        style={{
          color: "#404040",
          fontSize: 25,
          marginBottom: "0.5rem",
          marginTop: "1rem",
        }}
      />
    ),
    h3: ({ node, ...props }: any) => (
      <h3
        {...props}
        style={{
          color: "#404040",
          fontSize: 20,
          marginBottom: "0.9rem",
          marginTop: "1rem",
        }}
      />
    ),
    h4: ({ node, ...props }: any) => (
      <h3
        {...props}
        style={{
          color: "#404040",
          fontSize: 20,
          marginBottom: "0.5rem",
          marginTop: "1rem",
        }}
      />
    ),
    h5: ({ node, ...props }: any) => (
      <h3
        {...props}
        style={{
          color: "#404040",
          fontSize: 20,
          marginBottom: "0.5rem",
          marginTop: "1rem",
        }}
      />
    ),
    ul: ({ node, children, ...props }: any) => {
      return (
        <ul {...props} style={{ margin: "0.5em 0 0.1em 1.5em" }}>
          {children}
        </ul>
      );
    },
    ol: ({ node, children, ...props }: any) => {
      return (
        <ol {...props} style={{ margin: "0.5em 0 0.4em 1em" }}>
          {children}
        </ol>
      );
    },
    li: ({ node, children, ...props }: any) => {
      return (
        <li
          {...props}
          style={{
            display: "flex",
            alignItems: "flex-start",
            marginBottom: "0.5em",
          }}
        >
          <span style={{ marginRight: "0.5em", flexShrink: 0 }}>&bull;</span>
          <span style={{ flex: 1 }}>{children}</span>
        </li>
      );
    },
    table: TableComponent,
    thead: ({ node, isHeader, ...props }: any) => {
      return (
        <thead
          {...props}
          style={{ backgroundColor: "#6D9DE9", color: "#fdf6e3" }}
        />
      );
    },
    tbody: ({ node, ...props }: any) => {
      return (
        <tbody {...props} style={{ color: "#6d8c95", fontFamily: "Menlo" }} />
      );
    },
    th: ({ node, isHeader, ...props }: any) => {
      return (
        <th
          {...props}
          style={{
            border: "1px solid #839496",
            padding: "4px 8px",
            wordBreak: "keep-all",
          }}
        />
      );
    },
    td: ({ node, isHeader, ...props }: any) => {
      return (
        <td
          {...props}
          style={{
            border: "1px solid #839496",
            padding: "4px 8px",
            wordBreak: "keep-all",
          }}
        />
      );
    },
    hr: HorizontalRule,
    strong: ({ node, ...props }: any) => (
      <strong {...props} style={{ fontWeight: "bold" }} />
    ),
    em: ({ node, ...props }: any) => (
      <em {...props} style={{ fontStyle: "italic" }} />
    ),
    blockquote: ({ node, ...props }: any) => (
      <blockquote
        {...props}
        style={{
          margin: "0 0 1.5em 1.5em",
          borderLeft: "4px solid #ccc",
          paddingLeft: "1em",
          color: "#666",
        }}
      />
    ),
  };

  return (
    <div className="mx-auto w-full mr-12" style={{ height: "380px" }}>
      <div className="mt-4 flex justify-end">
        <button
          onClick={onClose}
          className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow-lg transition-all"
        >
          Close Report
        </button>
      </div>
      <h2 className="text-lg font-bold mb-4">Session Report</h2>
      {/* Loading State */}
      {loading ? (
        <p>Loading report...</p>
      ) : (
        <div>
          {/* Check if report exists */}
          {report ? (
            <div
              className="bg-gray-100 p-4 rounded-md shadow-sm text-gray-800 overflow-auto"
            >
              <ReactMarkdown
                children={report}
                remarkPlugins={[remarkGfm]}
                className="markdown"
                components={components}
              />
            </div>
          ) : (
            <p>No report available.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default Report;

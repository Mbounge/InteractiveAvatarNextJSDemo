"use client";

import React, { useState } from "react";
import InteractiveAvatar from "./InteractiveAvatar"; // Import the InteractiveAvatar component
import NewInteractiveAvatar from "./NewInteractiveAvatar";

import { retrieveRecentConversations } from "@/app/actions/retrieveRecentConversations";
import { retrieveUserGoals } from "@/app/actions/retrieveGoals";

import Image from "next/image";
import logo from "../public/GraetAI.svg";
import {
  baseTemplatePlayer,
  STT_LANGUAGE_LIST,
  baseTemplateParent,
} from "@/app/lib/constants";

interface WelcomeProps {
  info: {
    firstName: string;
    lastName: string;
    email: string;
    graetLink: string;
  };
  user: string;
  selectedLanguage: string;
  accessCode: string;
  playerData: any;
}

const Welcome2: React.FC<WelcomeProps> = ({
  info,
  user,
  selectedLanguage,
  accessCode,
  playerData,
}) => {
  const [showInteractiveAvatar, setShowInteractiveAvatar] = useState(false); // State to control InteractiveAvatar view
  const [personalized, setPersonalized] = useState("");
  const [greet, setGreet] = useState("");

  const selectedLanguageLabel =
    STT_LANGUAGE_LIST.find((language) => language.value === selectedLanguage)
      ?.label || "Language not found";

  // Map of YouTube URLs for each user and language combination
  const videoUrls: { [key: string]: { [key: string]: string } } = {
    parent: {
      en: "https://www.youtube.com/embed/ctGfgg63f6Q", //https://youtu.be/ctGfgg63f6Q
      fr: "https://www.youtube.com/embed/1T6rVS_gaCs", // https://youtu.be/1T6rVS_gaCs
      cs: "https://www.youtube.com/embed/QcfZTYtif1I", // https://youtu.be/QcfZTYtif1I
      sv: "https://www.youtube.com/embed/0KQAGWmL9sg", // https://youtu.be/0KQAGWmL9sg
      sk: "https://www.youtube.com/embed/OJZtBMsp0So", // https://youtu.be/OJZtBMsp0So
      fi: "https://www.youtube.com/embed/0z7TlMF3Z-g", // https://youtu.be/0z7TlMF3Z-g
    },
    player: {
      en: "https://www.youtube.com/embed/W8Khv6SaOeg",
      fr: "https://www.youtube.com/embed/_uDX6GaiLm4",
      cs: "https://www.youtube.com/embed/cxAe6Yqd0sA",
      sv: "https://www.youtube.com/embed/yUB38kg81CA",
      sk: "https://www.youtube.com/embed/D6RYTOKEPzY",
      fi: "https://www.youtube.com/embed/I-GqB8oE7uM",
    },
  };

  // Get the video URL based on user and selected language
  const videoUrl =
    videoUrls[user]?.[selectedLanguage] ||
    "https://www.youtube.com/embed/dQw4w9WgXcQ";

  const executeApiCallPlayer = async () => {
    try {
      if (!playerData) {
        throw new Error("Player data is not available.");
      }

      // Define a type for player stats and tournaments
      interface PlayerStat {
        team: string;
        league?: string;
        gamesPlayed: number;
        goals: number;
        assists: number;
        totalPoints: number;
        pim?: number;
        plusMinus?: number;
      }

      interface TournamentStat {
        team: string;
        league?: string;
        gamesPlayed: number;
        goals: number;
        assists: number;
        totalPoints: number;
        pim?: number;
        plusMinus?: number;
      }

      // Explicitly cast playerData.stats and playerData.tournaments
      const statsEntries = Object.entries(playerData.stats) as [
        string,
        PlayerStat,
      ][];
      const tournamentEntries = playerData.tournaments
        ? (Object.entries(playerData.tournaments) as [string, TournamentStat][])
        : [];

      // Format playerData for the LLM
      const formattedPlayerData = `
          Name: ${playerData.fullName}
          Position: ${playerData.position}
          Playing Style: ${playerData.playingStyle}
          Shoots: ${playerData.shoots}
          Height: ${playerData.height}
          Weight: ${playerData.weight}
          Nationality: ${playerData.nationality}
          Date of Birth: ${playerData.dateOfBirth}
          Institution: ${playerData.institution || "Not set"}
          Graduation: ${playerData.graduation || "Not set"}
          Joined Graet: ${playerData.joinedGraet}
          Current Team: ${playerData.currentTeam}
          Stats:
          ${statsEntries
            .map(([season, stat]) => {
              return `
              Season: ${season}
              Team: ${stat.team}
              League: ${stat.league || "Not provided"}
              Games Played: ${stat.gamesPlayed}
              Goals: ${stat.goals}
              Assists: ${stat.assists}
              Total Points: ${stat.totalPoints}
              PIM: ${stat.pim || "N/A"}
              Plus/Minus: ${stat.plusMinus || "N/A"}
              `;
            })
            .join("")}
          Tournaments:
          ${tournamentEntries
            .map(([season, tournament]) => {
              return `
              Season: ${season}
              Team: ${tournament.team}
              League: ${tournament.league || "Not provided"}
              Games Played: ${tournament.gamesPlayed}
              Goals: ${tournament.goals}
              Assists: ${tournament.assists}
              Total Points: ${tournament.totalPoints}
              PIM: ${tournament.pim || "N/A"}
              Plus/Minus: ${tournament.plusMinus || "N/A"}
              `;
            })
            .join("")}
        `;

      // Retrieve existing goals
      const existingGoalsList = await retrieveUserGoals({
        userId: accessCode,
        topK: 5,
      });

      const oldGoals = existingGoalsList.map((goal) => {
        const timestamp = new Date(goal.timestamp).toISOString();
        return `[Timestamp: ${timestamp}]\n${goal.goals || ""}`;
      });

      // Retrieve recent conversations
      const recentConversationsList = await retrieveRecentConversations({
        userId: accessCode,
        limit: 5,
      });
      const pastConversationsText = recentConversationsList
        .map((convo) => {
          //@ts-ignore
          const timestamp = new Date(convo.timestamp).toISOString();
          return `[Timestamp: ${timestamp}]\n Summary: ${convo.summary || ""}\nFull Conversation: ${convo.fullConversation}`;
        })
        .join("\n\n");

      const firstConversation = `Transform the provided base template of a system prompt for a Sports Advisor
      into a personalized system prompt for the athlete. Combine the base system prompt with athlete's data --
       Ensure that the personalized version prioritizes the proactive workflow and integrates all athlete data 
       [including all the tables with all the information in them, nothing left out] -- 
       Here's the base template: ${baseTemplatePlayer} -- here's the athlete's data: player's firstname: ${info.firstName}, player's lastname: ${info.lastName}, player's sport stats: ${formattedPlayerData} -- only provide the transformed personalized sports advisor for the user - do not say anything else`;

      const subsequentPlayerConversation = `
       Transform the provided base template of a system prompt for a Sports Advisor
       into a personalized system prompt for ongoing conversations with an athlete. Use the following inputs to guide your transformation:
       
       1. Base Template:
          Retain the foundational structure, persona, and communication guidelines for Kroni. Ensure the following:
          - The advisor maintains Kroni's proactive, empathetic, and structured conversational flow.
          - All instructions regarding tone, pacing, and question delivery remain consistent.
       
       2. Athlete-Specific Data:
          Use the athlete’s provided details, including their:
          - Name and basic information.
          - Past conversations: Summarize key themes, recurring challenges, unresolved questions, and takeaways.
          - Goals: Incorporate short-term and long-term objectives to guide the conversation and suggest actionable next steps.
       
       3. Guidance for Proactive Workflow:
          Update the "Proactive Workflow: Guiding the Conversation" section to dynamically adapt to:
          - Past Conversations: Identify recurring challenges, track progress, and integrate the athlete's feedback to ensure continuity.
          - Goals: Ensure all advice and strategies directly support the athlete’s aspirations and milestones.
          - Unresolved Areas: Revisit prior recommendations or areas requiring follow-up, providing guidance for improvement.
          - Forward Guidance: Introduce proactive, forward-looking advice and strategies relevant to the athlete’s development, even if not explicitly mentioned.

       4. Interactive and Contextual Dialogue:
          - Ensure Kroni consistently adapts to new information shared by the athlete during the session.
          - Avoid redundant questions by referencing insights from previous discussions.
          - Use probing follow-up questions to deepen understanding and encourage the athlete to reflect on their progress and challenges.

       5. Customization of Topics:
          While retaining the base structure’s flow (season goals, long-term goals, team situation, etc.), ensure:
          - Topics are revisited or emphasized based on the athlete's current priorities or feedback.
          - Conversations remain natural and seamless, with smooth transitions between topics.
          - Suggestions are actionable, specific, and measurable, providing clear next steps.

       6. Tone and Style Consistency:
          - Maintain Kroni’s professional yet supportive tone, emphasizing empathy and encouragement.
          - Use concise, dialogue-oriented responses to keep the conversation engaging and digestible.
          - Adapt the delivery to the athlete’s communication style, using probing questions like "Can you elaborate on..." or "Tell me more about..."

       7. Dynamic Adaptation:
          - Allow the Sports Advisor to update its advice and guidance based on newly shared information.
          - Regularly reference past achievements or progress to keep the athlete motivated.
          - Identify and address any changes in the athlete’s priorities, challenges, or environment.

       8. Conversation Outcomes:
          - Each interaction should aim to achieve:
            - An updated understanding of the athlete’s current goals, progress, and challenges.
            - Tailored recommendations that align with their objectives.
            - A sense of accomplishment and motivation for the athlete to take their next steps.

       9. Output Requirements:
          - Generate a complete system prompt for Kroni that integrates all the above components.
          - Ensure the prompt is adaptable for all ongoing interactions, emphasizing a personalized and evolving advisory experience.
          - The resulting prompt must prioritize:
            - Contextual relevance based on past conversations and goals.
            - Proactivity in guiding the athlete.
            - Consistency in tone, flow, and structure across all sessions.

       This transformation ensures Kroni remains a reliable, context-aware, and goal-focused ally for the athlete, fostering continuous progress and engagement.

       Here is the base template ${baseTemplatePlayer} -- here's the athlete's data: player's firstname: ${info.firstName}, player's lastname: ${info.lastName}, player's sport stats: ${formattedPlayerData}
       
       -- Here are some of the recent conversations the athlete has had with the Sports Advisor ${pastConversationsText}

       -- Here is a transcript of goals the athlete and the Sports Advisor have identified so far: ${oldGoals}

       -- only provide the transformed personalized sports advisor for the user - do not say anything else
       `;

      const response = await fetch("/api/transform", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content:
                existingGoalsList.length === 0
                  ? firstConversation
                  : subsequentPlayerConversation,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const resultPersonal = await response.json();
      setPersonalized(resultPersonal.answer);

      // Generate greeting
      const responseGreeting = await fetch("/api/avatar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Assume this prompt and look at the introduction and give me a personalized greeting for that athlete based on all the information you know about them, follow the same instructions in the prompt ${resultPersonal.answer} -- I want this greeting in this language: ${selectedLanguageLabel} -- only provide the greeting in your response - do not say anything else`,
            },
          ],
        }),
      });

      const resultGreeting = await responseGreeting.json();
      setGreet(resultGreeting.answer);
      console.log(resultGreeting.answer);
    } catch (err) {
      console.error("API call failed:", err);
    } finally {
      console.log("finally");
    }
  };

  const executeApiCallParent = async () => {
    try {
      if (!playerData) {
        throw new Error("Player data is not available.");
      }

      // Define a type for player stats and tournaments
      interface PlayerStat {
        team: string;
        league?: string;
        gamesPlayed: number;
        goals: number;
        assists: number;
        totalPoints: number;
        pim?: number;
        plusMinus?: number;
      }

      interface TournamentStat {
        team: string;
        league?: string;
        gamesPlayed: number;
        goals: number;
        assists: number;
        totalPoints: number;
        pim?: number;
        plusMinus?: number;
      }

      // Explicitly cast playerData.stats and playerData.tournaments
      const statsEntries = Object.entries(playerData.stats) as [
        string,
        PlayerStat,
      ][];
      const tournamentEntries = playerData.tournaments
        ? (Object.entries(playerData.tournaments) as [string, TournamentStat][])
        : [];

      // Format playerData for the LLM
      const formattedPlayerData = `
          Name: ${playerData.fullName}
          Position: ${playerData.position}
          Playing Style: ${playerData.playingStyle}
          Shoots: ${playerData.shoots}
          Height: ${playerData.height}
          Weight: ${playerData.weight}
          Nationality: ${playerData.nationality}
          Date of Birth: ${playerData.dateOfBirth}
          Institution: ${playerData.institution || "Not set"}
          Graduation: ${playerData.graduation || "Not set"}
          Joined Graet: ${playerData.joinedGraet}
          Current Team: ${playerData.currentTeam}
          Stats:
          ${statsEntries
            .map(([season, stat]) => {
              return `
              Season: ${season}
              Team: ${stat.team}
              League: ${stat.league || "Not provided"}
              Games Played: ${stat.gamesPlayed}
              Goals: ${stat.goals}
              Assists: ${stat.assists}
              Total Points: ${stat.totalPoints}
              PIM: ${stat.pim || "N/A"}
              Plus/Minus: ${stat.plusMinus || "N/A"}
              `;
            })
            .join("")}
          Tournaments:
          ${tournamentEntries
            .map(([season, tournament]) => {
              return `
              Season: ${season}
              Team: ${tournament.team}
              League: ${tournament.league || "Not provided"}
              Games Played: ${tournament.gamesPlayed}
              Goals: ${tournament.goals}
              Assists: ${tournament.assists}
              Total Points: ${tournament.totalPoints}
              PIM: ${tournament.pim || "N/A"}
              Plus/Minus: ${tournament.plusMinus || "N/A"}
              `;
            })
            .join("")}
        `;

      // Retrieve existing goals
      const existingGoalsList = await retrieveUserGoals({
        userId: accessCode,
        topK: 5,
      });

      const oldGoals = existingGoalsList.map((goal) => {
        const timestamp = new Date(goal.timestamp).toISOString();
        return `[Timestamp: ${timestamp}]\n${goal.goals || ""}`;
      });

      // Retrieve recent conversations
      const recentConversationsList = await retrieveRecentConversations({
        userId: accessCode,
        limit: 5,
      });

      const pastConversationsText = recentConversationsList
        .map((convo) => {
          //@ts-ignore
          const timestamp = new Date(convo.timestamp).toISOString();
          return `[Timestamp: ${timestamp}]\n Summary: ${convo.summary || ""}\nFull Conversation: ${convo.fullConversation}`;
        })
        .join("\n\n");

      const firstConversation = `Transform the provided base template of a system prompt for a Sports Advisor
        into a personalized system prompt for an athlete's parent. Combine the base system prompt with the parent's data --
         Ensure that the personalized version prioritizes the proactive workflow and integrates all available data for the parent
         -- I need all of this information in the system - all of it - nothing left out. 
         The sports advisor is not passive, it is active - 
         The sports advisor's main objective is to go through the entire workflow stated in the base template, also personalize the initial 
         question and follow-up questions found in the conversation structure of the proactive workflow to make them more engaging and to provide a good experience
         for the parent. Be respectful. 
         When this sports advisor starts a session with the parent, the sports advisor will only be talking to one of the parents. The sports advisor will have already been given an introduction to the parent. The sports advisor 
         should respond to the parent based on the greeting that will have been provided prior (change the base template such that it understands to not repeat the greeting and just continue the conversation towards the objectives of the conversation). 
         Here's the base template: ${baseTemplateParent} -- here's the parent's child's data: parent firstname: ${info.firstName}, parent lastname: ${info.lastName}, child's data: ${formattedPlayerData} -- only provide the transformed personalized sports advisor for the user - do not say anything else`;

      const subsequentParentConversation = `
         Transform the provided base template of a system prompt for a Sports Advisor
         into a personalized system prompt for ongoing conversations with an athlete’s parents. Use the following inputs to guide your transformation:
  
         1. Base Template:
            Retain the foundational structure, persona, and communication guidelines for Kroni. Ensure the following:
            - The advisor maintains Kroni's proactive, empathetic, and structured conversational flow.
            - All instructions regarding tone, pacing, and question delivery remain consistent, while adapting to address parental concerns and perspectives.
  
         2. Parent-Specific Data:
            Use the parent-specific details, including:
            - Name and basic information about the athlete (to personalize the conversation).
            - Past conversations with the parents: Summarize key themes, unresolved questions, and insights provided by the parents.
            - Goals and progress shared by the athlete: Incorporate these into the discussion to ensure alignment with the athlete’s objectives.
  
         3. Guidance for Proactive Workflow:
            Update the "Proactive Workflow: Guiding the Conversation" section to focus on:
            - Parental Support: Provide advice on how parents can best support their child’s athletic, academic, and personal development.
            - Feedback from Parents: Encourage parents to share observations about their child’s performance, mindset, and well-being outside of training.
            - Alignment with Goals: Discuss how the family can help the athlete achieve their goals, both short- and long-term.
            - Unresolved Areas: Revisit topics from past conversations or concerns raised by the parents, ensuring continuity and progress.
  
         4. Interactive and Contextual Dialogue:
            - Ensure Kroni consistently adapts to new insights shared by the parents during the session.
            - Avoid redundant questions by referencing previous discussions.
            - Use follow-up questions to explore the parents’ perspectives and gather deeper insights.
  
         5. Customization of Topics:
            While retaining the base structure’s flow, ensure topics are tailored to the parents' role, such as:
            - Understanding the athlete’s goals and how parents can provide support.
            - Encouraging healthy habits, including nutrition, sleep, and mental well-being.
            - Discussing academic priorities alongside athletic development.
            - Exploring non-sports-related activities to ensure a balanced lifestyle.
            - Identifying challenges the athlete faces and how parents can assist in overcoming them.
  
         6. Tone and Style Consistency:
            - Maintain Kroni’s professional yet supportive tone, emphasizing empathy and encouragement.
            - Use concise, dialogue-oriented responses to keep the conversation engaging and digestible.
            - Adapt the delivery to the parents’ communication style, ensuring sensitivity when discussing concerns or challenges.
  
         7. Dynamic Adaptation:
            - Allow the Sports Advisor to adjust advice and guidance based on newly shared information from the parents.
            - Reference past conversations to reinforce consistency and trust.
            - Identify and address any changes in the athlete’s priorities or challenges as observed by the parents.
  
         8. Conversation Outcomes:
            - Each interaction should aim to achieve:
              - A deeper understanding of how the parents perceive the athlete’s progress and challenges.
              - Actionable recommendations for the parents to support their child’s goals.
              - Strengthened collaboration between the Sports Advisor, the athlete, and the parents.
              - A sense of clarity and empowerment for the parents in their role as supporters.
  
         9. Output Requirements:
            - Generate a complete system prompt for Kroni that integrates all the above components.
            - Ensure the prompt is adaptable for all ongoing parent interactions, emphasizing a personalized and evolving advisory experience.
            - The resulting prompt must prioritize:
              - Contextual relevance based on past parent conversations and the athlete’s goals.
              - Proactivity in guiding the parents to support the athlete.
              - Consistency in tone, flow, and structure across all sessions.
  
         This transformation ensures Kroni remains a reliable, context-aware, and proactive ally for the athlete’s parents, fostering a collaborative environment that supports the athlete’s success.
  
         Here is the base template ${baseTemplatePlayer} -- here's the athlete's data: player's firstname: ${info.firstName}, player's lastname: ${info.lastName}, player's sport stats: ${formattedPlayerData}
         
         -- Here are some of the recent conversations the parents have had with the Sports Advisor ${pastConversationsText}
  
         -- Here is a transcript of goals the athlete and the Sports Advisor have identified so far: ${oldGoals}
  
         -- only provide the transformed personalized sports advisor for the user - do not say anything else
         `;

      const response = await fetch("/api/transform", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content:
                existingGoalsList.length === 0
                  ? firstConversation
                  : subsequentParentConversation,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const resultPersonal = await response.json();
      setPersonalized(resultPersonal.answer);

      // Generate greeting
      const responseGreeting = await fetch("/api/avatar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Assume this prompt and look at the introduction and give me a personalized greeting for the parent based on all the information you know about them -- remember the parent's first name is ${info.firstName} and last name is ${info.lastName} -- You are only meeting with one of the parents - follow the same instructions in the prompt ${resultPersonal.answer} -- I want this greeting in this language: ${selectedLanguageLabel} -- only provide the greeting in your response - do not say anything else`,
            },
          ],
        }),
      });

      const resultGreeting = await responseGreeting.json();
      setGreet(resultGreeting.answer);
    } catch (err) {
      console.error("API call failed:", err);
    } finally {
      console.log("finally");
    }
  };

  const handleNextStep = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (user === "parent") {
      executeApiCallParent();
    } else {
      executeApiCallPlayer();
    }

    //console.log("Proceeding to the next step...");
    setShowInteractiveAvatar(true); // Show the InteractiveAvatar component
  };

  // Render the InteractiveAvatar component if the user proceeds
  if (showInteractiveAvatar) {
    return (
      <NewInteractiveAvatar
        info={info}
        user={user}
        selectedLanguage={selectedLanguage}
        accessCode={accessCode}
        personalized={personalized}
        greet={greet}
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white">
      {/* Logo */}
      <div className="flex justify-center absolute top-6">
        <Image
          src={logo}
          alt="Graet Logo"
          height={300} // Increased height for better visual impact
          width={300} // Increased width to maintain proportions
        />
      </div>

      {/* Video Section */}
      <div className="flex flex-col items-center w-full max-w-4xl px-4">
        <div className="w-full aspect-video mb-6">
          <iframe
            src={videoUrl}
            title={`GRAET AI Sport Advisor Process for ${user}`}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full rounded-md shadow-lg"
          ></iframe>
        </div>

        {/* Form Section */}
        <form onSubmit={handleNextStep} className="w-full flex justify-center">
          <button
            type="submit"
            className="px-6 py-3 text-sm font-medium text-white bg-[#2B21C1] rounded-full hover:bg-blue-700 transition"
          >
            Next step 2
          </button>
        </form>
      </div>
    </div>
  );
};

export default Welcome2;

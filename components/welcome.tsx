"use client";

import React, { useState } from "react";
import InteractiveAvatar from "./InteractiveAvatar"; // Import the InteractiveAvatar component
import Image from "next/image";
import logo from "../public/logo-1.svg"; // Replace with your actual logo
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

const Welcome: React.FC<WelcomeProps> = ({
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

      // Define a type for player stats if not already done
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

      // Explicitly cast playerData.stats to Record<string, PlayerStat>
      const statsEntries = Object.entries(playerData.stats) as [
        string,
        PlayerStat,
      ][];

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
      `;

      const response = await fetch("/api/avatar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            //{ role: "system", content: '' }, // Add the preprompt
            {
              role: "user",
              content: `Transform the provided base template of a system prompt for a Sports Advisor
             into a personalized system prompt for the athlete. Combine the base system prompt with athletes data --
              Ensure that personalized version prioritizes the proactive workflow and integrates all athlete data 
              [including all the tables with all the information in them, nothing left out] -- 
              I need all of this information in the system - all of it - nothing left out, including performance statistics,
               game logs, league standings, reports, family background, and personal interests - The sports advisor is not passive, is active - 
               The sports advisor main objective is to go through the entire workflow stated in the base template, also personalize the initial 
               question and follow up questions found in the conversation structure of the proactive workflow to make them more engaging and to provide a good experience
                for the athlete - when this sports advisor starts a session with the user - the sports advisor will have been already given a introduction to user - the sports advisor 
                should respond to the users based on the greeting that will have been provided prior - so the introduction (building rapport and trust) should just be continuing the conversation from that point and leading to the rest of the 
                conversation flow -- here's the base template: ${baseTemplatePlayer} -- here's the athletes data: ${formattedPlayerData} -- only provide the transformed personalized sports advisor for the user - do not say anything else`,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const resultPersonal = await response.json();
      //setReport(result.answer || "No report generated.");
      //console.log(resultPersonal);
      setPersonalized(resultPersonal.answer);

      // generate greeting -  now that we have the system prompt
      const responseGreeting = await fetch("/api/avatar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            //{ role: "system", content: '' }, // Add the preprompt
            {
              role: "user",
              content: `Assume this prompt and look at the introduction and give me a personalized greeting for that athlete based on all the information you know about them, follow the same instructions in the prompt ${resultPersonal.answer} -- I want this greeting in this language: ${selectedLanguageLabel} -- only provide the greeting in your response - do not say anything else`,
            },
          ],
        }),
      });

      const resultGreeting = await responseGreeting.json();
      //console.log("greeting, ", resultGreeting);
      setGreet(resultGreeting.answer);
    } catch (err) {
      console.error("API call failed:", err);
    } finally {
      console.log("finally, ");
    }
  };

  const executeApiCallParent = async () => {
    try {
      if (!playerData) {
        throw new Error("Player data is not available.");
      }

      // Define a type for player stats if not already done
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

      // Explicitly cast playerData.stats to Record<string, PlayerStat>
      const statsEntries = Object.entries(playerData.stats) as [
        string,
        PlayerStat,
      ][];

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
    `;

      const response = await fetch("/api/avatar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            //{ role: "system", content: '' }, // Add the preprompt
            {
              role: "user",
              content: `Transform the provided base template of a system prompt for a Sports Advisor
           into a personalized system prompt for an athletes parent. Combine the base system prompt with parents data --
            Ensure that personalized version prioritizes the proactive workflow and integrates all available data for the parent
            -- I need all of this information in the system - all of it - nothing left out, -- The sports advisor is not passive, is active - 
             The sports advisor main objective is to go through the entire workflow stated in the base template, also personalize the initial 
             question and follow up questions found in the conversation structure of the proactive workflow to make them more engaging and to provide a good experience
              for the parent - be respectful - when this sports advisor starts a session with the parent- The sports advisor will only be talking to one of the parents - the sports advisor will have been already given a introduction to parent - the sports advisor 
              should respond to the parents based on the greeting that will have been provided prior - so the introduction (building rapport and trust) should just be continuing the conversation from that point and leading to the rest of the 
              conversation flow -- here's the base template: ${baseTemplateParent} -- here's the parents childs data: ${formattedPlayerData} -- only provide the transformed personalized sports advisor for the user - do not say anything else`,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const resultPersonal = await response.json();
      //setReport(result.answer || "No report generated.");
      console.log(resultPersonal);
      setPersonalized(resultPersonal.answer);

      // generate greeting -  now that we have the system prompt
      const responseGreeting = await fetch("/api/avatar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            //{ role: "system", content: '' }, // Add the preprompt
            {
              role: "user",
              content: `Assume this prompt and look at the introduction and give me a personalized greeting for the parent based on all the information you know about them -- You are only meeting with one of the parents, most likely the father, follow the same instructions in the prompt ${resultPersonal.answer} -- I want this greeting in this language: ${selectedLanguageLabel} -- only provide the greeting in your response - do not say anything else`,
            },
          ],
        }),
      });

      const resultGreeting = await responseGreeting.json();
      console.log("greeting, ", resultGreeting);
      setGreet(resultGreeting.answer);
    } catch (err) {
      console.error("API call failed:", err);
    } finally {
      console.log("finally, ");
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
      <InteractiveAvatar
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
      <div className="flex justify-center mb-16">
        <Image
          src={logo}
          alt="Graet Logo"
          height={220} // Increased height for better visual impact
          width={220} // Increased width to maintain proportions
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
            className="px-6 py-3 text-sm font-medium text-white bg-[#2B21C1] rounded-md hover:bg-blue-700 transition"
          >
            Next step
          </button>
        </form>
      </div>
    </div>
  );
};

export default Welcome;

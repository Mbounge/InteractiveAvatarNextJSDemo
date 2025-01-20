"use client";

import React, { useState } from "react";
import InteractiveAvatar from "./InteractiveAvatar"; // Import the InteractiveAvatar component
import InteractiveAvatarCustom from "./interactiveAvatarCustom";
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
    
        const response = await fetch("/api/avatar", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: `Transform the provided base template of a system prompt for a Sports Advisor
                 into a personalized system prompt for the athlete. Combine the base system prompt with athlete's data --
                  Ensure that the personalized version prioritizes the proactive workflow and integrates all athlete data 
                  [including all the tables with all the information in them, nothing left out] -- 
                  Here's the base template: ${baseTemplatePlayer} -- here's the athlete's data: player's firstname: ${info.firstName}, player's lastname: ${info.lastName}, player's sport stats: ${formattedPlayerData} -- only provide the transformed personalized sports advisor for the user - do not say anything else`,
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
    
        const response = await fetch("/api/avatar", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: `Transform the provided base template of a system prompt for a Sports Advisor
                 into a personalized system prompt for an athlete's parent. Combine the base system prompt with the parent's data --
                  Ensure that the personalized version prioritizes the proactive workflow and integrates all available data for the parent
                  -- I need all of this information in the system - all of it - nothing left out. 
                  The sports advisor is not passive, it is active - 
                  The sports advisor's main objective is to go through the entire workflow stated in the base template, also personalize the initial 
                  question and follow-up questions found in the conversation structure of the proactive workflow to make them more engaging and to provide a good experience
                  for the parent. Be respectful. 
                  When this sports advisor starts a session with the parent, the sports advisor will only be talking to one of the parents. The sports advisor will have already been given an introduction to the parent. The sports advisor 
                  should respond to the parent based on the greeting that will have been provided prior (change the base template such that it understands to not repeat the greeting and just continue the conversation towards the objectives of the conversation). 
                  Here's the base template: ${baseTemplateParent} -- here's the parent's child's data: parent firstname: ${info.firstName}, parent lastname: ${info.lastName}, child's data: ${formattedPlayerData} -- only provide the transformed personalized sports advisor for the user - do not say anything else`,
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
            Next step
          </button>
        </form>
      </div>
    </div>
  );
};

export default Welcome;

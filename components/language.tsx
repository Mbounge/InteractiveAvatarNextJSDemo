"use client";

import React, { useState } from "react";
import Confidentiality from "./confident"; // Import the Confidentiality component
import Image from "next/image";
import kroni from "../public/kroni.svg"; // Replace with your actual image
import logo from "../public/logo-1.svg"; // Replace with your actual logo
import { playerDatabase } from "@/app/lib/constants"; // Import the player database

interface LanguagesProps {
  user: string;
  info: {
    firstName: string;
    lastName: string;
    email: string;
    graetLink: string;
  };
}

type PlayerDatabaseKeys = keyof typeof playerDatabase;

const Languages: React.FC<LanguagesProps> = ({ info, user }) => {
  const [selectedLanguage, setSelectedLanguage] = useState("en"); // State for selected language
  const [accessCode, setAccessCode] = useState(""); // State for access code
  const [showConfidentiality, setShowConfidentiality] = useState(false); // State to control Confidentiality view
  const [playerData, setPlayerData] = useState<any>(null); // State to store player data

  // Handles language selection
  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
  };

  // Handles input change for the access code
  const handleAccessCodeChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setAccessCode(event.target.value);
  };

  // Handles form submission
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Validation: Ensure an access code is entered
    if (!accessCode) {
      alert("Please enter your access code before proceeding.");
      return;
    }

    // Check if the access code exists in playerDatabase
    if (!Object.keys(playerDatabase).includes(accessCode)) {
      alert("Invalid access code. Please try again.");
      return;
    }

    // Fetch the corresponding player data from playerDatabase
    const selectedPlayerData = playerDatabase[accessCode as PlayerDatabaseKeys];

    // Store the selected player data in state
    setPlayerData(selectedPlayerData);

    // Proceed to the Confidentiality component
    setShowConfidentiality(true);
  };

  // Render the Confidentiality component if the user has completed the form
  if (showConfidentiality && playerData) {
    return (
      <Confidentiality
        info={info}
        user={user}
        selectedLanguage={selectedLanguage}
        accessCode={accessCode}
        playerData={playerData} // Pass the selected player data
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

      <div className="flex flex-row items-center justify-between w-full max-w-7xl">
        {/* Form Section */}
        <div className="flex flex-col w-1/2 px-12">
          {/* Language Selector */}
          <div className="mb-8">
            <p className="text-lg text-center font-semibold text-gray-700">
              Select language of Advisor
            </p>
            <div className="grid grid-cols-3 gap-4 mt-4">
              {[
                { lang: "en", label: "English 🇺🇸" },
                { lang: "fr", label: "French 🇫🇷" },
                { lang: "cs", label: "Czech 🇨🇿" },
                { lang: "sv", label: "Swedish 🇸🇪" },
                { lang: "sk", label: "Slovak 🇸🇰" },
                { lang: "fi", label: "Finnish 🇫🇮" },
              ].map(({ lang, label }) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => handleLanguageChange(lang)}
                  className={`w-full py-3 rounded-lg text-md font-medium transition ${
                    selectedLanguage === lang
                      ? "bg-[#2B21C1] text-white"
                      : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="hidden"
              name="selected_language"
              value={selectedLanguage}
            />
          </div>

          {/* Access Code Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-lg font-semibold text-gray-700">
              Type your access code
            </p>
            <input
              type="text"
              className="w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-blue-600 focus:outline-none"
              id="access-code"
              name="access_code"
              placeholder="Access code"
              value={accessCode}
              onChange={handleAccessCodeChange}
              required
            />
            <p className="text-xs text-gray-500">
              Don't have an access code? Email me at{" "}
              <a
                href="mailto:kroni@graet.com"
                className="text-blue-600 underline"
              >
                kroni@graet.com
              </a>
            </p>
            <button
              type="submit"
              className="w-full py-3 text-sm font-medium text-white bg-[#2B21C1] rounded-md hover:bg-blue-700 transition"
            >
              Submit
            </button>
          </form>
        </div>

        {/* Right Image Section */}
        <div className="flex flex-col items-center justify-center w-1/2">
          <Image src={kroni} alt="Kroni" height={450} width={450} />
        </div>
      </div>
    </div>
  );
};

export default Languages;



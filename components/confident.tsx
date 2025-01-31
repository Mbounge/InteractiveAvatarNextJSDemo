"use client";

import React, { useState } from "react";
import Image from "next/image";
import Welcome from "./welcome";
import Welcome2 from "./welcome2";
import warning from '../public/warning1.svg'
import logo from "../public/GraetAI.svg"; 

interface ConfidentialityProps {
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

const Confidentiality: React.FC<ConfidentialityProps> = ({info, user, selectedLanguage, accessCode, playerData }) => {
  const [showWelcome, setShowWelcome] = useState(false); // State to control Welcome view

  const handleAgree = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    //console.log("User agreed to the terms and continued.");
    setShowWelcome(true); // Show the Welcome component
  };

  // Render the Welcome component if the user agrees to the terms
  if (showWelcome) {
    return accessCode === 'kroni' ? <Welcome2 info={info} user={user} selectedLanguage={selectedLanguage} accessCode={accessCode} playerData={playerData} /> : <Welcome info={info} user={user} selectedLanguage={selectedLanguage} accessCode={accessCode} playerData={playerData} />;
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

      <div className="flex flex-row items-center justify-between w-full max-w-7xl">
        {/* Content Section */}
        <div className="flex flex-col w-1/2 px-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            Read before you continue
          </h2>

          <div className="space-y-6">
            <p className="text-base text-gray-700">
              By using this demo, you confirm your understanding and agreement
              to the following terms:
            </p>

            <div className="space-y-4">
              <div>
                <strong className="text-gray-800">Confidentiality:</strong>
                <p className="text-gray-700">
                  All information, features, and content shared during this demo
                  are confidential and must not be shared with any third parties
                  without prior written consent.
                </p>
              </div>

              <div>
                <strong className="text-gray-800">No Recordings:</strong>
                <p className="text-gray-700">
                  You are prohibited from making any form of recording,
                  including screenshots, videos, or audio, of this demo.
                </p>
              </div>

              <div>
                <strong className="text-gray-800">Agreement to Terms:</strong>
                <p className="text-gray-700">
                  By proceeding, you agree to comply with these conditions. Any
                  breach of this agreement will result in appropriate legal
                  action.
                </p>
              </div>
            </div>

            <form onSubmit={handleAgree} className="mt-6">
              <button
                type="submit"
                className="w-full py-3 text-sm font-medium text-white bg-[#2B21C1] rounded-full hover:bg-blue-700 transition"
              >
                Agree and continue
              </button>
            </form>
          </div>
        </div>

        {/* Right Image Section */}
        <div className="flex flex-col items-center justify-center w-1/2">
          <Image
            src={warning}
            alt="warning"
            height={450}
            width={450}
          />
        </div>
      </div>
    </div>
  );
};

export default Confidentiality;


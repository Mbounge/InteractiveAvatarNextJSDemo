"use client";

import React, { useCallback, useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useConversation } from "@11labs/react";
import logo from "../public/GraetAI.svg";
import kroni from "../public/kroni.svg";
import { Button, Spinner } from "@nextui-org/react"; // Import NextUI Button and Spinner


import { STT_LANGUAGE_LIST } from "@/app/lib/constants";

interface InteractiveProps {
  info: {
    firstName: string;
    lastName: string;
    email: string;
    graetLink: string;
  };
  user: string;
  selectedLanguage: string;
  accessCode: string;
  personalized?: string;
  greet?: string;        
}

export default function Conversation({
  info,
  user,
  selectedLanguage,
  accessCode,
  personalized = "", // Default to an empty string if undefined
  greet = "",        // Default to an empty string if undefined
}: InteractiveProps) {
  // Provide safe versions of personalized and greet
  const safePersonalized = personalized ?? "";
  const safeGreet = greet ?? "";

  // Check if both personalized and greet are provided.
  const isReady = safePersonalized.trim() !== "" && safeGreet.trim() !== "";

  const selectedLanguageLabel =
    STT_LANGUAGE_LIST.find((language) => language.value === selectedLanguage)
      ?.label || "en";


  console.log(selectedLanguage)
  // console.log(personalized)
  // console.log(greet)

  // Track connection status and speaking state in local React state.
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Timer state.
  const [timer, setTimer] = useState(600); // 10 minutes in seconds.
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Setup ElevenLabs conversation.
  const conversation = useConversation({
    onConnect: () => {
      console.log("Connected");
      setIsConnected(true);
      setIsStarting(false);
    },
    onDisconnect: () => {
      console.log("Disconnected");
      setIsConnected(false);
      setIsSpeaking(false);
    },
    onMessage: (message) => {
      console.log("Message:", message);
      // You can add logic here if your message payload includes speaking indicators.
    },
    onError: (error) => {
      console.error("Error:", error);
      setIsStarting(false);
    },
  });

  // Start the conversation session.
  const startConversation = useCallback(async () => {
    // Do not start if the component is not ready.
    if (!isReady) return;
    try {
      setIsStarting(true);

      // Request microphone permission.
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Start the conversation with your agent ID and personalized settings.
      await conversation.startSession({
        agentId: "itIMQj7wiFSym71cSzpw", // Replace with your own agent ID.
        overrides: {
          agent: {
            prompt: {
              prompt:
                safePersonalized.trim() !== ""
                  ? safePersonalized
                  : "You are a helpful assistant. Your name is Kroni",
            },
            firstMessage:
              safeGreet.trim() !== ""
                ? safeGreet
                : "Hi, how can I help you today?",
            //@ts-ignore
            language: selectedLanguage
          },
          
        },
      });
    } catch (error) {
      console.error("Failed to start conversation:", error);
      setIsStarting(false);
    }
  }, [conversation, safePersonalized, safeGreet, isReady]);

  // End the conversation session.
  const stopConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  // Define handleEndSession for use with the timer and button.
  const handleEndSession = useCallback(async () => {
    await stopConversation();
  }, [stopConversation]);

  // Format timer in MM:SS.
  const formatTimer = (seconds: number) => {
    const mm = Math.floor(seconds / 60);
    const ss = seconds % 60;
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  };

  // Effect to handle the timer countdown when connected.
  useEffect(() => {
    if (isConnected) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev > 0) return prev - 1;
          // When time's up, end the session.
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          handleEndSession();
          return 0;
        });
      }, 1000);
    }
    // Cleanup: clear the timer when the session ends or component unmounts.
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isConnected, handleEndSession]);

  // Reset timer when the session ends.
  useEffect(() => {
    if (!isConnected) {
      setTimer(600); // Reset to 10 minutes.
    }
  }, [isConnected]);

  return (
    <div className="w-full min-h-screen flex flex-col bg-white">
      {/* Header / Logo */}
      <div className="w-full flex justify-center py-6">
        <Image src={logo} alt="Graet Logo" height={300} width={300} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center w-full px-4">
        <div className="w-full max-w-4xl flex flex-col items-center gap-6">
          {/* Show Kroni Avatar when not connected */}
          {!isConnected && !isStarting && (
            <Image src={kroni} alt="Kroni Avatar" height={350} width={350} />
          )}

          {/* If not connected, show start button or loading indicator */}
          {!isConnected ? (
            <div className="flex flex-col items-center gap-6">
              {isStarting ? (
                <div className="text-gray-500 text-sm">Connecting...</div>
              ) : !isReady ? (
                <div className="flex flex-col items-center gap-4">
                  <Spinner color="default" size="lg" />
                  <p className="text-gray-600 text-sm font-medium">
                    Preparing the avatar for your session...
                  </p>
                </div>
              ) : (
                <button
                  onClick={startConversation}
                  disabled={isStarting}
                  className="
                    bg-gradient-to-tr from-blue-700 to-blue-300
                    text-white py-4 px-8 rounded-lg 
                    flex items-center justify-center gap-2 shadow-lg 
                    hover:scale-105 transform transition
                  "
                >
                  {/* Plus icon */}
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4.5v15m7.5-7.5h-15"
                    />
                  </svg>
                  Start Conversation
                </button>
              )}
            </div>
          ) : (
            // If connected, show status.
            <div className="flex flex-col items-center gap-6">
              <div className="h-32 w-full flex flex-col justify-center items-center">
                <p className="text-gray-700 font-semibold">
                  Status: {isConnected ? "Connected" : "Disconnected"}
                </p>
                <p className="text-gray-600">
                  Agent is {isSpeaking ? "speaking" : "listening"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Timer and End Session Button */}
        {isConnected && (
          <div className="w-full max-w-4xl px-6 mt-6">
            <div className="flex justify-between items-center">
              <div className="text-left font-semibold text-gray-700">
                Session Duration: {formatTimer(timer)}
              </div>
              <Button
                className="bg-gradient-to-tr from-blue-700 to-blue-300 text-white py-2 px-6 rounded-lg hover:bg-blue-800 transition"
                size="md"
                onClick={handleEndSession}
              >
                End Session
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



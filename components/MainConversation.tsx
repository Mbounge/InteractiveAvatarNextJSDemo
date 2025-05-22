// components/MainConversation.tsx
'use client';

import React, { useCallback, useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useConversation } from '@11labs/react';
import { Button, Spinner } from '@nextui-org/react';

import logo from '../public/GraetAI.svg'; // Assuming same logo path
import kroni from '../public/kroni.svg';   // Assuming same avatar path

type AppSpeakerRole = 'user' | 'ai' | 'system_event';

export interface AppTranscriptMessage { // Ensure this is exported if used by parent
  speaker: AppSpeakerRole;
  text: string;
  timestamp: Date;
}

interface SdkMessage {
  message: string;
  source: 'user' | 'ai';
}

interface MainConversationProps { // Changed prop name for clarity
  systemPromptWithTranscripts: string; // Changed prop name
  greeting: string;
  language?: string;
  onChatEnd: (transcript: AppTranscriptMessage[]) => void;
}

const GRAET_BLUE = '#0e0c66';

export default function MainConversation({ // Changed component name
  systemPromptWithTranscripts: personalizedPrompt, // Renamed prop for consistency
  greeting,
  language = 'en',
  onChatEnd,
}: MainConversationProps) { // Changed prop type name
  const [isConnected, setIsConnected] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  
  const sessionEndInitiatedRef = useRef(false); 
  const startAttemptedRef = useRef(false);

  const [timer, setTimer] = useState(900); // Main sessions might be longer, e.g., 15 minutes
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [transcript, setTranscript] = useState<AppTranscriptMessage[]>([]);
  const transcriptRef = useRef<AppTranscriptMessage[]>([]); // Ref to hold the latest transcript

  // Update the ref whenever the transcript state changes
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const isReadyToStart = personalizedPrompt.trim() !== "" && greeting.trim() !== "";

  const handleActualSessionEnd = useCallback((reason: string) => {
    if (!sessionEndInitiatedRef.current) {
      console.warn(`MainConversation: handleActualSessionEnd called (reason: ${reason}) but sessionEndInitiatedRef was false. This might be an unexpected path.`);
      sessionEndInitiatedRef.current = true;
    }

    // Use the ref here to get the LATEST transcript
    const currentTranscript = transcriptRef.current; 
    console.log(`MainConversation: handleActualSessionEnd (reason: ${reason}) - Calling onChatEnd with transcript:`, currentTranscript);
    
    const lastMessage = currentTranscript[currentTranscript.length - 1];
    let finalTranscript = currentTranscript;

    const endMessageText = `Session ended: ${reason}.`;
    if (currentTranscript.length === 0 || !lastMessage || !(lastMessage.speaker === 'system_event' && lastMessage.text.includes('Session ended'))) {
        finalTranscript = [...currentTranscript, { speaker: 'system_event' as AppSpeakerRole, text: endMessageText, timestamp: new Date() }];
    }
    
    onChatEnd(finalTranscript);
  }, [onChatEnd]);


  const conversation = useConversation({
    onConnect: () => {
      console.log("MainConversation: Connected");
      setIsConnected(true);
      setIsStartingSession(false);
      sessionEndInitiatedRef.current = false; 
      startAttemptedRef.current = true;
      setTranscript(prev => [{ speaker: 'system_event' as AppSpeakerRole, text: 'Session connected.', timestamp: new Date() }]);
    },
    onDisconnect: () => {
      console.log("MainConversation: Disconnected. sessionEndInitiatedRef.current:", sessionEndInitiatedRef.current, "startAttemptedRef.current:", startAttemptedRef.current);
      setIsConnected(false);
      setIsAgentSpeaking(false);
      setIsStartingSession(false);

      if (sessionEndInitiatedRef.current) {
        handleActualSessionEnd("intentional disconnect");
      } else if (startAttemptedRef.current) { 
        console.warn("MainConversation: Unexpected disconnect after successful connection.");
        sessionEndInitiatedRef.current = true;
        handleActualSessionEnd("unexpected disconnect");
      }
    },
    onMessage: (sdkMsg: SdkMessage) => { 
      console.log("MainConversation SDK Message:", sdkMsg);
      if (sdkMsg.message && sdkMsg.message.trim() !== '') {
        const newMessage: AppTranscriptMessage = { 
          speaker: sdkMsg.source,
          text: sdkMsg.message, 
          timestamp: new Date() 
        };
        setTranscript(prev => {
          const updated = [...prev, newMessage];
          console.log("MainConversation Transcript state is being updated to:", updated);
          return updated;
        });
      }
      if (sdkMsg.source === 'ai') {
        setIsAgentSpeaking(true);
        setTimeout(() => setIsAgentSpeaking(false), 2500);
      } else if (sdkMsg.source === 'user') {
        setIsAgentSpeaking(false);
      }
    },
    onError: (errorMessage: string, context?: any) => {
      console.error("MainConversation: Error:", errorMessage, context);
      setIsConnected(false);
      setIsStartingSession(false);
      if (!sessionEndInitiatedRef.current) {
        sessionEndInitiatedRef.current = true;
        setTranscript(prev => [...prev, { speaker: 'system_event' as AppSpeakerRole, text: `Error: ${errorMessage}`, timestamp: new Date() }]);
        handleActualSessionEnd(`error: ${errorMessage}`);
      }
    },
  });

  const startChatSession = useCallback(async () => {
    if (!isReadyToStart || isStartingSession || isConnected || sessionEndInitiatedRef.current) {
        console.log("MainConversation: Start condition not met. Ready:", isReadyToStart, "Starting:", isStartingSession, "Connected:", isConnected, "EndInitiated:", sessionEndInitiatedRef.current);
        if (isStartingSession) console.warn("MainConversation: Attempted to start while already starting.");
        return;
    }
    console.log("MainConversation: Attempting to start chat session...");
    setIsStartingSession(true);
    sessionEndInitiatedRef.current = false; 
    startAttemptedRef.current = false; 
    setTranscript([]); 

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({ 
        agentId: "zvpmic1VqdKVwX1H0W3T", // Ensure this is the correct agent for main sessions too
        dynamicVariables: {
            "greeting": greeting,
            "system_prompt": personalizedPrompt // This now includes appended transcripts
        },
        overrides: { 
          agent: {
            //@ts-ignore
            language: language 
          },
        },
      });
    } catch (error: any) {
      console.error("MainConversation: Failed to start session:", error);
      setIsStartingSession(false); 
      if (!sessionEndInitiatedRef.current) { 
        sessionEndInitiatedRef.current = true;
        const startErrorMsg = error instanceof Error ? error.message : String(error);
        const errorTranscript: AppTranscriptMessage[] = [{ speaker: 'system_event' as AppSpeakerRole, text: `Failed to start session: ${startErrorMsg}`, timestamp: new Date() }];
        setTranscript(errorTranscript); 
        onChatEnd(errorTranscript); 
      }
    }
  }, [isReadyToStart, isStartingSession, isConnected, conversation, personalizedPrompt, greeting, language, onChatEnd]);

  const endChatSession = useCallback(async () => {
    if (sessionEndInitiatedRef.current) {
      console.log("MainConversation: endChatSession called, but session end already initiated. Skipping.");
      return;
    }
    console.log("MainConversation: endChatSession called. isConnected:", isConnected);
    sessionEndInitiatedRef.current = true;

    if (isConnected) {
        console.log("MainConversation: Attempting to call conversation.endSession()");
        await conversation.endSession(); 
    } else {
        console.log("MainConversation: Not connected, calling handleActualSessionEnd directly from endChatSession.");
        handleActualSessionEnd("manual end while not connected");
    }
  }, [isConnected, conversation, handleActualSessionEnd]);

  useEffect(() => {
    if (isConnected && !sessionEndInitiatedRef.current) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev > 0) return prev - 1;
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          console.log("MainConversation: Timer ended, calling endChatSession.");
          endChatSession();
          return 0;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isConnected, endChatSession]);

  useEffect(() => {
    if (!isConnected || sessionEndInitiatedRef.current) {
      setTimer(900); // Reset to main session timer length
    }
  }, [isConnected, sessionEndInitiatedRef.current]);

  const formatTimer = (seconds: number) => {
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  };

  return (
    <div className="w-full min-h-screen flex flex-col bg-white items-center justify-center p-4">
      <div className="absolute top-6 left-1/2 -translate-x-1/2">
        <Image src={logo} alt="Graet Logo" width={150} height={37.5} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg">
        {!isConnected && !isStartingSession && (
          <div className="text-center mb-8">
            <Image src={kroni} alt="Blue Avatar" width={200} height={200} className="mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-700">Ready for Main Chat?</h2>
            <p className="text-gray-500">Blue is waiting to start the main session.</p>
          </div>
        )}

        {isStartingSession && (
          <div className="flex flex-col items-center gap-4 my-8">
            <Spinner color="default" size="lg" />
            <p className="text-gray-600 text-sm font-medium">Connecting to Blue...</p>
          </div>
        )}

        {!isReadyToStart && !isStartingSession && !isConnected && (
           <div className="flex flex-col items-center gap-4 my-8 p-6 bg-yellow-50 border border-yellow-300 rounded-lg text-center">
            <Spinner color="default" size="lg" />
            <p className="text-yellow-700 font-semibold">Preparing Session</p>
            <p className="text-yellow-600 text-sm">
              Please wait while we set up your personalized chat with Blue.
            </p>
          </div>
        )}

        {isReadyToStart && !isConnected && !isStartingSession && (
          <button
            onClick={startChatSession}
            className={`
              bg-[${GRAET_BLUE}] hover:brightness-110 
              text-white py-3 px-8 rounded-lg text-lg
              flex items-center justify-center gap-2 shadow-md 
              transform transition-all focus:outline-none focus:ring-2 focus:ring-[${GRAET_BLUE}] focus:ring-offset-2
            `}
          >
            Start Main Chat with Blue
          </button>
        )}

        {isConnected && (
          <div className="w-full text-center my-8">
            <div className="h-40 w-40 bg-gray-200 rounded-full mx-auto flex items-center justify-center mb-4 animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={GRAET_BLUE} className="w-16 h-16">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </div>
            <p className="text-lg font-medium text-gray-700">
              Chatting with Blue...
            </p>
            <p className="text-sm text-gray-500">
              {isAgentSpeaking ? "Blue is speaking" : (isConnected ? "Blue is listening" : "Connecting...")}
            </p>
          </div>
        )}
      </div>

      {isConnected && (
        <div className="w-full max-w-lg fixed bottom-0 left-1/2 -translate-x-1/2 bg-white p-4 border-t border-gray-200 shadow-up">
          <div className="flex justify-between items-center">
            <div className="text-sm font-semibold text-gray-700">
              Time: {formatTimer(timer)}
            </div>
            <Button
              className={`bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg transition-all text-sm`}
              size="md"
              onClick={endChatSession}
              disabled={sessionEndInitiatedRef.current && !isConnected}
            >
              End Chat
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
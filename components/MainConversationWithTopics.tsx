// components/MainConversationWithTopics.tsx
'use client';

import React, { useCallback, useState, useEffect, useRef } from 'react';
import Image from 'next/image';
// Import Language type from the SDK to fix the error
import { useConversation, Language } from '@elevenlabs/react';
import { Button, Spinner } from '@nextui-org/react';
import { Trophy, Zap } from 'lucide-react';

import logo from '../public/GraetAI.svg';
import kroni from '../public/kroni.svg';

type AppSpeakerRole = 'user' | 'ai' | 'system_event';
export interface AppTranscriptMessage {
  speaker: AppSpeakerRole;
  text: string;
  timestamp: Date;
}
interface SdkMessage {
  message: string;
  source: 'user' | 'ai';
}

interface MainConversationProps {
  systemPromptWithTranscripts: string;
  greeting: string;
  // Use the specific 'Language' type from the SDK
  language?: Language;
  onChatEnd: (transcript: AppTranscriptMessage[]) => void;
}

const GRAET_BLUE = '#0e0c66';

export default function MainConversationWithTopics({
  systemPromptWithTranscripts: personalizedPrompt,
  greeting,
  language = 'en',
  onChatEnd,
}: MainConversationProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const sessionEndInitiatedRef = useRef(false);
  const startAttemptedRef = useRef(false);
  const [timer, setTimer] = useState(900);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [transcript, setTranscript] = useState<AppTranscriptMessage[]>([]);
  const transcriptRef = useRef<AppTranscriptMessage[]>([]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const isReadyToStart = personalizedPrompt.trim() !== "" && greeting.trim() !== "";

  const conversation = useConversation({
    onConnect: () => {
      console.log("Connected");
      setIsConnected(true);
      setIsStartingSession(false);
      sessionEndInitiatedRef.current = false;
      startAttemptedRef.current = true;
      setTranscript(prev => [{ speaker: 'system_event', text: 'Session connected.', timestamp: new Date() }]);
    },
    onDisconnect: () => {
      console.log("Disconnected");
      setIsConnected(false);
      setIsAgentSpeaking(false);
      setIsStartingSession(false);
      if (sessionEndInitiatedRef.current) {
        handleActualSessionEnd("intentional disconnect");
      } else if (startAttemptedRef.current) {
        sessionEndInitiatedRef.current = true;
        handleActualSessionEnd("unexpected disconnect");
      }
    },
    onMessage: (sdkMsg: SdkMessage) => {
      if (sdkMsg.message && sdkMsg.message.trim() !== '') {
        const newMessage: AppTranscriptMessage = {
          speaker: sdkMsg.source,
          text: sdkMsg.message,
          timestamp: new Date()
        };
        setTranscript(prev => [...prev, newMessage]);
      }
      // Reverting to the original, simple logic for speaking detection
      setIsAgentSpeaking(sdkMsg.source === 'ai');
    },
    onError: (errorMessage: string) => {
      console.error("Error:", errorMessage);
      if (!sessionEndInitiatedRef.current) {
        sessionEndInitiatedRef.current = true;
        setTranscript(prev => [...prev, { speaker: 'system_event', text: `Error: ${errorMessage}`, timestamp: new Date() }]);
        handleActualSessionEnd(`error: ${errorMessage}`);
      }
    },
  });

  const handleTopicClick = (topicPrompt: string) => {
    if (isConnected && conversation.sendUserMessage) {
      conversation.sendUserMessage(topicPrompt);
    } else {
      console.warn("Cannot send topic message: not connected or function unavailable.");
    }
  };

  const handleActualSessionEnd = useCallback((reason: string) => {
    if (sessionEndInitiatedRef.current) return;
    sessionEndInitiatedRef.current = true;
    
    const currentTranscript = transcriptRef.current;
    const endMessageText = `Session ended: ${reason}.`;
    
    const lastMessage = currentTranscript[currentTranscript.length - 1];
    let finalTranscript = currentTranscript;
    if (!lastMessage || !(lastMessage.speaker === 'system_event' && lastMessage.text.includes('Session ended'))) {
        finalTranscript = [...currentTranscript, { speaker: 'system_event' as AppSpeakerRole, text: endMessageText, timestamp: new Date() }];
    }
    
    onChatEnd(finalTranscript);
  }, [onChatEnd]);

  const startChatSession = useCallback(async () => {
    if (!isReadyToStart || isStartingSession || isConnected) return;
    setIsStartingSession(true);
    sessionEndInitiatedRef.current = false;
    startAttemptedRef.current = false;
    setTranscript([]);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({
        agentId: "zvpmic1VqdKVwX1H0W3T",
        dynamicVariables: { "greeting": greeting, "system_prompt": personalizedPrompt },
        // This is now type-safe and correct
        overrides: { agent: { language: language } },
      });
    } catch (error: any) {
      console.error("Failed to start session:", error);
      setIsStartingSession(false);
      if (!sessionEndInitiatedRef.current) {
        sessionEndInitiatedRef.current = true;
        const errorMsg = error instanceof Error ? error.message : String(error);
        onChatEnd([{ speaker: 'system_event', text: `Failed to start session: ${errorMsg}`, timestamp: new Date() }]);
      }
    }
  }, [isReadyToStart, isStartingSession, isConnected, conversation, personalizedPrompt, greeting, language, onChatEnd]);

  const endChatSession = useCallback(async () => {
    if (sessionEndInitiatedRef.current) return;
    sessionEndInitiatedRef.current = true;
    if (isConnected) {
      await conversation.endSession();
    } else {
      handleActualSessionEnd("manual end while not connected");
    }
  }, [isConnected, conversation, handleActualSessionEnd]);

  useEffect(() => {
    if (isConnected && !sessionEndInitiatedRef.current) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev > 1) return prev - 1;
          if (timerRef.current) clearInterval(timerRef.current);
          endChatSession();
          return 0;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isConnected, endChatSession]);

  const formatTimer = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="w-full min-h-screen flex flex-col bg-white items-center justify-center p-4">
      <div className="absolute top-6 left-1/2 -translate-x-1/2">
        <Image src={logo} alt="Graet Logo" width={150} height={37.5} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg">
        {!isReadyToStart && !isConnected && !isStartingSession && (
            <div className="text-center mb-8">
                <Spinner label="Preparing your session..." color="default" size="lg" />
            </div>
        )}
        {isReadyToStart && !isConnected && !isStartingSession && (
          <div className="text-center mb-8">
            <Image src={kroni} alt="Blue Avatar" width={200} height={200} className="mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-700">Ready to Chat?</h2>
            <p className="text-gray-500">Blue is waiting to start the session.</p>
            <Button onClick={startChatSession} className={`mt-6 bg-[${GRAET_BLUE}] text-white`} size="lg">
              Start Chat with Blue
            </Button>
          </div>
        )}
        {isStartingSession && <Spinner label="Connecting to Blue..." color="default" size="lg" />}
        {isConnected && (
          <div className="w-full text-center my-8">
            <div className={`h-40 w-40 bg-gray-200 rounded-full mx-auto flex items-center justify-center mb-4 ${isAgentSpeaking ? 'animate-pulse' : ''}`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={GRAET_BLUE} className="w-16 h-16"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>
            </div>
            <p className="text-lg font-medium text-gray-700">Chatting with Blue...</p>
            <p className="text-sm text-gray-500">{isAgentSpeaking ? "Blue is speaking" : "Blue is listening"}</p>
          </div>
        )}
      </div>

      {isConnected && (
        <div className="w-full max-w-lg fixed bottom-0 left-1/2 -translate-x-1/2 bg-white p-4 border-t border-gray-200 shadow-up space-y-4">
          <div className="p-3 bg-gray-50 rounded-xl border border-dashed">
            <p className="text-sm font-semibold text-gray-600 mb-3 text-center">
              Not sure what to ask? Try a topic:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                variant="ghost"
                color="secondary"
                startContent={<Trophy size={18} />}
                onPress={() => handleTopicClick("Let's talk about the NHL.")}
              >
                Talk about NHL
              </Button>
              <Button
                variant="ghost"
                color="secondary"
                startContent={<Zap size={18} />}
                onPress={() => handleTopicClick("What are the best training routines for hockey?")}
              >
                Best Training Routines
              </Button>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <div className="text-sm font-semibold text-gray-700">
              Time: {formatTimer(timer)}
            </div>
            <Button
              color="danger"
              variant="flat"
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
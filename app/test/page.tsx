// app/test/page.tsx
'use client';

import React, { useState } from 'react';
import { LogoHeader } from '@/components/LogoHeader';
// Import the new component
import MainConversationWithTopics, { AppTranscriptMessage } from '@/components/MainConversationWithTopics';
import { Button as NextUIButton } from '@nextui-org/react';
import { RefreshCw } from 'lucide-react';

// --- Hardcoded Prompt for the Test Page ---
// This prompt is designed to work well with the topic buttons.
const TEST_SYSTEM_PROMPT = `You are Blue, a friendly and knowledgeable AI advisor specializing in hockey. Your goal is to have a helpful conversation with the user. You can discuss specific topics like the NHL or general advice like training routines. Be engaging and ready to answer questions based on user voice input or topic button clicks.`;

const TEST_GREETING = `Hello! I'm Blue, your AI hockey advisor. We can talk about anything you like. What's on your mind? Or, feel free to pick one of the topics below.`;

/**
 * TestPage for experimenting with the MainConversationWithTopics component.
 * It loads directly into a single chat session that includes clickable topic buttons.
 */
export default function TestPage() {
  // State to track if the chat is active or has ended.
  const [isChatActive, setIsChatActive] = useState(true);

  // State to store the final transcript for review.
  const [finalTranscript, setFinalTranscript] = useState<AppTranscriptMessage[] | null>(null);

  /**
   * Callback function passed to the MainConversationWithTopics component.
   * It's called when the chat session ends.
   */
  const handleChatEnded = (transcript: AppTranscriptMessage[]) => {
    console.log("TestPage: Chat has ended. Final transcript:", transcript);
    setFinalTranscript(transcript);
    setIsChatActive(false); // Switch to the "session ended" view.
  };

  /**
   * Resets the state to allow the user to start a new test session.
   */
  const handleRestartSession = () => {
    setFinalTranscript(null);
    setIsChatActive(true);
  };

  // --- Conditional Rendering ---

  if (isChatActive) {
    // If the chat is active, render the MainConversationWithTopics component.
    return (
      <MainConversationWithTopics
        // Use a unique key to ensure the component fully re-mounts on restart.
        key={Date.now()} 
        systemPromptWithTranscripts={TEST_SYSTEM_PROMPT}
        greeting={TEST_GREETING}
        onChatEnd={handleChatEnded}
        // The language prop is optional and defaults to 'en' in the component.
        // language="en-US" 
      />
    );
  }

  // If the chat is not active, render the "session ended" screen.
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-100 to-white px-4 py-10">
      <div className="w-full max-w-2xl text-center">
        <LogoHeader />
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mt-8">
          Test Session Ended
        </h1>
        <p className="text-lg text-gray-600 mt-4 mb-8">
          You have completed the test conversation with Blue.
        </p>

        <NextUIButton
          size="lg"
          color="primary"
          className="bg-[#0e0c66] text-white font-semibold"
          onPress={handleRestartSession}
          startContent={<RefreshCw size={20} />}
        >
          Start New Test Session
        </NextUIButton>

        {/* Optional: Display the final transcript for debugging */}
        {finalTranscript && finalTranscript.length > 1 && (
          <div className="mt-10 text-left text-xs text-gray-700 bg-gray-50 p-4 border border-dashed rounded-lg max-h-96 overflow-y-auto">
            <h4 className="font-semibold text-sm mb-2">Final Transcript:</h4>
            <ul className="space-y-2">
              {finalTranscript.map((msg, index) => (
                <li key={index} className={`p-2 rounded-md ${msg.speaker === 'ai' ? 'bg-blue-50' : msg.speaker === 'user' ? 'bg-green-50' : 'bg-gray-100'}`}>
                  <strong className="capitalize">{msg.speaker}: </strong>{msg.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
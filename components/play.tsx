"use client";

import { useState, useRef } from "react";
import {
  type AgentConnectionController,
} from "@play-ai/agent-web-sdk";

export default function Play() {
  const [agentId, setAgentId] = useState("Advisor-NHvoHCmn1oLS61LAznD7b");
  const [output, setOutput] = useState([""]);
  const [isCallAgentDisabled, setIsCallAgentDisabled] = useState(false);
  const [isDisconnectDisabled, setIsDisconnectDisabled] = useState(true);
  const [isMutted, setIsMutted] = useState(false);
  const agentControllerRef = useRef<AgentConnectionController | null>(null);

  async function connect() {
    try {
        if (typeof window === "undefined") {
            console.error("connectAgent cannot run on the server.");
            return;
          }
      toggleEnabledButtons();
      log("\nConnecting to AGENT...");
      const { connectAgent } = await import('@play-ai/agent-web-sdk'); // For when using as external dependency
      const agentController = await connectAgent(agentId, {
        debug: true, // Enable debug logging in the console
        customGreeting: "Hello, and welcome to my custom agent!", // Override the default greeting
        prompt: "You are an AI that helps with scheduling tasks.", // Append additional instructions to the agent's prompt
        listeners: {
          onUserTranscript: (transcript: any) =>
            log(`USER said: "${transcript}".`),
          onAgentTranscript: (transcript: any) =>
            log(`AGENT will say: "${transcript}".`),
          onUserStartedSpeaking: () => log(`USER started speaking...`),
          onUserStoppedSpeaking: () => log(`USER stopped speaking.`),
          onAgentDecidedToSpeak: () =>
            log(`AGENT decided to speak... (not speaking yet, just thinking)`),
          onAgentStartedSpeaking: () => log(`AGENT started speaking...`),
          onAgentStoppedSpeaking: () => log(`AGENT stopped speaking.`),
          onHangup: (endedBy: any) => {
            log(`Conversation has ended by ${endedBy.toUpperCase()}\n`);
            agentControllerRef.current = null;
            toggleEnabledButtons();
          },
          onError: (err: any) =>
            log(`ERROR during conversation: ${JSON.stringify(err)}`),
        },
      });
      agentControllerRef.current = agentController;
      log(`Connected to AGENT ${agentId}.`);
      log(`Conversation started with ID: ${agentController.conversationId}.`);
    } catch (error) {
      toggleEnabledButtons();
      log(`ERROR on connecting: ${error}`);
    }
  }

  function toggleEnabledButtons() {
    setIsCallAgentDisabled((prev) => !prev);
    setIsDisconnectDisabled((prev) => !prev);
  }

  function toggleMute() {
    setIsMutted((prev) => {
      if (prev) agentControllerRef.current?.unmute();
      else agentControllerRef.current?.mute();
      return !prev;
    });
  }

  function log(message: string) {
    setOutput((prevOutput) => [...prevOutput, message]);
    console.log(message);
  }

  return (
    <div>
      <h1>Play.ai Web SDK Demo</h1>
      {`Add the agent ID below and click "Connect agent" button to start a conversation with the agent.`}
      <br />
      <br />
      <div>
        <button
          className="flex"
          onClick={connect}
          disabled={isCallAgentDisabled}
        >
          Connect agent
        </button>
        <button
          className="flex"
          onClick={agentControllerRef.current?.hangup}
          disabled={isDisconnectDisabled}
        >
          Disconnect
        </button>
        <button onClick={toggleMute}>{isMutted ? "Unmute" : "Mute"}</button>
      </div>
      <hr />
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import logo from "../public/GraetAI.svg";
import { ConvoFunc } from "@/app/action3";

const ChatInterface: React.FC = () => {

  const [conversationHistory, setConversationHistory] = useState<any[]>([
    { role: "system", content: "You are an Assistant." },
  ]); // Full history for the model

  const [displayMessages, setDisplayMessages] = useState<any[]>([
    { role: "system", content: "You are an Assistant." },
  ]); // Filtered for UI
  const [input, setInput] = useState("");

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input };
    const updatedHistory = [...conversationHistory, userMessage];

    // Update both conversation history (for the model) and UI display
    setConversationHistory(updatedHistory);
    setDisplayMessages((prev) => [...prev, userMessage]);

    setInput("");

    try {
      const { messages: updatedMessages, finalResponse } =
        await ConvoFunc(updatedHistory);

      // Update the full conversation history with all messages
      setConversationHistory(updatedMessages);

      // Update the UI display (filter only user and assistant final messages)
      const uiMessages = updatedMessages.filter(
        (msg: any) =>
          msg.role === "system" || // Keep system prompt
          msg.role === "user" || // Keep user messages
          (msg.role === "assistant" && typeof msg.content === "string") // Keep final assistant text
      );
      setDisplayMessages(uiMessages);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="flex justify-center mb-6">
        <Image src={logo} alt="Graet Logo" height={100} width={100} />
      </div>
      <div className="w-full max-w-3xl bg-white rounded-lg shadow-md p-6">
        <div className="h-96 overflow-y-auto border-b border-gray-200 mb-4">
          {displayMessages.map((msg, index) => (
            <div
              key={index}
              className={`mb-4 ${
                msg.role === "user" ? "text-right" : "text-left"
              }`}
            >
              <div
                className={`inline-block px-4 py-2 rounded-lg ${
                  msg.role === "user"
                    ? "bg-blue-500 text-white"
                    : msg.role === "system"
                      ? "bg-yellow-200 text-gray-800"
                      : "bg-gray-200 text-gray-800"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center">
          <input
            type="text"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSendMessage();
            }}
          />
          <button
            onClick={handleSendMessage}
            className="ml-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;

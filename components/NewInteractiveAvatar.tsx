"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Button, Spinner } from "@nextui-org/react";
import type { CoreUserMessage, UserContent, CoreMessage } from "ai";

import { STT_LANGUAGE_LIST } from "@/app/lib/constants";

import kroni from "../public/kroni.svg";
import logo from "../public/GraetAI.svg";

import { v4 as uuidv4 } from "uuid";

// LiveKit + HeyGen imports
import {
  Room,
  RoomEvent,
  VideoPresets,
  RemoteTrack,
  RemoteTrackPublication,
} from "livekit-client";

// Your custom server actions / LLM pipeline
import { continueConversation } from "@/app/action";
import { continueConversation2 } from "@/app/action2";
import { saveCurrentConversation } from "@/app/actions/saveCurrentConversation";
import { retrieveConversationContext } from "@/app/actions/retrieveConversationContext";
import { retrieveRecentConversations } from "@/app/actions/retrieveRecentConversations";
import { saveUserGoals } from "@/app/actions/saveUserGoals";

import Report from "./report";

// ------------------- Types -------------------
interface SessionInfo {
  session_id: string;
  url: string;
  access_token: string;
}

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
  personalized: string;
  greet: string;
}

export default function NewInteractiveAvatar({
  info,
  user,
  selectedLanguage,
  accessCode,
  personalized,
  greet,
}: InteractiveProps) {
  // --------------------------------------------------
  // A) UI / State management
  // --------------------------------------------------
  // "ready" logic from original:
  //   checks if `personalized` & `greet` are both non-empty
  const [ready, setReady] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);

  // Once the session is active, we show the video stream here:
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // 10-minute timer
  const [timer, setTimer] = useState(600);
  const timerRef = useRef<number | null>(null);

  // For logging or debugging
  const [messages, setMessages] = useState<string[]>([]);

  // Chat LLM
  const [chatHistory, setChatHistory] = useState<CoreMessage[]>([]);
  const chatHistoryRef = useRef<CoreMessage[]>([]);

  // --------------------------------------------------
  // B) “ready” logic: watch personalized + greet
  // --------------------------------------------------
  useEffect(() => {
    if (personalized.trim() !== "" && greet.trim() !== "") {
      setReady(true);
    } else {
      setReady(false);
    }
  }, [personalized, greet]);

  useEffect(() => {
    if (ready && personalized) {
      // Check if a system message already exists to avoid duplicates
      const hasSystemMessage = chatHistoryRef.current.some(
        (msg) => msg.role === "system"
      );
      if (!hasSystemMessage) {
        const systemMsg: CoreMessage = {
          role: "system",
          content:
            personalized +
            ` -- conversations need to be in this language: ${selectedLanguageLabel}`,
        };
        // Prepend the system message to the chat history
        chatHistoryRef.current = [systemMsg, ...chatHistoryRef.current];
        setChatHistory(chatHistoryRef.current);
      }
    }
  }, [ready, personalized]);

  const selectedLanguageLabel =
    STT_LANGUAGE_LIST.find((language) => language.value === selectedLanguage)
      ?.label || "Language not found";

  // --------------------------------------------------
  // C) Timer logic
  // --------------------------------------------------
  useEffect(() => {
    if (isSessionActive) {
      timerRef.current = window.setInterval(() => {
        setTimer((prev) => {
          if (prev > 0) return prev - 1;
          // time's up
          clearInterval(timerRef.current!);
          timerRef.current = null;
          closeSession(); // auto-end
          return 0;
        });
      }, 1000);
    } else {
      // reset
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setTimer(600);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isSessionActive]);

  // Format timer in MM:SS
  function formatTimer(seconds: number) {
    const mm = Math.floor(seconds / 60);
    const ss = seconds % 60;
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }

  // --------------------------------------------------
  // D) Refs to manage streaming session
  // --------------------------------------------------
  const sessionInfo = useRef<SessionInfo | null>(null);
  const sessionToken = useRef<string | null>(null);
  const room = useRef<Room | null>(null);
  const webSocket = useRef<WebSocket | null>(null);

  // Add these near your other state declarations
  const [isSaving, setIsSaving] = useState(false);
  const [showReport, setShowReport] = useState(false);

  // Mic + VAD
  const [micEnabled, setMicEnabled] = useState(false);
  const micEnabledRef = useRef(false);
  const [isAutoRecording, setIsAutoRecording] = useState(false);
  const isAutoRecordingRef = useRef(false);

  // Audio context
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  // Combined stream
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const combinedStreamRef = useRef<MediaStream | null>(null);

  // VAD threshold + timing
  const THRESHOLD = 0.05;
  const SILENCE_TIMEOUT = 700;
  let silenceStart: number | null = null;
  let audioChunks: Blob[] = [];

  // HeyGen key
  const API_KEY = process.env.NEXT_PUBLIC_HEYGEN_API_KEY;

  // Utility
  function updateStatus(msg: string) {
    const now = new Date().toLocaleTimeString();
    setMessages((prev) => [...prev, `[${now}] ${msg}`]);
    console.log("[InteractiveAvatarNew3]", msg);
  }

  // --------------------------------------------------
  // (1) getSessionToken
  // --------------------------------------------------
  async function getSessionToken() {
    if (!API_KEY) {
      updateStatus("Missing NEXT_PUBLIC_HEYGEN_API_KEY");
      return;
    }
    try {
      const res = await fetch(
        `https://api.heygen.com/v1/streaming.create_token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": API_KEY,
          },
        }
      );
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to get session token.");
      }
      const data = await res.json();
      sessionToken.current = data.data.token;
      updateStatus("Session token obtained");
    } catch (error: any) {
      updateStatus(`Error obtaining token: ${error.message}`);
    }
  }

  // --------------------------------------------------
  // (2) createNewSession
  // --------------------------------------------------
  async function createNewSession() {
    setIsLoadingSession(true);

    // If no token, fetch
    if (!sessionToken.current) {
      await getSessionToken();
      if (!sessionToken.current) {
        updateStatus("No session token, aborting creation");
        setIsLoadingSession(false);
        return;
      }
    }

    try {
      const response = await fetch(`https://api.heygen.com/v1/streaming.new`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken.current}`,
        },
        body: JSON.stringify({
          quality: "high",
          avatar_name: "dbd143f592e54e49a4c9e089957e2b94", // or from props
          voice: {
            voice_id: "SBf77LFNjjOI1sA2T1y9",
            rate: 1,
          },
          version: "v2",
          video_encoding: "H264",
        }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Failed to create new session.");
      }
      const data = await response.json();
      sessionInfo.current = data.data;

      // Setup LiveKit Room
      room.current = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
        },
      });

      // combined media
      combinedStreamRef.current = new MediaStream();

      // track subscribed
      room.current.on(
        RoomEvent.TrackSubscribed,
        (track: RemoteTrack, pub: RemoteTrackPublication) => {
          if (track.kind === "video" || track.kind === "audio") {
            combinedStreamRef.current?.addTrack(track.mediaStreamTrack);
            if (
              combinedStreamRef.current &&
              combinedStreamRef.current.getVideoTracks().length > 0 &&
              combinedStreamRef.current.getAudioTracks().length > 0
            ) {
              setMediaStream(combinedStreamRef.current);
              updateStatus("Media stream ready");
            }
          }
        }
      );

      room.current.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        if (combinedStreamRef.current && track.mediaStreamTrack) {
          combinedStreamRef.current.removeTrack(track.mediaStreamTrack);
        }
      });

      room.current.on(RoomEvent.Disconnected, (reason) => {
        updateStatus(`Room disconnected: ${reason}`);
      });

      // Prepare connection
      if (sessionInfo.current) {
        await room.current.prepareConnection(
          sessionInfo.current.url,
          sessionInfo.current.access_token
        );
        updateStatus("Connection prepared");
      }
      updateStatus("Session created successfully");
    } catch (error: any) {
      updateStatus(`Error creating session: ${error.message}`);
    } finally {
      setIsLoadingSession(false);
    }
  }

  // --------------------------------------------------
  // (3) startStreamingSession
  // --------------------------------------------------
  async function startStreamingSession() {
    if (!sessionInfo.current || !sessionToken.current || !room.current) {
      updateStatus("No active session or missing token");
      return;
    }
    setIsLoadingSession(true);

    try {
      // Start
      const startResponse = await fetch(
        `https://api.heygen.com/v1/streaming.start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken.current}`,
          },
          body: JSON.stringify({
            session_id: sessionInfo.current.session_id,
          }),
        }
      );
      if (!startResponse.ok) {
        const errData = await startResponse.json();
        throw new Error(
          errData.message || "Failed to start streaming session."
        );
      }

      // Connect to LiveKit
      await room.current.connect(
        sessionInfo.current.url,
        sessionInfo.current.access_token
      );
      updateStatus("Connected to room");

      // WebSocket
      await connectWebSocket(sessionInfo.current.session_id);

      setIsSessionActive(true);

      // auto-enable mic
      enableMicrophone();

      // Send greet if we have one
      if (greet.trim()) {
        // We'll store it in chat as an assistant message
        const greetingMsg: CoreMessage = { role: "assistant", content: greet };
        chatHistoryRef.current = [...chatHistoryRef.current, greetingMsg];
        setChatHistory(chatHistoryRef.current);

        await sendText(greet, "repeat");
      }
    } catch (error: any) {
      updateStatus(`Error starting session: ${error.message}`);
    } finally {
      setIsLoadingSession(false);
    }
  }

  // --------------------------------------------------
  // (4) connectWebSocket
  // --------------------------------------------------
  async function connectWebSocket(sessionId: string) {
    if (!sessionToken.current) return;
    const params = new URLSearchParams({
      session_id: sessionId,
      session_token: sessionToken.current,
      silence_response: "false",
    });

    const wsUrl = `wss://${new URL("https://api.heygen.com").hostname}/v1/ws/streaming.chat?${params.toString()}`;
    webSocket.current = new WebSocket(wsUrl);

    webSocket.current.addEventListener("open", () => {
      updateStatus("WebSocket connected");
    });
    webSocket.current.addEventListener("message", (event) => {
      // parse or log
      try {
        const data = JSON.parse(event.data);
        updateStatus(`WS event: ${JSON.stringify(data)}`);
      } catch {
        updateStatus(`WS message: ${event.data}`);
      }
    });
    webSocket.current.addEventListener("close", () => {
      updateStatus("WebSocket closed");
    });
  }

  // --------------------------------------------------
  // (5) sendText
  // --------------------------------------------------
  async function sendText(text: string, taskType = "talk") {
    if (!sessionInfo.current || !sessionToken.current) {
      updateStatus("No active session");
      return;
    }
    try {
      const response = await fetch(`https://api.heygen.com/v1/streaming.task`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken.current}`,
        },
        body: JSON.stringify({
          session_id: sessionInfo.current.session_id,
          text,
          task_type: taskType,
        }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Failed to send text.");
      }
      updateStatus(`Sent text (${taskType}): ${text}`);
    } catch (error: any) {
      updateStatus(`Error sending text: ${error.message}`);
    }
  }

  // --------------------------------------------------
  // (6) processUserMessage -> LLM -> sendText
  // --------------------------------------------------

  async function processUserMessage(userMessage: string) {
    const userMsg: CoreUserMessage = {
      role: "user",
      content: userMessage as UserContent,
    };

    // 2) Combine with existing chat messages
    const updated: CoreMessage[] = [...chatHistoryRef.current, userMsg];
    chatHistoryRef.current = updated;
    setChatHistory(updated);

    try {
      // 3) Call server action
      const { messages: newMessages, finalResponse } =
        await continueConversation2(updated, accessCode);

      // 4) Replace local conversation with the returned messages
      chatHistoryRef.current = newMessages;
      setChatHistory(newMessages);

      // 5) TTS or speak final response
      await sendText(finalResponse, "repeat");
    } catch (err) {
      const error = err as Error;
      updateStatus(`Error in LLM flow: ${error.message}`);
    }
  }

  // --------------------------------------------------
  // (7) Microphone + VAD
  // --------------------------------------------------
  async function enableMicrophone() {
    if (micEnabledRef.current) {
      updateStatus("Mic already enabled");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { noiseSuppression: true, echoCancellation: true },
      });
      micStreamRef.current = stream;
      setMicEnabled(true);
      micEnabledRef.current = true;
      updateStatus("Mic enabled");

      const AudioContext =
        window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);

      const filter = audioContextRef.current.createBiquadFilter();
      filter.type = "notch";
      filter.frequency.value = 60;

      analyserNodeRef.current = audioContextRef.current.createAnalyser();
      analyserNodeRef.current.fftSize = 2048;

      source.connect(filter).connect(analyserNodeRef.current);

      requestAnimationFrame(checkVolume);
    } catch (err: any) {
      updateStatus(`Failed to enable mic: ${err.message}`);
    }
  }

  function checkVolume() {
    if (!analyserNodeRef.current) return;
    const bufferLength = analyserNodeRef.current.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    analyserNodeRef.current.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      const val = (dataArray[i] - 128) / 128;
      sum += val * val;
    }
    const rms = Math.sqrt(sum / bufferLength);

    // threshold
    if (rms > THRESHOLD) {
      if (!isAutoRecordingRef.current) {
        startAutoRecording();
        interruptAvatar(); // interrupt if user starts talking
      }
      silenceStart = null;
    } else {
      if (isAutoRecordingRef.current && !silenceStart) {
        silenceStart = performance.now();
      }
      if (isAutoRecordingRef.current && silenceStart) {
        const elapsed = performance.now() - silenceStart;
        if (elapsed >= SILENCE_TIMEOUT) {
          stopAutoRecording();
          silenceStart = null;
        }
      }
    }
    requestAnimationFrame(checkVolume);
  }

  function startAutoRecording() {
    if (
      !micStreamRef.current ||
      !micEnabledRef.current ||
      isAutoRecordingRef.current
    )
      return;
    audioChunks = [];
    mediaRecorderRef.current = new MediaRecorder(micStreamRef.current);
    mediaRecorderRef.current.ondataavailable = (e) => {
      audioChunks.push(e.data);
    };
    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
      await handleFinalizedAudio(audioBlob);
    };
    mediaRecorderRef.current.start();
    setIsAutoRecording(true);
    isAutoRecordingRef.current = true;

    updateStatus("Recording (VAD) started");
  }

  function stopAutoRecording() {
    if (mediaRecorderRef.current && isAutoRecordingRef.current) {
      mediaRecorderRef.current.stop();
      setIsAutoRecording(false);
      isAutoRecordingRef.current = false;
      updateStatus("Recording stopped (VAD silence)");
    }
  }

  async function handleFinalizedAudio(audioBlob: Blob) {
    updateStatus("Transcribing audio...");
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "vad_recording.wav");
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!data.text) {
        updateStatus("No transcription found");
        return;
      }
      const text = data.text;
      updateStatus(`User said: "${text}"`);
      await processUserMessage(text);
    } catch (err: any) {
      updateStatus(`Error transcribing: ${err.message}`);
    }
  }

  function disableMicrophone() {
    setMicEnabled(false);
    micEnabledRef.current = false;
    setIsAutoRecording(false);
    isAutoRecordingRef.current = false;

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    audioContextRef.current = null;
    analyserNodeRef.current = null;
    updateStatus("Microphone disabled");
  }

  // --------------------------------------------------
  // (8) interruptAvatar
  // --------------------------------------------------
  async function interruptAvatar() {
    if (!sessionInfo.current || !sessionToken.current) return;
    try {
      const response = await fetch(
        "https://api.heygen.com/v1/streaming.interrupt",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken.current}`,
          },
          body: JSON.stringify({ session_id: sessionInfo.current.session_id }),
        }
      );
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Failed to interrupt session.");
      }
      updateStatus("Avatar interrupted");
    } catch (error: any) {
      updateStatus(`Error interrupting: ${error.message}`);
    }
  }

  // --------------------------------------------------
  // (9) closeSession
  // --------------------------------------------------
  async function closeSession() {
    if (!sessionInfo.current || !sessionToken.current) {
      setIsSessionActive(false);
      return;
    }
    try {
      const response = await fetch(`https://api.heygen.com/v1/streaming.stop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken.current}`,
        },
        body: JSON.stringify({ session_id: sessionInfo.current.session_id }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Failed to close session.");
      }
      webSocket.current?.close();
      room.current?.disconnect();
      setMediaStream(null);
      sessionInfo.current = null;
      room.current = null;
      combinedStreamRef.current = null;
      sessionToken.current = null;
      setIsSessionActive(false);
      disableMicrophone();

      updateStatus("Session closed");

      // Generate a unique conversationId
      const conversationId = uuidv4();

      // Save the conversation if you want:
      await saveCurrentConversation({
        userId: accessCode,
        conversationId: conversationId,
        messages: chatHistoryRef.current,
      });

      await saveUserGoals({
        userId: accessCode,
        messages: chatHistoryRef.current,
      });
    } catch (error: any) {
      updateStatus(`Error closing session: ${error.message}`);
    }
  }

  // New function to handle end session with saving and reporting
  async function handleEndSession() {
    setIsSaving(true);
    await closeSession(); // Close session and save user goals
    setIsSaving(false);
    setShowReport(true);
  }

  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch(() => null); // Handle play errors
    }
  }, [mediaStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      closeSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------------------------------------
  // E) Render UI (replicating original look/feel)
  // --------------------------------------------------

  // New conditional rendering before main UI
  if (isSaving) {
    return (
      <div className="w-full min-h-screen flex flex-col items-center justify-center bg-white">
        <Spinner color="default" size="lg" />
        <p className="mt-4 text-gray-600 text-sm font-medium">
          Saving your information, please wait...
        </p>
      </div>
    );
  }

  if (showReport) {
    return <Report onClose={() => setShowReport(false)} reportBool={true} />;
  }

  return (
    <div className="w-full min-h-screen flex flex-col bg-white">
      {/* Header section with fixed height */}
      <div className="w-full flex justify-center py-6">
        <Image src={logo} alt="Graet Logo" height={300} width={300} />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center w-full px-4">
        <div className="w-full max-w-4xl flex flex-col items-center gap-6">
          {isSessionActive ? (
            // Video container
            <div className="h-[500px] w-[900px] flex justify-center items-center relative">
              {mediaStream ? (
                <video
                  ref={videoRef}
                  className="w-full h-full object-contain rounded-lg overflow-hidden"
                  autoPlay
                  playsInline
                  muted={false}
                />
              ) : (
                <div className="text-gray-500">Connecting to avatar...</div>
              )}
            </div>
          ) : isLoadingSession ? (
            <Spinner color="default" size="lg" />
          ) : (
            <div className="flex flex-col items-center gap-6">
              <Image src={kroni} alt="Kroni Avatar" height={350} width={350} />
              {ready ? (
                <Button
                  className="bg-gradient-to-tr from-blue-700 to-blue-300 text-white py-4 px-8 rounded-lg flex items-center justify-center gap-2 shadow-lg hover:scale-105 transform transition"
                  size="lg"
                  onClick={async () => {
                    await createNewSession();
                    await startStreamingSession();
                  }}
                >
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
                  Start Session
                </Button>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <Spinner color="default" size="lg" />
                  <p className="text-gray-600 text-sm font-medium">
                    Preparing the avatar for your session...
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer section */}
        {isSessionActive && (
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

        {/* Debug console */}
        {/* <div className="w-full max-w-4xl p-2 mt-6 bg-gray-50 border border-gray-200 rounded-md text-left text-sm h-24 overflow-y-auto">
          {messages.map((msg, idx) => (
            <div key={idx}>{msg}</div>
          ))}
        </div> */}
      </div>
    </div>
  );
}

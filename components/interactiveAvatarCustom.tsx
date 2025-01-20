"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Room,
  RoomEvent,
  VideoPresets,
  RemoteTrack,
  RemoteTrackPublication,
} from "livekit-client";

import {
    llm,
    pipeline,
  } from '@livekit/agents';

interface SessionInfo {
  session_id: string;
  url: string;
  access_token: string;
}

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const InteractiveAvatarCustom: React.FC = () => {
  // Chat and LLM state
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [avatarID, setAvatarID] = useState("dbd143f592e54e49a4c9e089957e2b94");
  const [voiceID, setVoiceID] = useState("SBf77LFNjjOI1sA2T1y9");
  const [taskText, setTaskText] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [isAutoRecording, setIsAutoRecording] = useState(false);

  // Refs for session, streaming, VAD, etc.
  const sessionInfo = useRef<SessionInfo | null>(null);
  const room = useRef<Room | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const webSocket = useRef<WebSocket | null>(null);
  const sessionToken = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micEnabledRef = useRef(false);
  const isAutoRecordingRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const THRESHOLD = 0.05;
  const SILENCE_TIMEOUT = 700;
  let silenceStart: number | null = null;
  let audioChunks: Blob[] = [];

  const API_KEY = process.env.NEXT_PUBLIC_HEYGEN_API_KEY;

  function updateStatus(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    setMessages((prev) => [...prev, `[${timestamp}] ${message}`]);
    console.log(message);
  }

  async function getSessionToken() {
    if (!API_KEY) {
      updateStatus("Missing NEXT_PUBLIC_HEYGEN_API_KEY");
      return;
    }
    try {
      const response = await fetch(`https://api.heygen.com/v1/streaming.create_token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": API_KEY,
        },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Failed to get session token.");
      }
      const data = await response.json();
      sessionToken.current = data.data.token;
      updateStatus("Session token obtained");
    } catch (error: any) {
      updateStatus(`Error obtaining token: ${error.message}`);
    }
  }

  async function createNewSession() {
    if (!avatarID || !voiceID) {
      updateStatus("Please enter both Avatar ID and Voice ID.");
      return;
    }
    if (!sessionToken.current) {
      await getSessionToken();
      if (!sessionToken.current) {
        updateStatus("No session token available, aborting session creation.");
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
          avatar_name: avatarID,
          voice: { voice_id: voiceID, rate: 1 },
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

      room.current = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
      });

      mediaStream.current = new MediaStream();

      room.current.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === "video" || track.kind === "audio") {
          mediaStream.current?.addTrack(track.mediaStreamTrack);
          if (
            mediaStream.current &&
            mediaStream.current.getVideoTracks().length > 0 &&
            mediaStream.current.getAudioTracks().length > 0 &&
            videoRef.current
          ) {
            videoRef.current.srcObject = mediaStream.current;
            updateStatus("Media stream ready");
          }
        }
      });

      room.current.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        const mediaTrack = track.mediaStreamTrack;
        if (mediaStream.current && mediaTrack) {
          mediaStream.current.removeTrack(mediaTrack);
        }
      });

      room.current.on(RoomEvent.Disconnected, (reason) => {
        updateStatus(`Room disconnected: ${reason}`);
      });

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
    }
  }

  async function startStreamingSession() {
    if (!sessionInfo.current || !sessionToken.current || !room.current) {
      updateStatus("No active session or missing session token");
      return;
    }
    try {
      const startResponse = await fetch(`https://api.heygen.com/v1/streaming.start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken.current}`,
        },
        body: JSON.stringify({ session_id: sessionInfo.current.session_id }),
      });

      if (!startResponse.ok) {
        const errData = await startResponse.json();
        throw new Error(errData.message || "Failed to start streaming session.");
      }

      await room.current.connect(
        sessionInfo.current.url,
        sessionInfo.current.access_token
      );
      updateStatus("Connected to room");
      await connectWebSocket(sessionInfo.current.session_id);
      setIsSessionActive(true);
      updateStatus("Streaming started successfully");
    } catch (error: any) {
      updateStatus(`Error starting session: ${error.message}`);
    }
  }

  async function connectWebSocket(sessionId: string) {
    if (!sessionToken.current) return;
    const params = new URLSearchParams({
      session_id: sessionId,
      session_token: sessionToken.current,
      silence_response: "false",
      opening_text: "Hello, how can I help you?",
      stt_language: "fr",
    });

    const wsUrl = `wss://${new URL("https://api.heygen.com").hostname}/v1/ws/streaming.chat?${params.toString()}`;
    webSocket.current = new WebSocket(wsUrl);

    webSocket.current.addEventListener("open", () => {
      updateStatus("WebSocket connected");
    });

    webSocket.current.addEventListener("message", (event) => {
      try {
        const eventData = JSON.parse(event.data);
        console.log("WebSocket event:", eventData);
      } catch (e) {
        console.warn("Failed to parse WebSocket message:", event.data);
      }
    });

    webSocket.current.addEventListener("close", () => {
      updateStatus("WebSocket closed");
    });
  }

  async function sendText(text: string, taskType = "repeat") {
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
        throw new Error(errData.message || "Failed to send text task.");
      }
      updateStatus(`Sent text (${taskType}): ${text}`);
    } catch (error: any) {
      updateStatus(`Error sending text: ${error.message}`);
    }
  }

  function parsePartialContent(jsonChunk: any): string {
    if (!jsonChunk.choices) return "";
    const delta = jsonChunk.choices[0]?.delta;
    return delta?.content || "";
  }

  async function processUserMessageStream(userMessage: string) {
    // 1) Add user message to chatHistory
    setChatHistory((prev) => [...prev, { role: "user", content: userMessage }]);
    const updatedHistory = [...chatHistory, { role: "user", content: userMessage }];

    try {
      const response = await fetch("/api/avatarstream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedHistory }),
      });

      if (!response.body) {
        updateStatus("No response body from streaming endpoint");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let partial = "";
      let assistantResponse = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        partial += chunk;
        const lines = partial.split("\n\n");
        partial = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonString = line.slice("data: ".length);
          try {
            const json = JSON.parse(jsonString);
            const content = parsePartialContent(json);
            if (content) {
              console.log('chunked content', content)
              sendText(content, "repeat");
              assistantResponse += content;
              // Optionally, update UI for partial content here
            }
          } catch (err) {
            console.error("Error parsing SSE line:", err, line);
          }
        }
      }

      // After stream ends, update chat history and send text to avatar
      setChatHistory((prev) => [...prev, { role: "assistant", content: assistantResponse }]);
      //sendText(assistantResponse, "repeat");
    } catch (error: any) {
      updateStatus(`Error in streaming process: ${error.message}`);
    }
  }

  async function enableMicrophone() {
    if (micEnabled) {
      updateStatus("Microphone already enabled");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { noiseSuppression: true, echoCancellation: true },
      });
      micStreamRef.current = stream;
      setMicEnabled(true);
      micEnabledRef.current = true;
      updateStatus("Microphone enabled");

      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
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
      updateStatus(`Failed to get mic: ${err.message}`);
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

    if (rms > THRESHOLD) {
      if (!isAutoRecordingRef.current) {
        startAutoRecording();
        interruptAvatar();
      }
      silenceStart = null;
    } else {
      if (isAutoRecordingRef.current && !silenceStart) silenceStart = performance.now();
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
    try {
      if (!micEnabledRef.current || isAutoRecordingRef.current) return;
      if (!micStreamRef.current) {
        console.error("Microphone stream not available");
        return;
      }
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
      updateStatus("Recording started (VAD-based)");
    } catch (error) {
      console.error("Error in startAutoRecording:", error);
    }
  }

  function stopAutoRecording() {
    if (mediaRecorderRef.current && isAutoRecordingRef.current) {
      mediaRecorderRef.current.stop();
      setIsAutoRecording(false);
      isAutoRecordingRef.current = false;
      updateStatus("Recording stopped due to silence (VAD)");
    }
  }

  async function handleFinalizedAudio(audioBlob: Blob) {
    updateStatus("Transcribing audio...");
    const formData = new FormData();
    formData.append("audio", audioBlob, "vad_recording.wav");
    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      const text = data.text;
      if (!text) {
        updateStatus("No transcription found");
        return;
      }
      updateStatus(`User said: "${text}"`);
      await processUserMessageStream(text);
    } catch (e: any) {
      updateStatus(`Error during transcription: ${e.message}`);
    }
  }

  function disableMicrophone() {
    setMicEnabled(false);
    setIsAutoRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    audioContextRef.current = null;
    analyserNodeRef.current = null;
    updateStatus("Microphone disabled");
  }

  async function interruptAvatar() {
    if (!sessionInfo.current || !sessionToken.current) {
      updateStatus("No active session or missing session token");
      return;
    }
    try {
      const response = await fetch("https://api.heygen.com/v1/streaming.interrupt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken.current}`,
        },
        body: JSON.stringify({ session_id: sessionInfo.current.session_id }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Failed to interrupt streaming session.");
      }
      updateStatus("Interrupt successful");
    } catch (error: any) {
      updateStatus(`Error interrupting session: ${error.message}`);
    }
  }

  async function closeSession() {
    if (!sessionInfo.current || !sessionToken.current) {
      updateStatus("No active session");
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
      if (videoRef.current) videoRef.current.srcObject = null;
      sessionInfo.current = null;
      room.current = null;
      mediaStream.current = null;
      sessionToken.current = null;
      setIsSessionActive(false);
      disableMicrophone();
      updateStatus("Session closed");
    } catch (error: any) {
      updateStatus(`Error closing session: ${error.message}`);
    }
  }

  useEffect(() => {
    return () => {
      disableMicrophone();
      closeSession();
    };
  }, []);

  return (
    <div className="bg-gray-100 p-5 font-sans min-h-screen">
      <div className="max-w-3xl mx-auto bg-white p-5 rounded-lg shadow-md">
        {/* Session controls */}
        <div className="flex flex-wrap gap-2.5 mb-5">
          <input
            value={avatarID}
            onChange={(e) => setAvatarID(e.target.value)}
            type="text"
            placeholder="Avatar ID"
            className="flex-1 min-w-[200px] p-2 border border-gray-300 rounded-md"
          />
          <input
            value={voiceID}
            onChange={(e) => setVoiceID(e.target.value)}
            type="text"
            placeholder="Voice ID"
            className="flex-1 min-w-[200px] p-2 border border-gray-300 rounded-md"
          />
          <button
            onClick={async () => {
              await createNewSession();
              await startStreamingSession();
            }}
            disabled={isSessionActive}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start
          </button>
          <button
            onClick={closeSession}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
          >
            Close
          </button>
        </div>

        {/* Text Input for user messages */}
        <div className="flex flex-wrap gap-2.5 mb-5">
          <input
            value={taskText}
            onChange={(e) => setTaskText(e.target.value)}
            type="text"
            placeholder="Enter text for avatar"
            className="flex-1 min-w-[200px] p-2 border border-gray-300 rounded-md"
          />
          <button
            onClick={() => {
              const text = taskText.trim();
              if (text) {
                processUserMessageStream(text);
                setTaskText("");
              }
            }}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
          >
            Send to LLM
          </button>
        </div>

        {/* Voice and interrupt controls */}
        <div className="flex flex-wrap gap-2.5 mb-5">
          {!micEnabled ? (
            <button
              onClick={enableMicrophone}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              Enable Mic (Auto Detect)
            </button>
          ) : (
            <button
              onClick={disableMicrophone}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              Disable Mic
            </button>
          )}
          <button
            onClick={interruptAvatar}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
          >
            Interrupt Avatar
          </button>
        </div>

        {/* Video Display */}
        <video ref={videoRef} className="w-full max-h-[400px] border rounded-lg my-5" autoPlay></video>

        {/* Chat History Display */}
        <div className="mb-5">
          <h2 className="font-bold text-lg mb-2">Chat History</h2>
          <div className="p-2 bg-gray-200 rounded-md h-40 overflow-y-auto">
            {chatHistory.map((msg, idx) => (
              <div key={idx} className="mb-1">
                <strong>{msg.role === "user" ? "User: " : "Assistant: "}</strong>
                {msg.content}
              </div>
            ))}
          </div>
        </div>

        {/* Status Console */}
        <div className="p-2.5 bg-gray-50 border border-gray-300 rounded-md h-[150px] overflow-y-auto font-mono text-sm">
          {messages.map((msg, index) => (
            <div key={index}>{msg}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default InteractiveAvatarCustom;
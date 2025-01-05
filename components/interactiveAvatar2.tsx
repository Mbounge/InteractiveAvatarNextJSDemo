"use client";

import React, { useState, useRef } from "react";
import {
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  RemoteTrackPublication,
  RemoteTrack,
} from "livekit-client";

interface SessionInfo {
  session_id: string;
  url: string;
  access_token: string;
}

const InteractiveAvatar2: React.FC = () => {
  const [avatarID, setAvatarID] = useState("dbd143f592e54e49a4c9e089957e2b94");
  const [voiceID, setVoiceID] = useState("SBf77LFNjjOI1sA2T1y9");
  const [taskText, setTaskText] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [isSessionActive, setIsSessionActive] = useState(false);

  const sessionInfo = useRef<SessionInfo | null>(null);
  const room = useRef<Room | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const webSocket = useRef<WebSocket | null>(null);
  const sessionToken = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const API_KEY = process.env.NEXT_PUBLIC_HEYGEN_API_KEY;

  if (!API_KEY) {
    console.warn("Missing NEXT_PUBLIC_HEYGEN_API_KEY environment variables");
  }

  function updateStatus(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    setMessages((prev) => [...prev, `[${timestamp}] ${message}`]);
  }

  async function getSessionToken() {
    if (!API_KEY) return;

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

    webSocket.current.addEventListener("message", (event) => {
      try {
        const eventData = JSON.parse(event.data);
        console.log("Raw WebSocket event:", eventData);
      } catch (e) {
        console.warn("Failed to parse websocket message:", event.data);
      }
    });
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
          voice: {
            voice_id: voiceID,
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

      // Create LiveKit Room
      room.current = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
        },
      });


    // This is where you handle the events
    // AVATAR_START_TALKING: Emitted when the avatar starts speaking.
    // AVATAR_STOP_TALKING: Emitted when the avatar stops speaking.
    // AVATAR_TALKING_MESSAGE: Triggered when the avatar sends a speaking message.
    // AVATAR_END_MESSAGE: Triggered when the avatar finishes sending messages.
    // USER_TALKING_MESSAGE: Emitted when the user sends a speaking message.
    // USER_END_MESSAGE: Triggered when the user finishes sending messages.
    // USER_START: Indicates when the user starts interacting.
    // USER_STOP: Indicates when the user stops interacting.
    // USER_SILENCE: Indicates when the user is silent.
    // STREAM_READY: Indicates that the stream is ready for display.
    // STREAM_DISCONNECTED: Triggered when the stream disconnects.
      
      room.current.on(RoomEvent.DataReceived, (message) => {
        const decoded = new TextDecoder().decode(message);
        console.log("Room message:", JSON.parse(decoded));
        // get something like for decoded: {type: 'avatar_talking_message', task_id: '212fd4a6-b67c-11ef-a425-02f07865ee09', message: 'Hello'}
        // 
      });

      // Create a new MediaStream for combined tracks
      mediaStream.current = new MediaStream();

      room.current.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, pub: RemoteTrackPublication) => {
        if (track.kind === "video" || track.kind === "audio") {
          if (mediaStream.current) {
            mediaStream.current.addTrack(track.mediaStreamTrack);
          }
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

      room.current.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, pub: RemoteTrackPublication) => {
        const mediaTrack = track.mediaStreamTrack;
        if (mediaTrack && mediaStream.current) {
          mediaStream.current.removeTrack(mediaTrack);
        }
      });

      room.current.on(RoomEvent.Disconnected, (reason) => {
        updateStatus(`Room disconnected: ${reason}`);
      });

      if (!sessionInfo.current) {
        updateStatus("Session info is not available");
        return;
      }

      await room.current.prepareConnection(
        sessionInfo.current.url,
        sessionInfo.current.access_token
      );
      updateStatus("Connection prepared");

      // Connect WebSocket after room preparation
      await connectWebSocket(sessionInfo.current.session_id);

      updateStatus("Session created successfully");
    } catch (error: any) {
      updateStatus(`Error creating session: ${error.message}`);
    }
  }

  async function startStreamingSession() {
    if (!sessionInfo.current || !sessionToken.current) {
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
        body: JSON.stringify({
          session_id: sessionInfo.current.session_id,
        }),
      });

      if (!startResponse.ok) {
        const errData = await startResponse.json();
        throw new Error(errData.message || "Failed to start streaming session.");
      }

      // Connect to LiveKit room
      if (room.current && sessionInfo.current) {
        await room.current.connect(sessionInfo.current.url, sessionInfo.current.access_token);
        updateStatus("Connected to room");
        setIsSessionActive(true);
        updateStatus("Streaming started successfully");
      }
    } catch (error: any) {
      updateStatus(`Error starting session: ${error.message}`);
    }
  }

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
          text: text + '(respond back in french)',
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
        body: JSON.stringify({
          session_id: sessionInfo.current.session_id,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Failed to close session.");
      }

      // Close WebSocket
      if (webSocket.current) {
        webSocket.current.close();
      }

      // Disconnect from LiveKit room
      if (room.current) {
        room.current.disconnect();
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      sessionInfo.current = null;
      room.current = null;
      mediaStream.current = null;
      sessionToken.current = null;
      setIsSessionActive(false);
      updateStatus("Session closed");
    } catch (error: any) {
      updateStatus(`Error closing session: ${error.message}`);
    }
  }

  return (
    <div className="bg-gray-100 p-5 font-sans min-h-screen">
      <div className="max-w-3xl mx-auto bg-white p-5 rounded-lg shadow-md">
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
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSessionActive}
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

        <div className="flex flex-wrap gap-2.5 mb-5">
          <input
            value={taskText}
            onChange={(e) => setTaskText(e.target.value)}
            type="text"
            placeholder="Enter text for avatar to speak"
            className="flex-1 min-w-[200px] p-2 border border-gray-300 rounded-md"
          />
          <button
            onClick={() => {
              if (taskText.trim()) {
                sendText(taskText.trim(), "talk");
                setTaskText("");
              }
            }}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
          >
            Talk (LLM)
          </button>
          <button
            onClick={() => {
              if (taskText.trim()) {
                sendText(taskText.trim(), "repeat");
                setTaskText("");
              }
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Repeat
          </button>
        </div>

        <video
          ref={videoRef}
          className="w-full max-h-[400px] border rounded-lg my-5"
          autoPlay
        ></video>

        <div className="p-2.5 bg-gray-50 border border-gray-300 rounded-md h-[100px] overflow-y-auto font-mono text-sm">
          {messages.map((msg, index) => (
            <div key={index}>{msg}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default InteractiveAvatar2;

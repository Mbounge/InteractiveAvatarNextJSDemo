"use client";

import { useState, useRef, useEffect } from "react";

/**
 * Minimal shape of a message object if you want to keep track
 * of raw events for debugging or other usage.
 */
interface RealtimeMessage {
  type: string;
  [key: string]: any; // catch-all for extra fields
}

interface UseOpenAIVADSessionReturn {
  status: string;
  isSessionActive: boolean;
  startSession: () => Promise<void>;
  stopSession: () => void;
  handleStartStopClick: () => void;

  // Locally recorded audio logic
  isRecording: boolean;
  /** Start local recording, ignoring partial from OpenAI. */
  startRecording: () => void;
  /** Stop local recording and handle the result. */
  stopRecording: () => void;

  // For debugging or hooking into events
  realtimeMessages: RealtimeMessage[];
}

/**
 * Hook that connects to OpenAI Realtime for *VAD only*.
 * We'll ignore OpenAI's partial or final transcriptions and
 * simply rely on events for `speech_started` and `speech_stopped`.
 *
 * Meanwhile, we do our OWN local recording for transcription
 * to a custom endpoint (Deepgram, etc.).
 */
export default function useOpenAIVADSession(
  // Model or voice config if you still need it
  model: string = "gpt-4o-realtime-preview-2024-12-17"
): UseOpenAIVADSessionReturn {
  const [status, setStatus] = useState("");
  const [isSessionActive, setIsSessionActive] = useState(false);

  // WebRTC
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  // Microphone
  const audioStreamRef = useRef<MediaStream | null>(null);

  // Local Audio Recording
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Track raw messages from the Realtime API for debugging
  const [realtimeMessages, setRealtimeMessages] = useState<RealtimeMessage[]>([]);

  /**
   * Create a local description (offer) -> Send to OpenAI Realtime -> 
   * Realtime returns an answer -> setRemoteDescription -> done.
   */
  async function startSession() {
    try {
      setStatus("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      setStatus("Creating RTCPeerConnection...");
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      // Data channel to receive events from OpenAI
      const dataChannel = pc.createDataChannel("realtime");
      dataChannelRef.current = dataChannel;

      dataChannel.onopen = () => {
        console.log("Data channel open (VAD only)");
      };

      dataChannel.onmessage = (event) => {
        console.log(event)
        handleDataChannelMessage(event);
      };

      // Add local track to WebRTC
      const track = stream.getAudioTracks()[0];
      pc.addTrack(track);

      // Create an offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Make a POST to OpenAI Realtime to get an answer
      // (You should have an ephemeral token in production)
      setStatus("Fetching ephemeral token (dummy)...");
      const ephemeralToken = "YOUR_OPENAI_TOKEN"; // or from /api/session

      setStatus("Sending offer to OpenAI Realtime...");
      const baseUrl = "https://api.openai.com/v1/realtime";
      // If you do NOT want text or audio from OpenAI at all, 
      // you can configure or limit. We'll just do minimal.

      const response = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ephemeralToken}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });
      const answerSdp = await response.text();

      // Set remote description
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      setIsSessionActive(true);
      setStatus("OpenAI Realtime session established (VAD only).");
    } catch (err: any) {
      console.error("startSession error:", err);
      setStatus(`Error starting session: ${err.message}`);
      stopSession();
    }
  }

  /** Stop everything */
  function stopSession() {
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    audioChunksRef.current = [];
    setIsSessionActive(false);
    setStatus("Session stopped (VAD only).");
  }

  function handleStartStopClick() {
    if (isSessionActive) {
      stopSession();
    } else {
      startSession();
    }
  }

  /**
   * Data channel message handler from OpenAI.
   * We'll specifically look for "speech_started" / "speech_stopped" events
   * to control local recording or any other logic.
   */
  function handleDataChannelMessage(event: MessageEvent) {
    try {
      const msg = JSON.parse(event.data);
      setRealtimeMessages((prev) => [...prev, msg]);

      switch (msg.type) {
        case "input_audio_buffer.speech_started": {
          console.log("OpenAI says: speech started");
          // Optionally, you could start local recording here
          break;
        }
        case "input_audio_buffer.speech_stopped": {
          console.log("OpenAI says: speech stopped");
          // Optionally, you could stop local recording here
          break;
        }
        default:
          // ignoring other events (like partial transcripts)
          break;
      }
    } catch (err) {
      console.error("Error handling datachannel message", err);
    }
  }

  /**
   * Start local recording. 
   * We are ignoring OpenAI's STT and using your own /api/transcribe approach.
   */
  function startRecording() {
    if (!audioStreamRef.current) {
      console.error("No local audio stream to record.");
      return;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      console.warn("Already recording, ignoring start.");
      return;
    }
    audioChunksRef.current = [];

    const recorder = new MediaRecorder(audioStreamRef.current);
    recorder.ondataavailable = (e) => {
      audioChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      console.log("Local recording stopped.");
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  }

  /**
   * Stop local recording and return the blob for transcription usage.
   */
  function stopRecording() {
    if (!mediaRecorderRef.current) return;
    if (mediaRecorderRef.current.state === "inactive") return;

    mediaRecorderRef.current.onstop = () => {
      setIsRecording(false);
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
      console.log("Finalized local audio blob:", audioBlob);
      // Now you can send to /api/transcribe
      // e.g. handleFinalizedAudio(audioBlob);
    };

    mediaRecorderRef.current.stop();
  }

  /** Cleanup on unmount */
  useEffect(() => {
    return () => {
      stopSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    status,
    isSessionActive,
    startSession,
    stopSession,
    handleStartStopClick,
    isRecording,
    startRecording,
    stopRecording,
    realtimeMessages,
  };
}
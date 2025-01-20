"use client";

import { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { Conversation } from "@/app/lib/conversation";

export interface Tool {
  name: string;
  description: string;
  parameters?: Record<string, any>;
}

interface UseWebRTCAudioSessionReturn {
  status: string;
  isSessionActive: boolean;
  audioIndicatorRef: React.RefObject<HTMLDivElement | null>;
  startSession: () => Promise<void>;
  stopSession: () => void;
  handleStartStopClick: () => void;
  registerFunction: (name: string, fn: Function) => void;
  msgs: any[];
  currentVolume: number;
  conversation: Conversation[];
}

export default function useWebRTCAudioSession(
  voice: string,
  tools?: Tool[],
): UseWebRTCAudioSessionReturn {
  const [status, setStatus] = useState("");
  const [isSessionActive, setIsSessionActive] = useState(false);

  const audioIndicatorRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // New reference for audio element used for playback
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [conversation, setConversation] = useState<Conversation[]>([]);
  const functionRegistry = useRef<Record<string, Function>>({});
  const [currentVolume, setCurrentVolume] = useState(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const volumeIntervalRef = useRef<number | null>(null);
  const ephemeralUserMessageIdRef = useRef<string | null>(null);

  function registerFunction(name: string, fn: Function) {
    functionRegistry.current[name] = fn;
  }

  function configureDataChannel(dataChannel: RTCDataChannel) {
    const sessionUpdate = {
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        tools: tools || [],
        input_audio_transcription: {
          model: "whisper-1",
        },
      },
    };
    dataChannel.send(JSON.stringify(sessionUpdate));

    console.log("Session update sent:", sessionUpdate);
    
  }

  function getOrCreateEphemeralUserId(): string {
    let ephemeralId = ephemeralUserMessageIdRef.current;
    if (!ephemeralId) {
      ephemeralId = uuidv4();
      ephemeralUserMessageIdRef.current = ephemeralId;

      const newMessage: Conversation = {
        id: ephemeralId,
        role: "user",
        text: "",
        timestamp: new Date().toISOString(),
        isFinal: false,
        status: "speaking",
      };

      setConversation((prev) => [...prev, newMessage]);
    }
    return ephemeralId;
  }

  function updateEphemeralUserMessage(partial: Partial<Conversation>) {
    const ephemeralId = ephemeralUserMessageIdRef.current;
    if (!ephemeralId) return;
    setConversation((prev) =>
      prev.map((msg) => {
        if (msg.id === ephemeralId) {
          return { ...msg, ...partial };
        }
        return msg;
      }),
    );
  }

  function clearEphemeralUserMessage() {
    ephemeralUserMessageIdRef.current = null;
  }

  // Mute AI audio when user starts speaking
  function onUserStartsSpeaking() {
    if (audioElRef.current) {
      audioElRef.current.pause();
    }
    const pc = peerConnectionRef.current;
    if (pc) {
      pc.getReceivers().forEach(receiver => {
        if (receiver.track && receiver.track.kind === 'audio') {
          receiver.track.enabled = false;
        }
      });
    }
  }

  // Unmute AI audio when user stops speaking
  function onUserStopsSpeaking() {
    if (audioElRef.current) {
      audioElRef.current.play().catch(err => {
        console.error("Error resuming audio playback:", err);
      });
    }
    const pc = peerConnectionRef.current;
    if (pc) {
      pc.getReceivers().forEach(receiver => {
        if (receiver.track && receiver.track.kind === 'audio') {
          receiver.track.enabled = true;
        }
      });
    }
  }

  async function handleDataChannelMessage(event: MessageEvent) {
    try {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case "input_audio_buffer.speech_started": {
          getOrCreateEphemeralUserId();
          updateEphemeralUserMessage({ status: "speaking" });
          onUserStartsSpeaking();  // Mute AI audio when user speaks
          break;
        }
        case "input_audio_buffer.speech_stopped": {
          updateEphemeralUserMessage({ status: "speaking" });
          onUserStopsSpeaking();   // Unmute AI audio when user stops speaking
          break;
        }
        case "input_audio_buffer.committed": {
          updateEphemeralUserMessage({
            text: "Processing speech...",
            status: "processing",
          });
          break;
        }
        case "conversation.item.input_audio_transcription": {
          const partialText = msg.transcript ?? msg.text ?? "User is speaking...";
          updateEphemeralUserMessage({
            text: partialText,
            status: "speaking",
            isFinal: false,
          });
          break;
        }
        case "conversation.item.input_audio_transcription.completed": {
          updateEphemeralUserMessage({
            text: msg.transcript || "",
            isFinal: true,
            status: "final",
          });
          clearEphemeralUserMessage();
          break;
        }
        case "response.audio_transcript.delta": {
          const newMessage: Conversation = {
            id: uuidv4(),
            role: "assistant",
            text: msg.delta,
            timestamp: new Date().toISOString(),
            isFinal: false,
          };

          setConversation((prev) => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.role === "assistant" && !lastMsg.isFinal) {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...lastMsg,
                text: lastMsg.text + msg.delta,
              };
              return updated;
            } else {
              return [...prev, newMessage];
            }
          });
          break;
        }
        case "response.audio_transcript.done": {
          setConversation((prev) => {
            if (prev.length === 0) return prev;
            const updated = [...prev];
            updated[updated.length - 1].isFinal = true;
            return updated;
          });
          break;
        }
        case "response.function_call_arguments.done": {
          const fn = functionRegistry.current[msg.name];
          if (fn) {
            const args = JSON.parse(msg.arguments);
            const result = await fn(args);

            const response = {
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: msg.call_id,
                output: JSON.stringify(result),
              },
            };
            dataChannelRef.current?.send(JSON.stringify(response));

            const responseCreate = { type: "response.create" };
            dataChannelRef.current?.send(JSON.stringify(responseCreate));
          }
          break;
        }
        default: {
          break;
        }
      }

      setMsgs((prevMsgs) => [...prevMsgs, msg]);
      return msg;
    } catch (error) {
      console.error("Error handling data channel message:", error);
    }
  }

  async function getEphemeralToken() {
    try {
      const response = await fetch("/api/realtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error(`Failed to get ephemeral token: ${response.status}`);
      const data = await response.json();
      return data.client_secret.value;
    } catch (err) {
      console.error("getEphemeralToken error:", err);
      throw err;
    }
  }

  function setupAudioVisualization(stream: MediaStream) {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyzer = audioContext.createAnalyser();
    analyzer.fftSize = 256;
    source.connect(analyzer);

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateIndicator = () => {
      if (!audioContext) return;
      analyzer.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;

      if (audioIndicatorRef.current) {
        audioIndicatorRef.current.classList.toggle("active", average > 30);
      }
      requestAnimationFrame(updateIndicator);
    };
    updateIndicator();

    audioContextRef.current = audioContext;
  }

  function getVolume(): number {
    if (!analyserRef.current) return 0;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const float = (dataArray[i] - 128) / 128;
      sum += float * float;
    }
    return Math.sqrt(sum / dataArray.length);
  }

  async function startSession() {
    try {
      setStatus("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      setupAudioVisualization(stream);

      setStatus("Fetching ephemeral token...");
      const ephemeralToken = await getEphemeralToken();

      setStatus("Establishing connection...");
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      // Create audio element and store reference
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      audioElRef.current = audioEl;

      pc.ontrack = (event) => {
        audioEl.srcObject = event.streams[0];

        const audioCtx = new (window.AudioContext || window.AudioContext)();
        const src = audioCtx.createMediaStreamSource(event.streams[0]);
        const inboundAnalyzer = audioCtx.createAnalyser();
        inboundAnalyzer.fftSize = 256;
        src.connect(inboundAnalyzer);
        analyserRef.current = inboundAnalyzer;

        volumeIntervalRef.current = window.setInterval(() => {
          setCurrentVolume(getVolume());
        }, 100);
      };

      const dataChannel = pc.createDataChannel("response");
      dataChannelRef.current = dataChannel;

      dataChannel.onopen = () => {
        configureDataChannel(dataChannel);
      };
      dataChannel.onmessage = handleDataChannelMessage;

      pc.addTrack(stream.getTracks()[0]);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-4o-mini-realtime-preview-2024-12-17";
      const response = await fetch(`${baseUrl}?model=${model}&voice=${voice}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${ephemeralToken}`,
          "Content-Type": "application/sdp",
        },
      });

      const answerSdp = await response.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      setIsSessionActive(true);
      setStatus("Session established successfully!");
    } catch (err: any) {
      console.error("startSession error:", err);
      setStatus(`Error: ${err}`);
      stopSession();
    }
  }

  function stopSession() {
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    if (audioIndicatorRef.current) {
      audioIndicatorRef.current.classList.remove("active");
    }
    if (volumeIntervalRef.current) {
      clearInterval(volumeIntervalRef.current);
      volumeIntervalRef.current = null;
    }
    analyserRef.current = null;
    ephemeralUserMessageIdRef.current = null;

    setCurrentVolume(0);
    setIsSessionActive(false);
    setStatus("Session stopped");
    setMsgs([]);
    setConversation([]);
  }

  function handleStartStopClick() {
    if (isSessionActive) {
      stopSession();
    } else {
      startSession();
    }
  }

  useEffect(() => {
    return () => stopSession();
  }, []);

  return {
    status,
    isSessionActive,
    audioIndicatorRef,
    startSession,
    stopSession,
    handleStartStopClick,
    registerFunction,
    msgs,
    currentVolume,
    conversation,
  };
}
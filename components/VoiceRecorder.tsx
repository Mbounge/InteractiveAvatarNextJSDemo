import { useRef, useState } from "react";

export default function VoiceRecorder({ onTranscription }: { onTranscription: (text: string) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const audioChunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
        await handleAudioTranscription(audioBlob); // Pass audio blob for transcription
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleAudioTranscription = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob);

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      setTranscription(result.text);
      onTranscription(result.text); // Pass transcribed text to parent component
    } catch (error) {
      console.error("Error transcribing audio:", error);
    }
  };

  return (
    <div>
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? "Stop Recording" : "Start Recording"}
      </button>
      {transcription && <p>Transcription: {transcription}</p>}
    </div>
  );
}
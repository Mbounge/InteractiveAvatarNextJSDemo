import type { StartAvatarResponse } from "@heygen/streaming-avatar";

import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents,
  TaskMode,
  TaskType,
  VoiceEmotion,
} from "@heygen/streaming-avatar";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Divider,
  Spinner,
  Chip,
  Tabs,
  Tab,
} from "@nextui-org/react";
import { useEffect, useRef, useState } from "react";
import { useMemoizedFn, usePrevious } from "ahooks";

import InteractiveAvatarTextInput from "./InteractiveAvatarTextInput";
import Report from "./report";

import Image from "next/image";
import kroni from "../public/kroni.svg"; // Replace with your actual image
import logo from "../public/GraetAI.svg"; 

import { AVATARS, STT_LANGUAGE_LIST } from "@/app/lib/constants";
import { read } from "fs";

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

type ChatMessage = {
  date: string; // ISO timestamp for the message
  type: "user" | "avatar";
  message: string; // The actual message content
};

export default function InteractiveAvatar({
  info,
  user,
  selectedLanguage,
  accessCode,
  personalized,
  greet,
}: InteractiveProps) {
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isLoadingRepeat, setIsLoadingRepeat] = useState(false);
  const [stream, setStream] = useState<MediaStream>();
  const [debug, setDebug] = useState<string>();
  const [knowledgeId, setKnowledgeId] = useState<string>("");
  const [avatarId, setAvatarId] = useState<string>(
    "dbd143f592e54e49a4c9e089957e2b94"
  );

  const [data, setData] = useState<StartAvatarResponse>();
  const [report, setReport] = useState(false);
  const [avatarMessageBuffer, setAvatarMessageBuffer] = useState<any>("");
  const [userMessage, setUserMessage] = useState<any>("");
  const [chatHistroy, setChatHistory] = useState<any>([]);
  const [text, setText] = useState<string>("");
  const mediaStream = useRef<HTMLVideoElement>(null);
  const avatar = useRef<StreamingAvatar | null>(null);
  const [chatMode, setChatMode] = useState("voice_mode");
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [ready, setReady] = useState(false);

  const [timer, setTimer] = useState(600); // Timer in seconds
  const timerRef = useRef<number | null>(null);

  const chatHistoryRef = useRef(chatHistroy);

  // useEffect(() => {
  //   console.log("Chat History Changed: ", chatHistroy);
  // }, [chatHistroy]);

  // TODO: improve this logic for personalized and greet
  useEffect(() => {
    //console.log("personalized, ", personalized);
    //console.log("greeting, ", greet);
    console.log(personalized)

    // Check if both personalized and greet are not empty strings
    if (personalized.trim() !== "" && greet.trim() !== "") {
      setReady(true); // Set ready to true
    } else {
      setReady(false); // Optional: Reset ready to false if one of them is empty
    }
  }, [personalized, greet]);

  useEffect(() => {
    if (stream) {
      timerRef.current = window.setInterval(() => {
        setTimer((prev) => {
          if (prev > 0) {
            return prev - 1;
          } else {
            clearInterval(timerRef.current!);
            timerRef.current = null;
            endSession(); // End session when timer reaches zero
            return 0;
          }
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    // Cleanup interval on component unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [stream]);

  // Format the countdown timer in MM:SS format
  const formatTimer = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  useEffect(() => {
    chatHistoryRef.current = chatHistroy;
  }, [chatHistroy]);

  async function fetchAccessToken() {
    try {
      const response = await fetch("/api/get-access-token", {
        method: "POST",
      });
      const token = await response.text();

      //console.log("Access Token:", token); // Log the token to verify

      return token;
    } catch (error) {
      console.error("Error fetching access token:", error);
    }

    return "";
  }

  const handleReportClose = () => {
    chatHistoryRef.current = [];
    setChatHistory([]);
    setReport(false);
    setTimer(600);
  };

  let mutableAvatarBuffer = ""; // Accumulates messages during AVATAR_TALKING_MESSAGE


  async function startSession() {
    setIsLoadingSession(true);
    const newToken = await fetchAccessToken();

    avatar.current = new StreamingAvatar({
      token: newToken,
    });

    avatar.current.on(StreamingEvents.AVATAR_START_TALKING, (e) => {
      //console.log("Avatar started talking", e);
    });

    avatar.current.on(StreamingEvents.AVATAR_TALKING_MESSAGE, (message) => {
      //console.log("Avatar talking message:", message.detail.message);

      // Append to the mutable buffer
      mutableAvatarBuffer += ` ${message.detail.message}`;

      // Optionally, update the React state for debugging purposes
      setAvatarMessageBuffer(mutableAvatarBuffer.trim());
    });

    avatar.current.on(StreamingEvents.USER_TALKING_MESSAGE, (message) => {
      const timestamp = new Date().toISOString(); // ISO format for full timestamp
      const newUserMessage = {
        date: timestamp,
        type: "user",
        message: message.detail.message,
      };
      //console.log("User talking message 2:", newUserMessage);

      setUserMessage(newUserMessage);

      setChatHistory((prev: any) => {
        const updatedHistory = [...prev, newUserMessage];
        //console.log("Updated Chat History with userMessage:", updatedHistory);
        return updatedHistory;
      });
    });

    // use a reset mechanism for capturing all user words
    avatar.current.on(StreamingEvents.USER_END_MESSAGE, (e) => {
      //console.log(e)
    });

    // use a reset mechanism for capturing all avatar words
    avatar.current.on(StreamingEvents.AVATAR_END_MESSAGE, () => {
      //console.log("This is the avatar's full message:", mutableAvatarBuffer);

      if (mutableAvatarBuffer.trim()) {
        const timestamp = new Date().toISOString();
        const finalAvatarMessage = {
          date: timestamp,
          type: "avatar",
          message: mutableAvatarBuffer.trim(),
        };

        // Update chatHistory with the final message
        setChatHistory((prev: any) => {
          const updatedHistory = [...prev, finalAvatarMessage];
          //console.log("Chat History after avatar message:", updatedHistory);
          return updatedHistory;
        });

        // Clear the mutable buffer and the React state
        mutableAvatarBuffer = "";
        setAvatarMessageBuffer("");
      } else {
        //console.warn("Avatar message buffer is empty; skipping update.");
      }
    });

    avatar.current.on(StreamingEvents.AVATAR_STOP_TALKING, (e) => {
      // this is the place we would concatenate all event messages of AI
      //console.log("Avatar stopped talking", e);
    });

    avatar.current.on(StreamingEvents.STREAM_DISCONNECTED, () => {
      //console.log("Stream disconnected");
      endSession();
      //console.log("Stream ended with chat History:", chatHistoryRef.current);
      setReport(true);
      // When the session ends - we send the email report to the user about the session
      // Report will contain a full summary of the session
      //
    });

    avatar.current?.on(StreamingEvents.STREAM_READY, (event) => {
      //console.log(">>>>> Stream ready:", event.detail);
      setStream(event.detail);
    });

    avatar.current?.on(StreamingEvents.USER_START, (event) => {
      //console.log(">>>>> User started talking:", event);
      setIsUserTalking(true);
    });

    avatar.current?.on(StreamingEvents.USER_STOP, (event) => {
      //console.log(">>>>> User stopped talking:", event);
      // this is the place we would concatenate all event messages of user
      setIsUserTalking(false);
    });

    try {
      const res = await avatar.current.createStartAvatar({
        quality: AvatarQuality.High,
        avatarName: avatarId,
        //knowledgeId: "", // Or use a custom `knowledgeBase`.
        knowledgeBase: personalized,
        voice: {
          voiceId: 'SBf77LFNjjOI1sA2T1y9',
          rate: 1.0, // 0.5 ~ 1.5
          emotion: VoiceEmotion.EXCITED,
        },
        language: selectedLanguage,
      });

      setData(res);
      // default to voice mode
      await avatar.current?.startVoiceChat({
        useSilencePrompt: false,
      });
      setChatMode("voice_mode");
    } catch (error) {
      console.error("Error starting avatar session:", error);
    } finally {
      setIsLoadingSession(false);
    }

    // Avatar initiates the start of the conversation
    // Need to use an LLM to generate specialized good personalized introductions - language specific
    // The start of the conversation sets the tone for how the rest of the conversation will go
    //"Hi Brandon! I’ve reviewed your GRAET profile, and I’m impressed by your leadership as a center for the Eastern Ontario Wild U18 AAA. Your recent stats and playmaking ability really stand out. It’s fantastic to meet you today. How are you feeling about your season so far?"
    await avatar.current
      .speak({
        text: greet,
        taskType: TaskType.REPEAT,
        taskMode: TaskMode.SYNC,
      })
      .catch((e) => {
        setDebug(e.message);
      });
  }

  async function endSession() {
    if (avatar.current) {
      await avatar.current.stopAvatar();
    }
  
    // Send email after stopping the avatar
    await sendChatHistory();
  
    // Reset stream state
    setStream(undefined);
  }

  const sendChatHistory = async () => {
    if (chatHistoryRef.current.length > 0) {
      try {
        // Format chat history with human-readable dates
        const formattedChatHistory = chatHistoryRef.current
          .map((chat: ChatMessage) => {
            const date = new Date(chat.date).toLocaleString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });
            return `${date} - [${chat.type.toUpperCase()}]: ${chat.message}`;
          })
          .join("\n");
  
        // Prepare data for API
        const payload = {
          subject: `${info.firstName} ${info.lastName} (${user.toUpperCase()})`,
          user_info: `Name: ${info.firstName} ${info.lastName}\nEmail: ${info.email}\nGRAET Profile: ${info.graetLink}\nUser Type: ${user}`,
          chat_history: formattedChatHistory,
          to_email: ["kroni+avatar@graet.com", "bo+avatar@graet.com"], // Add both recipients
        };
  
        // Call API
        const response = await fetch("/api/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
  
        const data = await response.json();
  
        if (response.ok) {
          console.log("Emails sent successfully:", data);
        } else {
          console.error("Failed to send emails:", data.error);
        }
      } catch (error) {
        console.error("Error while sending email:", error);
      }
    } else {
      console.warn("No chat history to send.");
    }
  };

  // send chatHistory transcript to our emails 
  // even when the user closes the window
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Prepare the chat history for sending
      if (chatHistoryRef.current.length > 0) {
        const formattedChatHistory = chatHistoryRef.current
          .map((chat: ChatMessage) => {
            const date = new Date(chat.date).toLocaleString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });
            return `${date} - [${chat.type.toUpperCase()}]: ${chat.message}`;
          })
          .join("\n");
  
        // Prepare the payload
        const payload = {
          subject: `${info.firstName} ${info.lastName} (${user.toUpperCase()})`,
          user_info: `Name: ${info.firstName} ${info.lastName}\nEmail: ${info.email}\nGRAET Profile: ${info.graetLink}\nUser Type: ${user}`,
          chat_history: formattedChatHistory,
          to_email: ["kroni+avatar@graet.com", "bo+avatar@graet.com"],
        };
  
        // Use navigator.sendBeacon to send the data
        const url = "/api/email"; // Replace with your endpoint
        const blob = new Blob([JSON.stringify(payload)], {
          type: "application/json",
        });
        navigator.sendBeacon(url, blob);
      }
    };
  
    // Add the event listener
    window.addEventListener("beforeunload", handleBeforeUnload);
  
    // Cleanup the event listener when the component unmounts
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);
  
  
  
  const previousText = usePrevious(text);
  useEffect(() => {
    if (!previousText && text) {
      avatar.current?.startListening();
    } else if (previousText && !text) {
      avatar?.current?.stopListening();
    }
  }, [text, previousText]);

  useEffect(() => {
    if (stream && mediaStream.current) {
      mediaStream.current.srcObject = stream;
      mediaStream.current.onloadedmetadata = () => {
        mediaStream.current!.play();
        setDebug("Playing");
      };
    }
  }, [mediaStream, stream]);

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-white gap-6">
      {/* Logo Section */}
      <div className="flex justify-center absolute top-6">
        <Image
          src={logo}
          alt="Graet Logo"
          height={300} // Adjust logo size as needed
          width={300}
        />
      </div>
  
      {/* Content Section */}
      <div className="flex flex-col items-center justify-center w-full max-w-4xl text-center gap-6">
        {report ? (
          <Report
            chatHistory={chatHistoryRef.current}
            onClose={handleReportClose}
            reportBool={report}
          />
        ) : stream ? (
          <div className="h-[500px] w-[900px] flex justify-center items-center relative">
            <video
              ref={mediaStream}
              autoPlay
              playsInline
              className="w-full h-full object-contain rounded-lg overflow-hidden"
            >
              <track kind="captions" />
            </video>
          </div>
        ) : isLoadingSession ? (
          <Spinner color="default" size="lg" />
        ) : (
          <div className="flex flex-col items-center gap-6">
            {/* Centered and Enlarged Image */}
            <Image src={kroni} alt="Kroni Avatar" height={350} width={350} />
  
            {/* Conditional Button or Loading State */}
            {ready ? (
              <Button
                className="bg-gradient-to-tr from-blue-700 to-blue-300 text-white py-4 px-8 rounded-lg flex items-center justify-center gap-2 shadow-lg hover:scale-105 transform transition"
                size="lg"
                onClick={startSession}
              >
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  ></path>
                </svg>
                Start Session
              </Button>
            ) : (
              <div className="flex flex-col items-center gap-4">
                {/* Spinner */}
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600 border-solid"></div>
                {/* Loading Text */}
                <p className="text-gray-600 text-sm font-medium">
                  Preparing the avatar for your session...
                </p>
              </div>
            )}
          </div>
        )}
      </div>
  
      {/* End Session Button and Timer Section */}
      {stream && (
      <div className="flex justify-between items-center w-full max-w-4xl px-6">
        {/* Session Duration */}
        <div className="text-left font-semibold text-gray-700">
          Session Duration: {formatTimer(timer)}
        </div>
        {/* End Session Button */}
        <Button
          className="bg-gradient-to-tr from-blue-700 to-blue-300 text-white py-2 px-6 rounded-lg hover:bg-blue-800 transition"
          size="md"
          onClick={endSession}
        >
          End Session
        </Button>
      </div>
    )}
    </div>
  );
}

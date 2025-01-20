import React, { useEffect, useState } from "react";
import emailjs from "emailjs-com";

type Props = {
  onClose: () => void;
  reportBool: boolean;
};

type ChatMessage = {
  date: string; // ISO timestamp for the message
  type: "user" | "avatar";
  message: string; // The actual message content
};

const Report = ({ onClose, reportBool }: Props) => {
  const [report, setReport] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

 // kroni+avatar@graet.com
 //  bo+avatar@graet.com

 // service_id = service_z9tghof
 // template_id = template_ywnait7

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-white">
    {/* Message */}
    <p className="text-md font-semibold text-[#2B21C1] mb-6">
      We will send you the report as soon as possible.
    </p>

    {/* Return Home Button */}
    <a
      href="https://www.graet.com"
      className="px-6 py-3 text-sm font-medium text-white bg-[#2B21C1] rounded-lg hover:bg-blue-700 transition"
    >
      Return Home
    </a>
  </div>
  );
};

export default Report;


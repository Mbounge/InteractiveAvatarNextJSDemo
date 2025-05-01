"use client";

import React, { useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";

const Gemini: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [answer, setAnswer] = useState<string>("");
  const [error, setError] = useState<string>("");


  const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);

  

  const handleCall = async () => {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = "Explain how AI works";

      const result = await model.generateContentStream(prompt);

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        console.log(chunkText);
      }
    } catch {
      console.log("error");
    }
  };

  const handleImages = async () => {
    setLoading(true);
    setAnswer("");
    setError("");

    try {
      // You can pass additional parameters (like a custom prompt) in the body if needed.
      const response = await fetch("/api/gemini3", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
            bio: `FirstName:MaximilianLastName:HauslerGoalieButterflyShootsLeftHeight6'2"Weight148lbsNationalityITDate of birthMay 15, 2009InstitutionNot setGraduationNot set`
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate answer");
      }

      // Set the generated answer from the API response
      setAnswer(data.answer);
    } catch (err: any) {
      console.error("Error calling Gemini API:", err);
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold mb-4">Gemini Generation</h1>
      <button
        onClick={handleImages}
        className="px-6 py-3 mb-4 text-white bg-blue-600 rounded hover:bg-blue-700 transition"
      >
        {loading ? "Generating..." : "Generate Answer"}
      </button>
      {answer && (
        <div className="bg-green-100 p-4 rounded shadow">
          <h2 className="font-semibold">Generated Answer:</h2>
          <p>{answer}</p>
        </div>
      )}
      {error && (
        <div className="bg-red-100 p-4 rounded shadow">
          <h2 className="font-semibold">Error:</h2>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};

export default Gemini;

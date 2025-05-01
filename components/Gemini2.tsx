"use client";

import React, { useState } from "react";

const Gemini2: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const handleDownloadAudio = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/geminiplay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // Pass any necessary data here (e.g., athlete bio)
        body: JSON.stringify({
          bio: `FirstName:LucasLastName:KoprivnanskyRight wingerPlaymakerShootsRightHeight5'9"Weight159lbsNationalitySKDate of birthNovember 25, 2008InstitutionZS Hodzova TrencinGraduation2027`
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || "Failed to generate audio");
      }

      // Get the binary data as a Blob.
      const audioBlob = await response.blob();

      // Create a URL for the blob.
      const url = window.URL.createObjectURL(audioBlob);

      // Create a temporary link element and trigger the download.
      const a = document.createElement("a");
      a.href = url;

      // Optionally, you can try to extract the file name from the response headers.
      // For now, we'll use a default file name.
      a.download = "generatedAudio.mp3";
      document.body.appendChild(a);
      a.click();
      a.remove();

      // Revoke the object URL to free memory.
      window.URL.revokeObjectURL(url);
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
        onClick={handleDownloadAudio}
        className="px-6 py-3 mb-4 text-white bg-blue-600 rounded hover:bg-blue-700 transition"
      >
        {loading ? "Generating Audio..." : "Generate and Download Audio"}
      </button>
      {error && (
        <div className="bg-red-100 p-4 rounded shadow">
          <h2 className="font-semibold">Error:</h2>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};

export default Gemini2;

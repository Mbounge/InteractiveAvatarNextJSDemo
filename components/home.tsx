"use client";

import React, { useState } from "react";
import Languages from "./language";
import Image from "next/image";
import kroni from "../public/kroni.svg"; // Replace with your actual image
import logo from "../public/logo-1.svg"; // Replace with your actual logo

const Home: React.FC = () => {
  const [userType, setUserType] = useState("parent");
  const [showLanguages, setShowLanguages] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    graetLink: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleTypeChange = (type: string) => {
    setUserType(type);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      formData.firstName &&
      formData.lastName &&
      formData.email &&
      formData.graetLink
    ) {
      // Extract the username from the GRAET link
      // Extract the username from the GRAET link
      const usernameMatch = formData.graetLink.match(/graet\.com\/([^\/]+)/);
      const username = usernameMatch ? usernameMatch[1] : null;

      if (!username) {
        alert("Invalid GRAET link. Please enter a valid profile link.");
        return;
      }

      setShowLanguages(true);
    } else {
      alert("Please fill out all fields before continuing.");
    }
  };

  if (showLanguages) {
    return <Languages info={formData} user={userType} />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white">
      <div className="flex justify-center mt-12 mb-3">
        <Image src={logo} alt="Graet Logo" height={300} width={300} />
      </div>

      <div className="flex flex-row items-center justify-between w-full max-w-6xl mt-8">
        {/* Form Section */}
        <div className="flex flex-col w-1/2 px-8">
          <form
            id="registration-form"
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            <div className="mb-6">
              <p className="text-lg font-semibold text-gray-700">
                Are you a parent or a player?
              </p>
              <div className="flex gap-4 mt-4">
                <button
                  type="button"
                  onClick={() => handleTypeChange("parent")}
                  className={`px-12 py-4 rounded-md text-sm font-medium ${
                    userType === "parent"
                      ? "bg-[#2B21C1] text-white"
                      : "bg-white text-[#2B21C1] border border-[#2B21C1]"
                  }`}
                >
                  Parent
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange("player")}
                  className={`px-12 py-4 rounded-md text-sm font-medium ${
                    userType === "player"
                      ? "bg-[#2B21C1] text-white"
                      : "bg-white text-[#2B21C1] border border-[#2B21C1]"
                  }`}
                >
                  Player
                </button>
              </div>
              <input type="hidden" name="user_type" value={userType} />
            </div>

            <p className="text-lg font-semibold text-gray-700">
              Add your details to get started
            </p>
            <div className="space-y-4">
              <input
                type="text"
                className="w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-[#2B21C1] focus:outline-none"
                name="firstName"
                placeholder="First name"
                value={formData.firstName}
                onChange={handleInputChange}
                required
              />
              <input
                type="text"
                className="w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-[#2B21C1] focus:outline-none"
                name="lastName"
                placeholder="Last name"
                value={formData.lastName}
                onChange={handleInputChange}
                required
              />
              <input
                type="email"
                className="w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-[#2B21C1] focus:outline-none"
                name="email"
                placeholder="E-mail"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
              <div>
                <label
                  htmlFor="graetLink"
                  className="block text-sm font-medium text-gray-700"
                >
                  Player's GRAET link
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-[#2B21C1] focus:outline-none mt-1"
                  id="graetLink"
                  name="graetLink"
                  placeholder="GRAET link"
                  value={formData.graetLink}
                  onChange={handleInputChange}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Paste a link to the player's profile.
                </p>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 text-sm font-medium text-white bg-[#2B21C1] rounded-full hover:bg-[#2418A5] transition"
            >
              Continue
            </button>
          </form>
        </div>

        {/* Right Image Section */}
        <div className="flex flex-col items-center justify-center w-1/2">
          <Image src={kroni} alt="Kroni" height={450} width={450} />
        </div>
      </div>
    </div>
  );
};

export default Home;

"use client";
import Image from "next/image";
import logo from "../public/logo-1.svg";

import Home from "@/components/home";

export default function App() {
  return (
    <div className="w-screen h-screen flex flex-col">
      <div className="w-[900px] flex flex-col items-start justify-start mx-auto">
        <div className="w-full">
          <Home />
        </div>
      </div>
    </div>
  );
}

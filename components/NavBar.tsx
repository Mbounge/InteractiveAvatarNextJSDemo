"use client";

import {
  Link,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
} from "@nextui-org/react";
import Image from "next/image";
import { ThemeSwitch } from "./ThemeSwitch";
import logo from "../public/Graet_Logo.svg";

export default function NavBar() {
  return (
    <Navbar
      className="w-full shadow-lg bg-white dark:bg-gray-900 py-2 px-4 transition-all duration-300"
      maxWidth="full"
    >
      <NavbarBrand className="flex items-center space-x-4">
        {/* Logo */}
      </NavbarBrand>

      {/* Center Title for Mobile */}
      <div className="absolute flex left-1/2 transform -translate-x-1/2  text-2xl font-bold text-[#0e0c66] dark:text-white">
        <Link
          isExternal
          aria-label="Graet"
          href="https://www.graet.com/"
          className="flex items-center"
        >
          <Image
            src={logo}
            alt="Graet Logo"
            height={150}
            width={150}
            className="hover:scale-105 transition-transform duration-300"
          />
        </Link>
        <div className="text-xl font-bold ml-2 mt-1 text-[#0e0c66] dark:text-white">
          AI Sports Advisor
        </div>
      </div>

      {/* Right-side Links */}
      <NavbarContent justify="end" className="flex items-center space-x-4">
        {/* Theme Switch */}
        
      </NavbarContent>
    </Navbar>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import logo from "@/media/SimliLogoV2.svg";

// Full reload on click: clicking the logo resets the demo (this app has a single page).
export default function SimliHeaderLogo() {
  return (
    <Link
      href="/"
      onClick={(e) => {
        e.preventDefault();
        window.location.reload();
      }}
      className="cursor-pointer"
    >
      <Image src={logo} alt="Simli logo" priority />
    </Link>
  );
}

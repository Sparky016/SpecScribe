import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SpecScribe AR - Temporal Architecture & Decision Scrubber",
  description: "Spatial whiteboarding, Draw.io synchronization, and temporal decision intelligence for Snap Spectacles",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-[#0a0e14] text-[#e6edf3]">
        {children}
      </body>
    </html>
  );
}

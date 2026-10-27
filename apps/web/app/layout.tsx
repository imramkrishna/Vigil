import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vigil — Autonomous Engineering Operations & Incident Copilot",
  description:
    "Multi-tenant AI Engineering Operations Copilot for cited runbook Q&A, parallel incident triage, role-gated approvals, and evidence-backed postmortems.",
  icons: {
    icon: [
      { url: "/vigil.svg", type: "image/svg+xml" },
      { url: "/vigil.png", type: "image/png" },
    ],
    apple: "/vigil.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

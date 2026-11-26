import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vigil — Deployment Failure Evaluation & Fix Copilot",
  description:
    "AI deployment failure evaluator that correlates recent deploys, live multi-cloud logs, and indexed runbooks to diagnose root causes and suggest actionable fixes.",
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
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#07080a] text-white selection:bg-[#ff6b4a]/30 selection:text-white">
        <Navbar />
        {children}
      </body>
    </html>
  );
}

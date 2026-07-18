import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Karate AI Assistant | WKF 2026",
  description: "Asisten AI Peraturan Karate WKF 2026 untuk Karateka, Wasit, dan Juri",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${inter.className} bg-[#0b1014] overflow-hidden`}>{children}</body>
    </html>
  );
}

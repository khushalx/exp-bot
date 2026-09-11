import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oddly — Stay curious.",
  description: "A little artificial. A lot of possibility. A thoughtful chat companion powered by GPT-OSS 120B and Groq.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

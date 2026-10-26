import type { Metadata, Viewport } from "next";
import { Noto_Sans_Telugu } from "next/font/google";
import "./globals.css";

// Ship Telugu glyphs with the app: the Tesla system font may not include them.
const telugu = Noto_Sans_Telugu({
  subsets: ["telugu"],
  variable: "--font-telugu",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Tesla Lyrics",
  description:
    "A companion display that shows synced Spotify lyrics in your Tesla. The native Spotify app plays the audio; this shows the words in time.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#08090c",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={telugu.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}

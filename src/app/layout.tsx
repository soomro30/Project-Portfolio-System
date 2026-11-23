import type { Metadata } from "next";
import localFont from "next/font/local";

import { SessionAppProvider } from "@/components/auth/session-provider";
import "./globals.css";

const plexSans = localFont({
  variable: "--font-plex-sans",
  display: "swap",
  preload: false,
  src: [
    { path: "../../node_modules/@ibm/plex/IBM-Plex-Sans/fonts/complete/woff2/IBMPlexSans-Regular.woff2", weight: "400" },
    { path: "../../node_modules/@ibm/plex/IBM-Plex-Sans/fonts/complete/woff2/IBMPlexSans-Medium.woff2", weight: "500" },
    { path: "../../node_modules/@ibm/plex/IBM-Plex-Sans/fonts/complete/woff2/IBMPlexSans-SemiBold.woff2", weight: "600" },
    { path: "../../node_modules/@ibm/plex/IBM-Plex-Sans/fonts/complete/woff2/IBMPlexSans-Bold.woff2", weight: "700" },
  ],
});

const plexMono = localFont({
  variable: "--font-plex-mono",
  display: "swap",
  preload: false,
  src: [
    { path: "../../node_modules/@ibm/plex/IBM-Plex-Mono/fonts/complete/woff2/IBMPlexMono-Regular.woff2", weight: "400" },
    { path: "../../node_modules/@ibm/plex/IBM-Plex-Mono/fonts/complete/woff2/IBMPlexMono-Medium.woff2", weight: "500" },
  ],
});

export const metadata: Metadata = {
  title: "IMKAN Digital Portfolio Tracker",
  description:
    "Enterprise project tracking and reporting platform for IMKAN digital transformation initiatives.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full">
        <SessionAppProvider>{children}</SessionAppProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import "./globals.css";

/*
 * In production, replace these with Google Font imports:
 *   import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
 * The local font declarations below use system font fallbacks so the build
 * succeeds even without network access to Google Fonts.
 */
const jakarta = localFont({
  src: [],
  variable: "--font-jakarta",
  fallback: [
    "Plus Jakarta Sans",
    "ui-sans-serif",
    "system-ui",
    "-apple-system",
    "sans-serif",
  ],
});

const jetbrains = localFont({
  src: [],
  variable: "--font-jetbrains",
  fallback: [
    "JetBrains Mono",
    "ui-monospace",
    "SFMono-Regular",
    "monospace",
  ],
});

export const metadata: Metadata = {
  title: "Parkir - Smart Parking Dashboard",
  description: "Intelligent parking management system dashboard",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages();

  return (
    <html lang="id" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${jakarta.variable} ${jetbrains.variable} font-sans antialiased bg-surface-base text-text-primary`}
      >
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

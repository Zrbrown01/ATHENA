import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://www.athenacms.app"),
  title: "Athena · Workers’ Compensation Defense OS",
  description: "Matter-centered operations for workers’ compensation defense firms.",
  applicationName: "Athena",
  icons: {
    icon: [{ url: "/brand/athena-app-icon.png", type: "image/png", sizes: "512x512" }],
    apple: [{ url: "/brand/athena-app-icon.png", type: "image/png", sizes: "512x512" }],
  },
  alternates: { canonical: "/" },
  openGraph: {
    title: "Athena · Workers’ Compensation Defense OS",
    description: "Know the file. See what comes next.",
    url: "/",
    siteName: "Athena",
    type: "website",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "Athena logo and workers’ compensation defense operating system" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Athena · Workers’ Compensation Defense OS",
    description: "Know the file. See what comes next.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

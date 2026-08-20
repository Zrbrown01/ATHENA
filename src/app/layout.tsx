import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://www.athenacms.app"),
  title: "Athena · Workers’ Compensation Defense OS",
  description: "Matter-centered operations for workers’ compensation defense firms.",
  applicationName: "Athena",
  alternates: { canonical: "/" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

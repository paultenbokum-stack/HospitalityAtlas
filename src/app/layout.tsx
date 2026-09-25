import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atlas CRM",
  description: "Prospect lists, sales activity and outcomes for small sales teams.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

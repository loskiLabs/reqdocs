import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReqDocs | Arrive ready the first time",
  description:
    "Prepare a current document pack and share only what authorised service staff need.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

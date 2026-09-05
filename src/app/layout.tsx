import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Dotnapps Invoice",
    template: "%s · Dotnapps Invoice",
  },
  description:
    "Create. Quote. Invoice. Share. Get Paid. GST-aware quotations, invoicing, payments and bulk bill sharing for freelancers, agencies and SMEs.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}

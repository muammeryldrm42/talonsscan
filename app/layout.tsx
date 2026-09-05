import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Talons Scan. Arc mainnet screener", description: "Every USDC pair on Arc mainnet, read live from the chain in your browser." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="min-h-screen bg-ink text-paper">{children}</body></html>;
}

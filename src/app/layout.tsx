import type { Metadata } from "next";
import "@/app/globals.css";
import { Navbar } from "@/components/Navbar";
import { ConditionalNavbar } from "@/components/ConditionalNavbar";

export const metadata: Metadata = {
  title: "Duel Simulator",
  description: "Deck builder e simulador para o formato Edison — projeto de fã, não afiliado à Konami.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-br">
      <body className="min-h-screen bg-edison-bg text-gray-100">
        <ConditionalNavbar>
          <Navbar />
        </ConditionalNavbar>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}

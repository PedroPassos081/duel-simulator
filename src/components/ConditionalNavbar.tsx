"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const FULLSCREEN_ROUTES = ["/login", "/register", "/duel/play"];

export function ConditionalNavbar({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isFullscreenPage = FULLSCREEN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isFullscreenPage) return null;

  return children;
}

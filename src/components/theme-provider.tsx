// src/components/theme-provider.tsx
"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
// --- تم التعديل هنا --- VVV
import type { ThemeProviderProps } from "next-themes"; // غيرنا المسار

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
  }

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
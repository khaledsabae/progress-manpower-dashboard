// src/app/layout.tsx
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import "./globals.css";
// --- استيراد ThemeProvider --- VVV
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// --- يمكنك تحديث الـ Metadata هنا --- VVV
export const metadata: Metadata = {
  title: "Mowaih Project Dashboard", // مثال
  description: "Dashboard for Mowaih PV 380/110 kV BSP Project", // مثال
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // --- إضافة suppressHydrationWarning للـ <html> --- VVV
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* --- إضافة ThemeProvider حول children --- VVV */}
        <ThemeProvider
          attribute="class" // مهم عشان يستخدم class="dark"
          defaultTheme="system" // يبدأ بثيم النظام (ممكن تغيرها لـ "light" أو "dark")
          enableSystem // يسمح باختيار ثيم النظام
          disableTransitionOnChange // يمنع وميض عند التحميل أو التغيير (مُحسن)
        >
          {/* ممكن هنا تضيف أي Header أو Sidebar ثابت */}
          {children}
          {/* الـ ChatbotDrawer غالبا هيكون جزء من الـ children لو هو في page.tsx */}
        </ThemeProvider>
      </body>
    </html>
  );
}

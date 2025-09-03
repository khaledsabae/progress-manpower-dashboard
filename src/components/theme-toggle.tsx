// src/components/theme-toggle.tsx
"use client"; // لازم يكون Client Component

import * as React from "react";
import { Moon, Sun } from "lucide-react"; // أيقونات
import { useTheme } from "next-themes"; // Hook للتحكم في الثيم

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"; // مكونات Dropdown من Shadcn

export function ModeToggle() {
  // استخدام الـ Hook للحصول على دالة تغيير الثيم
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* زرار الأيقونة اللي هيظهر */}
        <Button variant="outline" size="icon" aria-label="Toggle theme">
          {/* أيقونة الشمس (تظهر في الـ Light Mode) */}
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          {/* أيقونة القمر (تظهر في الـ Dark Mode) */}
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          {/* نص للقارئات الشاشة */}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      {/* محتوى القائمة المنسدلة */}
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
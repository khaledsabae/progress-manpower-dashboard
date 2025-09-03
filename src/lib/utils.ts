<<<<<<< HEAD
import { type ClassValue, clsx } from "clsx"
=======
import { clsx, type ClassValue } from "clsx"
>>>>>>> d51fef8a78b10b4d445a0336e3a04e83e54cc6b7
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
<<<<<<< HEAD

export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date)
}

export function parsePercentage(value: string): number {
  const parsed = parseFloat(value.replace('%', ''))
  return isNaN(parsed) ? 0 : parsed
}

export function parseNumber(value: string): number {
  const parsed = parseFloat(value)
  return isNaN(parsed) ? 0 : parsed
}
=======
>>>>>>> d51fef8a78b10b4d445a0336e3a04e83e54cc6b7

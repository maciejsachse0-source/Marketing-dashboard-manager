import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Wartość z bazy do pola formularza: null i undefined dają pusty string.
 * Skraca długie łańcuchy `x?.pole ?? ''`, które same w sobie podbijają
 * złożoność cyklomatyczną (Z11) bez żadnego realnego rozgałęzienia.
 */
export function fieldText(v: string | number | null | undefined): string {
  return v === null || v === undefined ? '' : String(v);
}

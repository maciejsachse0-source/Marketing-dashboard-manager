import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * F7-15: `label-*` to własne utility z `globals.css` (kanon mikro-etykiety).
 * Bez zgłoszenia ich jako grupy `font-size` twMerge nie wie, że kolidują
 * z `text-sm` z wariantu `Button`, więc zostawia oba — rozmiar wygrywa nasz,
 * ale wysokość wiersza zostaje po `text-sm` i element rośnie o ułamek piksela.
 * Zmierzone na przycisku skrótów w panelu bocznym: 21 px przed, 20,28 px po.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        'label-micro',
        'label-micro-wide',
        'label-micro-wider',
        'label-mini',
        'label-mini-wide',
        'label-mini-wider',
      ],
    },
  },
});

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

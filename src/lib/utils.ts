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

/**
 * Halo dotyku 44 px dla odnośników nawigacji (F7-25). Guziki `Button` mają ten
 * sam zestaw klas wpisany w wariant, ale nawigacja w pasku bocznym to zwykłe
 * `<a>`, którego halo omijało: pozycje główne miały 36 px, podpozycje 31 px,
 * odnośniki agentów 24 px. Reguła powstaje wyłącznie pod `pointer: coarse`,
 * więc na myszy układ zostaje piksel w piksel.
 *
 * Wyjątek świadomy: wiersze ganta (`gantt-row-rail.tsx`,
 * `gantt-narrative-row.tsx`) halo NIE dostają, bo przy wysokości wiersza
 * poniżej 30 px sąsiednie halo zachodziłyby na siebie i przechwytywały
 * kliknięcia obok. Oznaczone tam `data-dense`, audyt je pomija.
 */
export const HALO_DOTYK =
  "relative pointer-coarse:after:absolute pointer-coarse:after:top-1/2 pointer-coarse:after:left-1/2 pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-['']";

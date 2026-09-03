'use client';

import { useState } from 'react';

/**
 * Reset stanu przy zmianie propa — wzorzec „dostosowania stanu w trakcie
 * renderu" z dokumentacji Reacta (You Might Not Need an Effect).
 *
 * Zamiast `useEffect(() => setX(prop), [prop])`, który commituje nieaktualny
 * render, a dopiero potem drugi z poprawnym stanem, React przerywa render
 * i powtarza go od razu, zanim cokolwiek trafi na ekran. Jedno malowanie
 * zamiast dwóch i zero migotania starą wartością.
 *
 * `key` porównywany jest przez `Object.is`, więc dla obiektów podaj wartość
 * prymitywną (np. `date.getTime()`), nie samą referencję.
 */
export function useResetOnChange(key: unknown, reset: () => void): void {
  const [prev, setPrev] = useState(key);
  if (!Object.is(prev, key)) {
    setPrev(key);
    reset();
  }
}

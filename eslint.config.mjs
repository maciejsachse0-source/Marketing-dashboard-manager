// eslint-config-next 16.2.4 ships native flat configs, so there is no FlatCompat
// here. Going through @eslint/eslintrc crashed ESLint 10 outright
// ("Converting circular structure to JSON"), and the compat layer bought nothing.
// The version is pinned in package.json to exactly the `next` version this repo
// runs; an unpinned range would silently pull rules the framework does not match.
import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'drizzle/migrations/**',
      'perf/**',
      'next-env.d.ts',
    ],
  },

  ...coreWebVitals,
  ...typescript,

  {
    files: ['**/*.{ts,tsx,js,jsx,mjs}'],
    rules: {
      // Z11: no NEW function above cyclomatic complexity 10.
      complexity: ['error', 10],
    },
  },

  {
    // Z3: every action element renders <Button> from src/components/ui/button.tsx.
    // F3 zmigrowalo wszystkie 89 zastanych guzikow, wiec od F3-05 regula jest
    // bledem, bez listy wyjatkow. Nowy surowy <button> nie przejdzie `npm run lint`.
    files: ['src/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXOpeningElement[name.name="button"]',
          message:
            'Uzyj <Button> z @/components/ui/button. Brakuje wariantu? Dodaj wariant, nie nowy komponent.',
        },
      ],
    },
  },

  // GRANDFATHER, kurczy sie do zera. Kazda regula ma WLASNA liste plikow, wiec
  // plik wypisuje sie z jednej reguly, nie z calego worka na raz. Zjechanie na
  // 'warn' TYLKO tutaj trzyma `npm run lint` zielony dla nowego kodu, zamiast
  // zamieniac cala bramke w szum. Regula: z tych list sie WYPISUJEMY, nigdy do
  // nich nie dopisujemy.
  // F7-01 zamkniete: `react-hooks/set-state-in-effect` nie ma juz zadnego
  // trafienia, wiec cala jego lista znikla stad razem z regula.
  // F7-02 zamkniete: `react-hooks/purity` tak samo. Trzy z pieciu trafien byly
  // w komponentach serwerowych i maja tam lokalne `eslint-disable-next-line`
  // z uzasadnieniem; dwa w komponentach klienckich zostaly naprawione.
  // F7-03 zamkniete: `react-hooks/immutability` i `react-hooks/refs` tak samo,
  // obie listy znikly.
  // F7-04 zamkniete: `@next/next/no-html-link-for-pages` tak samo.
  // F7-05 zamkniete: `react/no-unescaped-entities` tak samo. Zostala jedna lista:
  // zlozonosc cyklomatyczna (F7-06).

  {
    // GRANDFATHER Z11 (F7-06, F7-13): 33 zastane funkcje ponad progiem 10
    // w 24 plikach (bylo 58 w 43, potem 40 w 29). Lista ma sie kurczyc.
    // F7-13 zamkniete: wszystkie piec sciezek `calendar/gantt-*` wypisane —
    // zadna funkcja w tych plikach nie przekracza juz zlozonosci 10.
    files: [
      'drizzle/seed-catalog.ts',
      'scripts/migrate-templates-flexible.ts',
      'src/app/api/csv/route.ts',
      'src/app/calendar/page.tsx',
      'src/app/campaigns/\\[id\\]/page.tsx',
      'src/app/page.tsx',
      'src/app/productions/\\[id\\]/page.tsx',
      'src/app/productions/list/page.tsx',
      'src/components/agents/agent-form.tsx',
      'src/components/analytics/analytics-shell.tsx',
      'src/components/analytics/csv-dropzone.tsx',
      'src/components/artists/artists-shell.tsx',
      'src/components/campaigns/campaign-wizard.tsx',
      'src/components/campaigns/campaigns-list.tsx',
      'src/components/campaigns/gantt-narrative-row.tsx',
      'src/components/campaigns/milestones-tracker.tsx',
      'src/components/campaigns/timeline.tsx',
      'src/components/inline-edit.tsx',
      'src/components/periods-slider.tsx',
      'src/components/productions/artist-picker.tsx',
      'src/components/productions/production-drawer.tsx',
      'src/components/productions/production-step-row.tsx',
      'src/components/productions/production-step-tracker.tsx',
      'src/components/productions/production-wizard.tsx',
    ],
    rules: { 'complexity': 'warn' },
  },


];

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
    // GRANDFATHER Z11 (F7-06): 58 zastanych funkcji ponad progiem 10. Lista ma sie kurczyc.
    // Sciezki `calendar/gantt-*` NIE sa nowym dlugiem — to ten sam zastany kod,
    // ktory w F2-02 przeniosl sie z `gantt-view.tsx` (2545 linii) do jedenastu
    // plikow. Wypisujemy sie z tego przez F7-13.
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
      'src/components/artists/artist-dialog.tsx',
      'src/components/artists/artists-shell.tsx',
      'src/components/calendar/gantt-milestone-labels.tsx',
      'src/components/calendar/gantt-milestones.tsx',
      'src/components/calendar/gantt-row-model.ts',
      'src/components/calendar/gantt-row.tsx',
      'src/components/calendar/gantt-substep-bar.tsx',
      'src/components/calendar/gantt-toolbar.tsx',
      'src/components/campaigns/campaign-template-form.tsx',
      'src/components/campaigns/campaign-wizard.tsx',
      'src/components/campaigns/campaigns-list.tsx',
      'src/components/campaigns/gantt-narrative-row.tsx',
      'src/components/campaigns/milestones-tracker.tsx',
      'src/components/campaigns/timeline.tsx',
      'src/components/inline-edit.tsx',
      'src/components/periods-slider.tsx',
      'src/components/productions/artist-avatar.tsx',
      'src/components/productions/artist-picker.tsx',
      'src/components/productions/production-drawer.tsx',
      'src/components/productions/production-step-row.tsx',
      'src/components/productions/production-step-tracker.tsx',
      'src/components/productions/production-wizard.tsx',
      'src/components/productions/productions-list.tsx',
      'src/components/templates/template-form.tsx',
      'src/components/videographers/videographer-dialog.tsx',
      'src/lib/agents/widget.ts',
      'src/lib/csv-mappers.ts',
      'src/lib/dates.ts',
      'src/lib/production-work-folder.ts',
      'src/server/actions/production-folder.ts',
      'src/server/actions/production-steps.ts',
      'src/server/actions/productions.ts',
    ],
    rules: { 'complexity': 'warn' },
  },


];

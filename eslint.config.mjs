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

  {
    // GRANDFATHER, kurczy się do zera. Te 47 plików weszły do przebudowy z 91
    // błędami: 63 x complexity (Z11 dotyczy NOWEGO kodu, zastany wolno zostawić,
    // ale nie powiększyć), 21 x reguły react-hooks z Reacta 19 (set-state-in-effect,
    // purity, immutability, refs), 5 x no-unescaped-entities, 2 x
    // no-html-link-for-pages. Wszystkie mają issues w F7 (F7-01 do F7-05).
    // Zjechanie na 'warn' TYLKO tutaj trzyma `npm run lint` zielony dla nowego kodu,
    // zamiast zamieniać całą bramkę w szum, który każdy zaraz zacznie ignorować.
    // Reguła: z tej listy się WYPISUJEMY, nigdy do niej nie dopisujemy.
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
      'src/components/analytics/post-dialog.tsx',
      'src/components/artists/artist-dialog.tsx',
      'src/components/artists/artists-shell.tsx',
      'src/components/calendar/gantt-toolbar.tsx',
      // F2-02: `gantt-view.tsx` (2545 linii) rozpadł się na jedenaście plików.
      // Poniższe ścieżki NIE są nowym długiem — to ten sam, zastany kod, który
      // zmienił plik. Bilans: przed podziałem gant miał 8 zgłoszeń (7 x complexity,
      // 1 x purity), po podziale ma 10, bo `GanttRowView` o złożoności 55 rozpadł
      // się na trzy funkcje o złożonościach 18, 20 i 11 (suma 49, czyli mniej).
      // Wypisujemy się z tego stąd przez F7-13, nie przez dopisywanie kolejnych.
      'src/components/calendar/gantt-view.tsx',
      'src/components/calendar/gantt-row.tsx',
      'src/components/calendar/gantt-row-model.ts',
      'src/components/calendar/gantt-row-placement.ts',
      'src/components/calendar/gantt-milestones.tsx',
      'src/components/calendar/gantt-milestone-labels.tsx',
      'src/components/calendar/gantt-substep-bar.tsx',
      'src/components/campaigns/apply-template-button.tsx',
      'src/components/campaigns/campaign-periods-editor.tsx',
      'src/components/campaigns/campaign-template-form.tsx',
      'src/components/campaigns/campaign-wizard.tsx',
      'src/components/campaigns/campaigns-list.tsx',
      'src/components/campaigns/gantt-narrative-row.tsx',
      'src/components/campaigns/milestones-tracker.tsx',
      'src/components/campaigns/narrative-section.tsx',
      'src/components/campaigns/timeline.tsx',
      'src/components/command-palette.tsx',
      'src/components/inline-edit.tsx',
      'src/components/periods-slider.tsx',
      'src/components/productions/artist-avatar.tsx',
      'src/components/productions/artist-picker.tsx',
      'src/components/productions/production-drawer.tsx',
      'src/components/productions/production-step-row.tsx',
      'src/components/productions/production-step-tracker.tsx',
      'src/components/productions/production-wizard.tsx',
      'src/components/productions/productions-list.tsx',
      'src/components/productions/t1-start-editor.tsx',
      'src/components/sidebar.tsx',
      'src/components/templates/template-form.tsx',
      'src/components/videographers/videographer-dialog.tsx',
      'src/lib/agents/widget.ts',
      'src/lib/category-sequence.ts',
      'src/lib/csv-mappers.ts',
      'src/lib/dates.ts',
      'src/lib/production-work-folder.ts',
      'src/server/actions/production-folder.ts',
      'src/server/actions/production-steps.ts',
      'src/server/actions/productions.ts',
    ],
    rules: {
      complexity: 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react/no-unescaped-entities': 'warn',
      '@next/next/no-html-link-for-pages': 'warn',
    },
  },
];

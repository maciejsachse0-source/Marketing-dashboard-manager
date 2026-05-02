'use client';

import { useState } from 'react';
import {
  Megaphone,
  Film,
  ChartGantt,
  FolderOpen,
  Folder,
  Video,
  Scissors,
  Send,
  Music,
  Camera,
  FileText,
  Image as ImageIcon,
  Calendar,
  CircleDot,
  HelpCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export function HelpDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Pomoc — instrukcja dyspozytorni"
        title="Pomoc — kliknij ?, żeby zobaczyć instrukcję"
        className="group inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-border/60 text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-foreground/40 transition"
      >
        <span>Pomoc</span>
        <span className="grid place-items-center w-3.5 h-3.5 rounded-full bg-muted/60 group-hover:bg-foreground group-hover:text-background transition">
          <HelpCircle className="w-2.5 h-2.5" strokeWidth={2.5} />
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">
              Dyspozytornia · jak prowadzić zespół do nagrywek
            </DialogTitle>
            <DialogDescription>
              Pełny obieg od pomysłu do publikacji — kampania, produkcja, pipeline
              i foldery na pliki. Czytaj jak instrukcję zakładania własnej ekipy.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-7 pt-2 text-sm leading-relaxed">
            <Section
              num={1}
              icon={<Megaphone className="w-4 h-4" />}
              title="Założenie kampanii"
              path="/campaigns/list → „+ Nowa kampania”"
            >
              <p>
                Kampania to <b>parasol narracyjny</b> — np. „Singiel Świt”,
                „Trasa jesień 2026”. Trzyma cel (KPI), datę startu i kolejne fazy
                (build-up → teaser → reveal → premiera → afterglow). Produkcje
                podpinasz pod nią później.
              </p>
              <Steps>
                <Step n={1}>
                  Wejdź w <Code>Kampanie → Lista kampanii</Code> i kliknij{' '}
                  <Pill>+ Nowa kampania</Pill>.
                </Step>
                <Step n={2}>
                  <b>Krok 1 — Szablon.</b> Wybierz szablon (np. „Singiel
                  premierowy”, „Trasa koncertowa”). Szablon ustawia gotową oś
                  faz: build-up, teaser, reveal, release, afterglow.
                </Step>
                <Step n={3}>
                  <b>Krok 2 — Detale.</b> Wpisz nazwę, wizję / cel
                  („dlaczego ta kampania istnieje”), datę startu (kickoff = T-0
                  całej kampanii) i opcjonalnie notatki.
                </Step>
                <Step n={4}>
                  <b>Krok 3 — Podsumowanie</b> i <Pill>Utwórz kampanię</Pill>.
                  Trafiasz na <Code>/campaigns/&lt;id&gt;</Code> — tutaj
                  edytujesz fazy, KPI i podpinasz produkcje.
                </Step>
              </Steps>
              <Tip>
                Kampanię możesz wybrać też w toolbarze pipeline’u — wtedy nad
                wierszami produkcji rysuje się pas narracyjny z fazami.
              </Tip>
            </Section>

            <Section
              num={2}
              icon={<Film className="w-4 h-4" />}
              title="Dodanie produkcji"
              path="/productions/list → „+ Nowa produkcja” (skrót: P)"
            >
              <p>
                Produkcja = <b>jeden klip</b> (Reel / TikTok / Short). Ma swoją
                oś czasu rozłożoną wokół T-0 (data publikacji) na trzy ramy:
                T-1 (outreach + ustalenia), T-2 (nagrywka + obróbka), T-3
                (publikacja).
              </p>
              <Steps>
                <Step n={1}>
                  W każdym widoku (Pipeline, Lista produkcji) kliknij{' '}
                  <Pill>+ Nowa produkcja</Pill> lub naciśnij <Kbd>P</Kbd>.
                </Step>
                <Step n={2}>
                  <b>Krok 1 — Typ.</b>
                  <ul className="mt-1 ml-4 list-disc text-muted-foreground space-y-0.5">
                    <li>
                      <b className="text-foreground">Z artystą</b> — kolab:
                      outreach, brief, nagranie z gościem, podziękowanie.
                    </li>
                    <li>
                      <b className="text-foreground">Solo</b> — twój content
                      (BTS, trending, refleksje), artysta nagrywa się sam.
                    </li>
                  </ul>
                  Wybierz też <b>szablon kroków</b> (9-krokowy fundament +
                  opcjonalne dodatki — wszystko edytujesz później).
                </Step>
                <Step n={3}>
                  <b>Krok 2 — Detale.</b> Tytuł, <b>tydzień startowy T-1</b>{' '}
                  (outreach / ustalenia — T-0 wyliczy się automatycznie 2
                  tygodnie później, w południe), artysta (wymagany — także
                  dla solo), kamerzysta (tylko z artystą), platformy publikacji,
                  notatki.
                </Step>
                <Step n={4}>
                  <b>Krok 3 — Podsumowanie</b> i <Pill>Utwórz produkcję</Pill>.
                  Trafiasz na <Code>/productions/&lt;id&gt;</Code>: pełna karta
                  produkcji z krokami, plikami i akcjami (anuluj, usuń, dodaj
                  krok).
                </Step>
              </Steps>
              <Tip>
                Brakuje artysty / kamerzysty? Dodaj w <Code>/artists</Code> lub{' '}
                <Code>/videographers</Code> i wróć do kreatora — lista
                odświeży się.
              </Tip>
            </Section>

            <Section
              num={3}
              icon={<ChartGantt className="w-4 h-4" />}
              title="Główny interfejs — Pipeline"
              path="/calendar (w sidebarze: „Pipeline”)"
            >
              <p>
                Pipeline to dyspozytornia wszystkich produkcji jednocześnie.
                Każda produkcja = jeden wiersz z trzema pasami{' '}
                <span className="font-mono">T1</span> ·{' '}
                <span className="font-mono">T2</span> ·{' '}
                <span className="font-mono">T3</span>. Kropki na pasach to
                kolejne kroki — to tu dzieje się codzienna robota.
              </p>

              <SubHeader>Czytanie wiersza</SubHeader>
              <ul className="ml-4 list-disc text-muted-foreground space-y-1">
                <li>
                  <b className="text-foreground">Lewa kolumna</b> — artysta /
                  tytuł, status, kamerzysta, platformy.
                </li>
                <li>
                  <b className="text-foreground">Pas T-1</b> (jasne) — outreach,
                  potwierdzenie warunków, ustalenia z kamerzystą.
                </li>
                <li>
                  <b className="text-foreground">Pas T-2</b> (środkowy) —
                  nagrywka i obróbka.
                </li>
                <li>
                  <b className="text-foreground">Pas T-3</b> (prawy) —
                  publikacja per platforma.
                </li>
                <li>
                  <b className="text-foreground">T-0</b> — pionowa linia daty
                  premiery; pas narracyjny kampanii rysuje się powyżej, jeśli
                  wybierzesz kampanię w toolbarze.
                </li>
              </ul>

              <SubHeader>Edycja w pipeline</SubHeader>
              <ul className="ml-4 list-disc text-muted-foreground space-y-1.5">
                <li>
                  <CircleDot className="inline w-3.5 h-3.5 -mt-0.5 mr-1 text-foreground" />
                  <b className="text-foreground">Klik w kropkę</b> — odhacza
                  krok (ustawia <Code>doneAt</Code>). Drugi klik cofa.
                </li>
                <li>
                  <b className="text-foreground">Hover na kropce</b> — karta
                  szczegółu: nazwa, opis, data, załącznik. Z karty: edytujesz
                  opis, podpinasz plik, otwierasz pełną kartę produkcji.
                </li>
                <li>
                  <b className="text-foreground">„+ krok”</b> w pasie —
                  inline-form dodający krok niestandardowy (np. „dogranie
                  saksofonu”, „korekta koloru”) bez wychodzenia z pipeline’u.
                </li>
                <li>
                  <b className="text-foreground">Drag &amp; drop pliku</b> na
                  krok — wrzuca załącznik do odpowiedniego folderu T2/T3.
                </li>
                <li>
                  <b className="text-foreground">Toolbar nad osią</b> —
                  przesunięcie tygodni, zoom (<Code>Tydzień</Code> /{' '}
                  <Code>Miesiąc</Code> / <Code>Kwartał</Code>), filtry status /
                  typ, sortowanie po dacie / statusie / nazwie, wybór kampanii
                  do nakładki narracyjnej.
                </li>
                <li>
                  <b className="text-foreground">Klik w tytuł produkcji</b> —
                  wchodzisz na pełną kartę (<Code>/productions/&lt;id&gt;</Code>),
                  gdzie zmieniasz tytuł, T-0, artystę, kamerzystę, platformy,
                  reorganizujesz kroki, anulujesz lub usuwasz produkcję.
                </li>
              </ul>
              <Tip>
                Kropki są źródłem prawdy — kalendarz, lista produkcji i
                analityka czytają z tej samej tabeli. Co odhaczysz w pipeline,
                pojawia się wszędzie indziej w sekundę.
              </Tip>
            </Section>

            <Section
              num={4}
              icon={<FolderOpen className="w-4 h-4" />}
              title="Foldery produkcji — gdzie lądują pliki"
              path="OneDrive: Marketing Content / <Artysta> / <Tytuł> /"
            >
              <p>
                Każda produkcja dostaje gotowe drzewo folderów na dysku
                (OneDrive — synchronizuje się między maszynami). Struktura jest{' '}
                <b>przyklejona do ram T-2 i T-3</b> z pipeline’u, więc plik
                zawsze wie, do którego kroku należy. T-1 to czysta komunikacja
                — nie ma folderu.
              </p>

              <SubHeader>Schemat drzewa (z ikonkami)</SubHeader>
              <FolderTree />

              <SubHeader>Przykład — produkcja „Kolaba z Anią — singiel Świt”</SubHeader>
              <FolderTreeExample />

              <Tip>
                Folder zakłada się sam przy tworzeniu produkcji (i przy
                pierwszym zrzucie pliku). Kasowanie produkcji w aplikacji nie
                kasuje plików — folder dostaje sufiks{' '}
                <Code>(nieaktualne)</Code>, żeby nic nie zniknęło przez
                przypadek.
              </Tip>
              <Tip>
                Domyślny korzeń to{' '}
                <Code>
                  C:\Users\&lt;user&gt;\OneDrive\Dokument\MARKETPLACE
                  DOCS\Marketing Content
                </Code>
                . Można nadpisać zmienną środowiskową{' '}
                <Code>MARKETING_CONTENT_ROOT</Code>.
              </Tip>
            </Section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Section({
  num,
  icon,
  title,
  path,
  children,
}: {
  num: number;
  icon: React.ReactNode;
  title: string;
  path: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline gap-2.5">
        <span className="grid place-items-center w-6 h-6 rounded-full bg-foreground text-background text-[11px] font-bold tabular-nums shrink-0">
          {num}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <span className="text-muted-foreground">{icon}</span>
            <span>{title}</span>
          </h3>
          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
            {path}
          </p>
        </div>
      </div>
      <div className="space-y-2 pl-8.5">{children}</div>
    </section>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-2">{children}</ol>;
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="grid place-items-center w-5 h-5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold tabular-nums shrink-0 mt-0.5">
        {n}
      </span>
      <div className="flex-1 text-sm">{children}</div>
    </li>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[11.5px] bg-muted/60 px-1 py-0.5 rounded text-foreground">
      {children}
    </code>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-border bg-muted/50 text-[11px] font-medium text-foreground">
      {children}
    </span>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="font-mono text-[10.5px] px-1.5 py-0.5 rounded border border-border bg-muted/30 text-foreground">
      {children}
    </kbd>
  );
}

function SubHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80 font-semibold pt-1">
      {children}
    </p>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] text-muted-foreground border-l-2 border-amber-400/60 bg-amber-50/30 dark:bg-amber-400/5 pl-2.5 py-1.5 rounded-r">
      <b className="text-foreground/80">Wskazówka: </b>
      {children}
    </p>
  );
}

function FolderTree() {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 font-mono text-[12px] leading-6">
      <Row icon={<FolderOpen className="text-amber-600" />} label="Marketing Content/" muted />
      <Row indent={1} icon={<Folder className="text-sky-600" />} label="<Artysta>/" />
      <Row indent={2} icon={<Folder className="text-sky-700" />} label="<Tytuł produkcji>/" />
      <Row indent={3} icon={<Folder className="text-zinc-500" />} label="T2/  " note="nagrywka + obróbka" />
      <Row indent={4} icon={<Video className="text-rose-600" />} label="nagrywanie/" />
      <Row indent={5} icon={<Camera className="text-rose-500" />} label="raw/" note="pliki z kamery" />
      <Row indent={5} icon={<Music className="text-violet-500" />} label="audio/" note="ścieżki dźwiękowe" />
      <Row indent={5} icon={<ImageIcon className="text-emerald-500" />} label="bts/" note="behind the scenes" />
      <Row indent={4} icon={<Scissors className="text-orange-600" />} label="obrobka/" />
      <Row indent={5} icon={<FileText className="text-orange-500" />} label="project/" note="plik DaVinci/Premiere" />
      <Row indent={5} icon={<Film className="text-orange-400" />} label="drafts/" note="wersje montażu" />
      <Row indent={5} icon={<ImageIcon className="text-orange-300" />} label="assets/" note="grafiki, napisy, LUT-y" />
      <Row indent={3} icon={<Folder className="text-zinc-500" />} label="T3/  " note="publikacja" />
      <Row indent={4} icon={<Send className="text-emerald-600" />} label="publikacja/" note="finały per platforma" />
    </div>
  );
}

function FolderTreeExample() {
  return (
    <div className="rounded-md border border-emerald-300/60 bg-emerald-50/40 dark:bg-emerald-500/5 p-3 font-mono text-[12px] leading-6">
      <Row icon={<FolderOpen className="text-amber-600" />} label="Marketing Content/" muted />
      <Row indent={1} icon={<Folder className="text-sky-600" />} label="Ania Kowalska/" />
      <Row indent={2} icon={<Folder className="text-sky-700" />} label="Kolaba z Anią — singiel Świt/" />
      <Row indent={3} icon={<Folder className="text-zinc-500" />} label="T2/" />
      <Row indent={4} icon={<Video className="text-rose-600" />} label="nagrywanie/" />
      <Row indent={5} icon={<Camera className="text-rose-500" />} label="raw/" />
      <Row indent={6} icon={<FileText className="text-zinc-400" />} label="A001_C001_swit.mov" muted />
      <Row indent={6} icon={<FileText className="text-zinc-400" />} label="A001_C002_swit.mov" muted />
      <Row indent={5} icon={<Music className="text-violet-500" />} label="audio/" />
      <Row indent={6} icon={<FileText className="text-zinc-400" />} label="swit-master.wav" muted />
      <Row indent={5} icon={<ImageIcon className="text-emerald-500" />} label="bts/" />
      <Row indent={6} icon={<FileText className="text-zinc-400" />} label="bts-studio-2026-05-12.jpg" muted />
      <Row indent={4} icon={<Scissors className="text-orange-600" />} label="obrobka/" />
      <Row indent={5} icon={<FileText className="text-orange-500" />} label="project/" />
      <Row indent={6} icon={<FileText className="text-zinc-400" />} label="swit_v3.drp" muted />
      <Row indent={5} icon={<Film className="text-orange-400" />} label="drafts/" />
      <Row indent={6} icon={<FileText className="text-zinc-400" />} label="swit-draft-01.mp4" muted />
      <Row indent={6} icon={<FileText className="text-zinc-400" />} label="swit-draft-02.mp4" muted />
      <Row indent={5} icon={<ImageIcon className="text-orange-300" />} label="assets/" />
      <Row indent={6} icon={<FileText className="text-zinc-400" />} label="napisy.srt" muted />
      <Row indent={3} icon={<Folder className="text-zinc-500" />} label="T3/" />
      <Row indent={4} icon={<Send className="text-emerald-600" />} label="publikacja/" />
      <Row indent={5} icon={<FileText className="text-zinc-400" />} label="swit-reel-9x16.mp4" muted />
      <Row indent={5} icon={<FileText className="text-zinc-400" />} label="swit-tiktok-9x16.mp4" muted />
      <Row indent={5} icon={<FileText className="text-zinc-400" />} label="swit-shorts-9x16.mp4" muted />
      <div className="mt-2 pt-2 border-t border-emerald-300/40 text-[11px] font-sans text-muted-foreground flex items-center gap-1.5">
        <Calendar className="w-3 h-3" />
        Kropki <b className="text-foreground">nagrywanie</b> /{' '}
        <b className="text-foreground">obróbka</b> /{' '}
        <b className="text-foreground">publikacja</b> w pipeline pokazują
        liczniki plików z odpowiednich folderów.
      </div>
    </div>
  );
}

function Row({
  indent = 0,
  icon,
  label,
  note,
  muted,
}: {
  indent?: number;
  icon: React.ReactNode;
  label: string;
  note?: string;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 ${muted ? 'text-muted-foreground' : 'text-foreground'}`}
      style={{ paddingLeft: `${indent * 14}px` }}
    >
      <span className="w-3.5 h-3.5 inline-grid place-items-center shrink-0">
        <span className="[&>svg]:w-3.5 [&>svg]:h-3.5">{icon}</span>
      </span>
      <span>{label}</span>
      {note ? (
        <span className="text-[10.5px] font-sans italic text-muted-foreground/80">
          — {note}
        </span>
      ) : null}
    </div>
  );
}

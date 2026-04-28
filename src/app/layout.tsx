import type { Metadata } from 'next';
import { Manrope, Geist_Mono } from 'next/font/google';
import { Sidebar } from '@/components/sidebar';
import { CommandPalette } from '@/components/command-palette';
import { ShortcutsHelp } from '@/components/shortcuts-help';
import { Toaster } from '@/components/ui/sonner';
import { loadAgentMeta } from '@/lib/agents';
import './globals.css';

const manrope = Manrope({
  variable: '--font-sans',
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Marketing Crew',
  description: 'Pulpit dla kampanii marketingowej w short-form video.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const agents = loadAgentMeta();
  return (
    <html
      lang="pl"
      className={`${manrope.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <div className="flex min-h-screen">
          <Sidebar agents={agents} />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
        <CommandPalette agents={agents} />
        <ShortcutsHelp />
        <Toaster />
      </body>
    </html>
  );
}
